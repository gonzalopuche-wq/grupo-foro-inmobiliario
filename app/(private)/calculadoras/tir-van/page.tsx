"use client";

import { useState, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TipoProyecto = "compraventa" | "alquiler" | "desarrollo" | "custom";
type TabId = "config" | "resultados" | "sensibilidad";

interface CompraventaParams {
  valorCompra: number;
  gastosCompra: number; // %
  valorVenta: number;
  gastosVenta: number; // %
  tipoCambio: number;
}

interface AlquilerParams {
  valorCompra: number;
  gastosCompra: number; // %
  alquilerMensual: number; // ARS
  gastosMantenimiento: number; // ARS/año
  valorVenta: number; // USD al año 5
  ajusteAlquilerAnual: number; // %
}

interface DesarrolloParams {
  compraTerreno: number;
  costoObraTotal: number;
  mesesObra: number;
  ingresoTotalVentas: number;
  mesesVenta: number;
}

interface CustomRow {
  mes: number;
  flujo: number;
}

interface ResultadosCalc {
  tir: number | null;
  van: number;
  roi: number;
  payback: number;
  multiplo: number;
  totalInversion: number;
  totalIngresos: number;
  flujos: number[];
  flujosAcum: number[];
}

interface SensibilidadRow {
  precioPct: number;
  precioVenta: number;
  van: number;
  tir: number | null;
  payback: number;
  viable: boolean;
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function calcularVAN(flujos: number[], tasa: number): number {
  return flujos.reduce((acc, f, i) => acc + f / Math.pow(1 + tasa, i), 0);
}

function calcularTIR(flujos: number[]): number | null {
  let tasa = 0.01;
  for (let i = 0; i < 1000; i++) {
    const van = calcularVAN(flujos, tasa);
    const dVAN = flujos.reduce(
      (acc, f, t) => acc - (t * f) / Math.pow(1 + tasa, t + 1),
      0
    );
    if (Math.abs(dVAN) < 1e-10) break;
    const nuevaTasa = tasa - van / dVAN;
    if (Math.abs(nuevaTasa - tasa) < 1e-8) {
      tasa = nuevaTasa;
      break;
    }
    tasa = nuevaTasa;
  }
  if (tasa < -0.9 || tasa > 10) return null;
  return tasa * 12 * 100; // TIR anualizada en %
}

function calcularPayback(flujos: number[]): number {
  let acumulado = 0;
  for (let i = 0; i < flujos.length; i++) {
    acumulado += flujos[i];
    if (acumulado >= 0) return i;
  }
  return -1;
}

// ── Generadores de flujos ─────────────────────────────────────────────────────

function generarFlujosCompraventa(p: CompraventaParams): number[] {
  const inversion = p.valorCompra * p.tipoCambio * (1 + p.gastosCompra / 100);
  const flujos: number[] = new Array(13).fill(0);
  flujos[0] = -inversion;
  flujos[12] =
    p.valorVenta * p.tipoCambio * (1 - p.gastosVenta / 100);
  return flujos;
}

function generarFlujosAlquiler(p: AlquilerParams): number[] {
  const inversion = p.valorCompra * (1 + p.gastosCompra / 100);
  const flujos: number[] = new Array(61).fill(0);
  flujos[0] = -inversion;
  for (let mes = 1; mes <= 60; mes++) {
    const anio = Math.floor((mes - 1) / 12);
    const factor = Math.pow(1 + p.ajusteAlquilerAnual / 100, anio);
    const alquilerMes = p.alquilerMensual * factor;
    const gastosMes = p.gastosMantenimiento / 12;
    flujos[mes] = alquilerMes - gastosMes;
  }
  flujos[60] += p.valorVenta;
  return flujos;
}

function generarFlujosDesarrollo(p: DesarrolloParams): number[] {
  const totalMeses = p.mesesObra + p.mesesVenta;
  const flujos: number[] = new Array(totalMeses + 1).fill(0);
  flujos[0] = -p.compraTerreno;
  const costoPorMes = p.costoObraTotal / p.mesesObra;
  for (let mes = 1; mes <= p.mesesObra; mes++) {
    flujos[mes] -= costoPorMes;
  }
  const ingresoMensualVentas =
    (p.ingresoTotalVentas * 0.8) / p.mesesVenta;
  for (let mes = p.mesesObra + 1; mes <= totalMeses; mes++) {
    flujos[mes] += ingresoMensualVentas;
  }
  flujos[totalMeses] += p.ingresoTotalVentas * 0.2;
  return flujos;
}

// ── Formateadores ─────────────────────────────────────────────────────────────

const fmtARS = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${Math.round(abs).toLocaleString("es-AR")}`;
};

const fmtPct = (v: number | null): string =>
  v === null ? "N/D" : `${v.toFixed(2)}%`;

const fmtMeses = (v: number): string =>
  v < 0 ? "No recupera" : v === 0 ? "Mes 0" : `Mes ${v}`;

// ── Estilos base ──────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  background: "#111",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#fff",
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  fontFamily: "Inter, sans-serif",
  boxSizing: "border-box",
};

const label: React.CSSProperties = {
  fontSize: 10,
  color: "#888",
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
  display: "block",
};

const card: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 10,
  padding: "16px 20px",
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function TirVanPage() {
  const [tab, setTab] = useState<TabId>("config");
  const [tipo, setTipo] = useState<TipoProyecto>("compraventa");
  const [tasaDescuento, setTasaDescuento] = useState(8);

  // Compraventa
  const [cv, setCv] = useState<CompraventaParams>({
    valorCompra: 80000,
    gastosCompra: 7.5,
    valorVenta: 95000,
    gastosVenta: 5,
    tipoCambio: 1300,
  });

  // Alquiler
  const [alq, setAlq] = useState<AlquilerParams>({
    valorCompra: 80000,
    gastosCompra: 7.5,
    alquilerMensual: 250000,
    gastosMantenimiento: 60000,
    valorVenta: 90000,
    ajusteAlquilerAnual: 80,
  });

  // Desarrollo
  const [des, setDes] = useState<DesarrolloParams>({
    compraTerreno: 200000,
    costoObraTotal: 500000,
    mesesObra: 18,
    ingresoTotalVentas: 900000,
    mesesVenta: 12,
  });

  // Custom
  const [customRows, setCustomRows] = useState<CustomRow[]>([
    { mes: 0, flujo: -100000 },
    { mes: 6, flujo: 0 },
    { mes: 12, flujo: 130000 },
  ]);

  // ── Flujos ────────────────────────────────────────────────────────────────

  const flujos: number[] = useMemo(() => {
    if (tipo === "compraventa") return generarFlujosCompraventa(cv);
    if (tipo === "alquiler") return generarFlujosAlquiler(alq);
    if (tipo === "desarrollo") return generarFlujosDesarrollo(des);
    // custom: armar array esparso
    if (customRows.length === 0) return [0];
    const maxMes = Math.max(...customRows.map((r) => r.mes));
    const arr: number[] = new Array(maxMes + 1).fill(0);
    for (const row of customRows) {
      if (row.mes >= 0 && row.mes <= maxMes) {
        arr[row.mes] += row.flujo;
      }
    }
    return arr;
  }, [tipo, cv, alq, des, customRows]);

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const resultados: ResultadosCalc = useMemo(() => {
    const tir = calcularTIR(flujos);
    const tasaMensual = Math.pow(1 + tasaDescuento / 100, 1 / 12) - 1;
    const van = calcularVAN(flujos, tasaMensual);
    const payback = calcularPayback(flujos);
    const totalInversion = flujos
      .filter((f) => f < 0)
      .reduce((acc, f) => acc + Math.abs(f), 0);
    const totalIngresos = flujos
      .filter((f) => f > 0)
      .reduce((acc, f) => acc + f, 0);
    const roi =
      totalInversion > 0
        ? ((totalIngresos - totalInversion) / totalInversion) * 100
        : 0;
    const multiplo = totalInversion > 0 ? totalIngresos / totalInversion : 0;

    let acum = 0;
    const flujosAcum = flujos.map((f) => {
      acum += f;
      return acum;
    });

    return { tir, van, roi, payback, multiplo, totalInversion, totalIngresos, flujos, flujosAcum };
  }, [flujos, tasaDescuento]);

  // ── Sensibilidad ──────────────────────────────────────────────────────────

  const sensibilidad: SensibilidadRow[] = useMemo(() => {
    const pasos = [-30, -20, -10, 0, 10, 20, 30];
    const tasaMensual = Math.pow(1 + tasaDescuento / 100, 1 / 12) - 1;

    return pasos.map((pct) => {
      let flujosVariados: number[];
      let precioVenta = 0;

      if (tipo === "compraventa") {
        const nuevoValorVenta = cv.valorVenta * (1 + pct / 100);
        precioVenta = nuevoValorVenta;
        const params: CompraventaParams = { ...cv, valorVenta: nuevoValorVenta };
        flujosVariados = generarFlujosCompraventa(params);
      } else if (tipo === "alquiler") {
        const nuevoValorVenta = alq.valorVenta * (1 + pct / 100);
        precioVenta = nuevoValorVenta;
        const params: AlquilerParams = { ...alq, valorVenta: nuevoValorVenta };
        flujosVariados = generarFlujosAlquiler(params);
      } else if (tipo === "desarrollo") {
        const nuevoIngreso = des.ingresoTotalVentas * (1 + pct / 100);
        precioVenta = nuevoIngreso;
        const params: DesarrolloParams = { ...des, ingresoTotalVentas: nuevoIngreso };
        flujosVariados = generarFlujosDesarrollo(params);
      } else {
        // custom: escalar flujos positivos
        flujosVariados = flujos.map((f) => (f > 0 ? f * (1 + pct / 100) : f));
        precioVenta = flujos.filter((f) => f > 0).reduce((a, f) => a + f, 0) * (1 + pct / 100);
      }

      const van = calcularVAN(flujosVariados, tasaMensual);
      const tir = calcularTIR(flujosVariados);
      const payback = calcularPayback(flujosVariados);
      const viable = tir !== null && tir > tasaDescuento;

      return { precioPct: pct, precioVenta, van, tir, payback, viable };
    });
  }, [tipo, cv, alq, des, flujos, tasaDescuento]);

  // Punto de equilibrio
  const puntoEquilibrio: number | null = useMemo(() => {
    const tasaMensual = Math.pow(1 + tasaDescuento / 100, 1 / 12) - 1;

    // Encontrar el factor k tal que VAN(flujos_base * k para positivos) = 0
    // Búsqueda binaria sobre el multiplicador de ingresos
    let lo = 0;
    let hi = 10;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const fv = flujos.map((f) => (f > 0 ? f * mid : f));
      const van = calcularVAN(fv, tasaMensual);
      if (Math.abs(van) < 1) break;
      if (van < 0) lo = mid;
      else hi = mid;
    }
    const factor = (lo + hi) / 2;

    if (tipo === "compraventa") return cv.valorVenta * factor;
    if (tipo === "alquiler") return alq.valorVenta * factor;
    if (tipo === "desarrollo") return des.ingresoTotalVentas * factor;
    return null;
  }, [flujos, tasaDescuento, tipo, cv, alq, des]);

  // ── SVG Waterfall ─────────────────────────────────────────────────────────

  const svgW = 600;
  const svgH = 280;
  const padL = 56;
  const padR = 16;
  const padT = 20;
  const padB = 28;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const flujosAcum = resultados.flujosAcum;
  const minAcum = Math.min(...flujosAcum, 0);
  const maxAcum = Math.max(...flujosAcum, 0);
  const rangeAcum = maxAcum - minAcum || 1;
  const zeroY = padT + ((maxAcum / rangeAcum) * chartH);

  function xPos(i: number): number {
    return padL + (i / Math.max(flujosAcum.length - 1, 1)) * chartW;
  }
  function yPos(v: number): number {
    return padT + ((maxAcum - v) / rangeAcum) * chartH;
  }

  const linePath = flujosAcum
    .map((v, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`)
    .join(" ");

  const positiveArea = (() => {
    if (flujosAcum.length < 2) return "";
    const pts: string[] = [];
    for (let i = 0; i < flujosAcum.length; i++) {
      const x = xPos(i);
      const y = Math.min(yPos(Math.max(flujosAcum[i], 0)), zeroY);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    pts.push(`${xPos(flujosAcum.length - 1).toFixed(1)},${zeroY.toFixed(1)}`);
    pts.push(`${xPos(0).toFixed(1)},${zeroY.toFixed(1)}`);
    return `M${pts.join("L")}Z`;
  })();

  const negativeArea = (() => {
    if (flujosAcum.length < 2) return "";
    const pts: string[] = [];
    for (let i = 0; i < flujosAcum.length; i++) {
      const x = xPos(i);
      const y = Math.max(yPos(Math.min(flujosAcum[i], 0)), zeroY);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    pts.push(`${xPos(flujosAcum.length - 1).toFixed(1)},${zeroY.toFixed(1)}`);
    pts.push(`${xPos(0).toFixed(1)},${zeroY.toFixed(1)}`);
    return `M${pts.join("L")}Z`;
  })();

  const paybackMes = resultados.payback;

  // ── Render helpers ────────────────────────────────────────────────────────

  const btnTipo = (t: TipoProyecto, label2: string) => (
    <button
      key={t}
      onClick={() => setTipo(t)}
      style={{
        flex: 1,
        padding: "10px 8px",
        borderRadius: 8,
        border: tipo === t ? "1px solid #cc0000" : "1px solid #333",
        background: tipo === t ? "rgba(204,0,0,0.15)" : "#111",
        color: tipo === t ? "#cc0000" : "#666",
        fontFamily: "Montserrat, sans-serif",
        fontWeight: 700,
        fontSize: 12,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label2}
    </button>
  );

  const btnTab = (t: TabId, label2: string) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      style={{
        padding: "10px 20px",
        borderRadius: 8,
        border: tab === t ? "1px solid #cc0000" : "1px solid #333",
        background: tab === t ? "rgba(204,0,0,0.12)" : "transparent",
        color: tab === t ? "#fff" : "#666",
        fontFamily: "Montserrat, sans-serif",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label2}
    </button>
  );

  function numInput(
    val: number,
    onChange: (v: number) => void,
    lbl: string,
    step = 1,
    min = 0
  ) {
    return (
      <div>
        <span style={label}>{lbl}</span>
        <input
          type="number"
          value={val}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={inp}
        />
      </div>
    );
  }

  // ── Tabla flujos preview ──────────────────────────────────────────────────

  const flujosPreview = useMemo(() => {
    let acum = 0;
    return flujos.map((f, i) => {
      acum += f;
      return {
        mes: i,
        flujoARS: f,
        flujoUSD: f / (tipo === "alquiler" ? 1 : cv.tipoCambio),
        acumulado: acum,
      };
    });
  }, [flujos, tipo, cv.tipoCambio]);

  // ── VAN parcial por mes ───────────────────────────────────────────────────

  const tasaMensual = Math.pow(1 + tasaDescuento / 100, 1 / 12) - 1;
  const vanParciales = flujos.map((f, i) => f / Math.pow(1 + tasaMensual, i));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 28,
              color: "#fff",
              margin: 0,
            }}
          >
            TIR &amp; VAN — Análisis de Inversión
          </h1>
          <p style={{ color: "#999", fontSize: 14, margin: "8px 0 0" }}>
            Evaluá la viabilidad financiera de proyectos inmobiliarios
          </p>
        </div>

        {/* Tasa de descuento global */}
        <div
          style={{
            ...card,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <span style={label}>Tasa de descuento anual (%)</span>
            <input
              type="number"
              value={tasaDescuento}
              step={0.5}
              min={0}
              onChange={(e) =>
                setTasaDescuento(parseFloat(e.target.value) || 0)
              }
              style={{ ...inp, maxWidth: 160 }}
            />
          </div>
          <div style={{ color: "#666", fontSize: 12 }}>
            Tasa utilizada para calcular el VAN. TIR &gt; tasa de descuento →
            proyecto viable.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {btnTab("config", "1. Configurar proyecto")}
          {btnTab("resultados", "2. Resultados")}
          {btnTab("sensibilidad", "3. Sensibilidad")}
        </div>

        {/* ── Tab 1: Configurar ──────────────────────────────────────────── */}
        {tab === "config" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Tipo de proyecto */}
            <div style={card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#cc0000",
                  margin: "0 0 14px",
                  textTransform: "uppercase",
                }}
              >
                Tipo de proyecto
              </h2>
              <div style={{ display: "flex", gap: 8 }}>
                {btnTipo("compraventa", "Compraventa")}
                {btnTipo("alquiler", "Alquiler (5 años)")}
                {btnTipo("desarrollo", "Desarrollo")}
                {btnTipo("custom", "Custom")}
              </div>
            </div>

            {/* Inputs por tipo */}
            <div style={card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  margin: "0 0 16px",
                  textTransform: "uppercase",
                }}
              >
                Parámetros
              </h2>

              {tipo === "compraventa" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  {numInput(cv.valorCompra, (v) => setCv((c) => ({ ...c, valorCompra: v })), "Valor de compra (USD)", 1000)}
                  {numInput(cv.gastosCompra, (v) => setCv((c) => ({ ...c, gastosCompra: v })), "Gastos de compra (%)", 0.5)}
                  {numInput(cv.valorVenta, (v) => setCv((c) => ({ ...c, valorVenta: v })), "Valor de venta (USD)", 1000)}
                  {numInput(cv.gastosVenta, (v) => setCv((c) => ({ ...c, gastosVenta: v })), "Gastos de venta / comisión (%)", 0.5)}
                  {numInput(cv.tipoCambio, (v) => setCv((c) => ({ ...c, tipoCambio: v })), "Tipo de cambio (ARS/USD)", 50)}
                </div>
              )}

              {tipo === "alquiler" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  {numInput(alq.valorCompra, (v) => setAlq((c) => ({ ...c, valorCompra: v })), "Valor de compra (USD)", 1000)}
                  {numInput(alq.gastosCompra, (v) => setAlq((c) => ({ ...c, gastosCompra: v })), "Gastos de compra (%)", 0.5)}
                  {numInput(alq.alquilerMensual, (v) => setAlq((c) => ({ ...c, alquilerMensual: v })), "Alquiler mensual (ARS)", 5000)}
                  {numInput(alq.gastosMantenimiento, (v) => setAlq((c) => ({ ...c, gastosMantenimiento: v })), "Gastos mantenimiento (ARS/año)", 5000)}
                  {numInput(alq.valorVenta, (v) => setAlq((c) => ({ ...c, valorVenta: v })), "Valor de venta al año 5 (USD)", 1000)}
                  {numInput(alq.ajusteAlquilerAnual, (v) => setAlq((c) => ({ ...c, ajusteAlquilerAnual: v })), "Ajuste alquiler anual (%)", 5)}
                </div>
              )}

              {tipo === "desarrollo" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  {numInput(des.compraTerreno, (v) => setDes((c) => ({ ...c, compraTerreno: v })), "Compra terreno (USD)", 5000)}
                  {numInput(des.costoObraTotal, (v) => setDes((c) => ({ ...c, costoObraTotal: v })), "Costo obra total (USD)", 10000)}
                  {numInput(des.mesesObra, (v) => setDes((c) => ({ ...c, mesesObra: Math.max(1, Math.round(v)) })), "Meses de obra", 1, 1)}
                  {numInput(des.ingresoTotalVentas, (v) => setDes((c) => ({ ...c, ingresoTotalVentas: v })), "Ingreso total ventas (USD)", 10000)}
                  {numInput(des.mesesVenta, (v) => setDes((c) => ({ ...c, mesesVenta: Math.max(1, Math.round(v)) })), "Período de ventas (meses)", 1, 1)}
                </div>
              )}

              {tipo === "custom" && (
                <div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 1fr 32px",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        ...label,
                        paddingTop: 4,
                      }}
                    >
                      Mes
                    </span>
                    <span
                      style={{
                        ...label,
                        paddingTop: 4,
                      }}
                    >
                      Flujo (ARS, negativo = egreso)
                    </span>
                    <span />
                  </div>
                  {customRows.map((row, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "80px 1fr 32px",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <input
                        type="number"
                        value={row.mes}
                        min={0}
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 0;
                          setCustomRows((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, mes: Math.max(0, v) } : r
                            )
                          );
                        }}
                        style={inp}
                      />
                      <input
                        type="number"
                        value={row.flujo}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setCustomRows((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, flujo: v } : r
                            )
                          );
                        }}
                        style={inp}
                      />
                      <button
                        onClick={() =>
                          setCustomRows((rows) =>
                            rows.filter((_, i) => i !== idx)
                          )
                        }
                        style={{
                          background: "rgba(204,0,0,0.15)",
                          border: "1px solid #cc0000",
                          borderRadius: 6,
                          color: "#cc0000",
                          cursor: "pointer",
                          fontSize: 16,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setCustomRows((rows) => [
                        ...rows,
                        {
                          mes: rows.length > 0 ? Math.max(...rows.map((r) => r.mes)) + 1 : 0,
                          flujo: 0,
                        },
                      ])
                    }
                    style={{
                      marginTop: 8,
                      padding: "8px 16px",
                      background: "transparent",
                      border: "1px solid #333",
                      borderRadius: 6,
                      color: "#888",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    + Agregar fila
                  </button>
                </div>
              )}
            </div>

            {/* Preview de flujos */}
            <div style={card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  margin: "0 0 14px",
                  textTransform: "uppercase",
                }}
              >
                Preview de flujos generados
              </h2>
              <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0, background: "#111" }}>
                    <tr>
                      {["Mes", "Flujo ARS", "Flujo USD", "Acumulado ARS"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "right",
                              padding: "6px 12px",
                              color: "#666",
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 700,
                              fontSize: 10,
                              textTransform: "uppercase",
                              borderBottom: "1px solid #222",
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {flujosPreview.map((row) => (
                      <tr
                        key={row.mes}
                        style={{
                          borderBottom: "1px solid #1a1a1a",
                          background:
                            row.flujoARS !== 0
                              ? row.flujoARS < 0
                                ? "rgba(204,0,0,0.05)"
                                : "rgba(34,197,94,0.04)"
                              : "transparent",
                        }}
                      >
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            color: "#888",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          {row.mes}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            color:
                              row.flujoARS > 0
                                ? "#22c55e"
                                : row.flujoARS < 0
                                ? "#ef4444"
                                : "#555",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: row.flujoARS !== 0 ? 700 : 400,
                          }}
                        >
                          {row.flujoARS !== 0 ? fmtARS(row.flujoARS) : "—"}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            color: "#666",
                          }}
                        >
                          {row.flujoARS !== 0
                            ? fmtARS(row.flujoUSD) + " USD"
                            : "—"}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            color:
                              row.acumulado >= 0 ? "#22c55e" : "#ef4444",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          {fmtARS(row.acumulado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                <button
                  onClick={() => setTab("resultados")}
                  style={{
                    padding: "10px 24px",
                    background: "#cc0000",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Ver resultados →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Resultados ──────────────────────────────────────────── */}
        {tab === "resultados" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPI Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 12,
              }}
            >
              {/* TIR */}
              <div
                style={{
                  ...card,
                  borderColor:
                    resultados.tir !== null && resultados.tir > tasaDescuento
                      ? "#22c55e"
                      : "#cc0000",
                }}
              >
                <div
                  style={{
                    ...label,
                    color: "#888",
                  }}
                >
                  TIR Anual
                </div>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 26,
                    color:
                      resultados.tir !== null && resultados.tir > tasaDescuento
                        ? "#22c55e"
                        : "#cc0000",
                    marginTop: 4,
                  }}
                >
                  {fmtPct(resultados.tir)}
                </div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                  {resultados.tir !== null && resultados.tir > tasaDescuento
                    ? `Supera tasa (${tasaDescuento}%)`
                    : `Por debajo de ${tasaDescuento}%`}
                </div>
              </div>

              {/* VAN */}
              <div
                style={{
                  ...card,
                  borderColor: resultados.van >= 0 ? "#22c55e" : "#cc0000",
                }}
              >
                <div style={label}>VAN</div>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 22,
                    color: resultados.van >= 0 ? "#22c55e" : "#cc0000",
                    marginTop: 4,
                  }}
                >
                  {fmtARS(resultados.van)}
                </div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                  {resultados.van >= 0
                    ? "Proyecto viable"
                    : "No viable a esta tasa"}
                </div>
              </div>

              {/* ROI */}
              <div style={card}>
                <div style={label}>ROI Total</div>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 26,
                    color:
                      resultados.roi >= 0 ? "#3b82f6" : "#cc0000",
                    marginTop: 4,
                  }}
                >
                  {resultados.roi.toFixed(1)}%
                </div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                  (Ingresos − Inversión) / Inversión
                </div>
              </div>

              {/* Payback */}
              <div style={card}>
                <div style={label}>Payback</div>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 22,
                    color:
                      resultados.payback >= 0 ? "#f59e0b" : "#cc0000",
                    marginTop: 4,
                  }}
                >
                  {fmtMeses(resultados.payback)}
                </div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                  Recupero de la inversión
                </div>
              </div>

              {/* Múltiplo */}
              <div style={card}>
                <div style={label}>Múltiplo de capital</div>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 26,
                    color:
                      resultados.multiplo >= 1 ? "#a78bfa" : "#cc0000",
                    marginTop: 4,
                  }}
                >
                  {resultados.multiplo.toFixed(2)}x
                </div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                  Total cobrado / Total invertido
                </div>
              </div>
            </div>

            {/* SVG Waterfall */}
            <div style={card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  margin: "0 0 16px",
                  textTransform: "uppercase",
                }}
              >
                Flujo acumulado por mes
              </h2>
              <div style={{ overflowX: "auto" }}>
                <svg
                  width={svgW}
                  height={svgH}
                  style={{ display: "block" }}
                >
                  {/* Área verde (positivo) */}
                  {positiveArea && (
                    <path
                      d={positiveArea}
                      fill="rgba(34,197,94,0.15)"
                    />
                  )}
                  {/* Área roja (negativo) */}
                  {negativeArea && (
                    <path
                      d={negativeArea}
                      fill="rgba(204,0,0,0.15)"
                    />
                  )}
                  {/* Línea Y=0 */}
                  <line
                    x1={padL}
                    y1={zeroY}
                    x2={svgW - padR}
                    y2={zeroY}
                    stroke="#cc0000"
                    strokeWidth={1}
                    strokeDasharray="5,4"
                    opacity={0.7}
                  />
                  {/* Línea azul acumulado */}
                  {flujosAcum.length > 1 && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                    />
                  )}
                  {/* Marca payback */}
                  {paybackMes >= 0 && paybackMes < flujosAcum.length && (
                    <>
                      <line
                        x1={xPos(paybackMes)}
                        y1={padT}
                        x2={xPos(paybackMes)}
                        y2={svgH - padB}
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="4,3"
                      />
                      <text
                        x={xPos(paybackMes) + 4}
                        y={padT + 12}
                        fill="#f59e0b"
                        fontSize={9}
                        fontFamily="Montserrat,sans-serif"
                      >
                        Payback m{paybackMes}
                      </text>
                    </>
                  )}
                  {/* Eje Y labels */}
                  {[maxAcum, maxAcum / 2, 0, minAcum / 2, minAcum].map(
                    (v, i) => (
                      <text
                        key={i}
                        x={padL - 4}
                        y={yPos(v) + 4}
                        textAnchor="end"
                        fill="#555"
                        fontSize={9}
                        fontFamily="Montserrat,sans-serif"
                      >
                        {fmtARS(v)}
                      </text>
                    )
                  )}
                  {/* Eje X labels */}
                  {flujosAcum.length > 1 &&
                    [0, 0.25, 0.5, 0.75, 1].map((pct) => {
                      const i = Math.round(pct * (flujosAcum.length - 1));
                      return (
                        <text
                          key={pct}
                          x={xPos(i)}
                          y={svgH - 6}
                          textAnchor="middle"
                          fill="#555"
                          fontSize={9}
                          fontFamily="Montserrat,sans-serif"
                        >
                          m{i}
                        </text>
                      );
                    })}
                  {/* Puntos en la línea */}
                  {flujosAcum
                    .filter((_, i) => flujosAcum[i] !== flujosAcum[i - 1])
                    .slice(0, 60)
                    .map((_, idx) => {
                      const i = flujos
                        .map((f, j) => ({ f, j }))
                        .filter(({ f }) => f !== 0)
                        .map(({ j }) => j)[idx];
                      if (i === undefined) return null;
                      return (
                        <circle
                          key={idx}
                          cx={xPos(i)}
                          cy={yPos(flujosAcum[i])}
                          r={3}
                          fill={flujosAcum[i] >= 0 ? "#22c55e" : "#ef4444"}
                        />
                      );
                    })}
                </svg>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  marginTop: 10,
                  flexWrap: "wrap",
                }}
              >
                {[
                  {
                    color: "#3b82f6",
                    label2: "Flujo acumulado",
                    type: "line",
                  },
                  {
                    color: "rgba(34,197,94,0.4)",
                    label2: "Zona positiva",
                    type: "fill",
                  },
                  {
                    color: "rgba(204,0,0,0.4)",
                    label2: "Zona negativa",
                    type: "fill",
                  },
                  {
                    color: "#f59e0b",
                    label2: "Payback",
                    type: "dash",
                  },
                ].map((item) => (
                  <div
                    key={item.label2}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {item.type === "line" ? (
                      <div
                        style={{
                          width: 20,
                          height: 2,
                          background: item.color,
                        }}
                      />
                    ) : item.type === "dash" ? (
                      <div
                        style={{
                          width: 20,
                          height: 2,
                          background: `repeating-linear-gradient(90deg,${item.color} 0 4px,transparent 4px 7px)`,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          background: item.color,
                        }}
                      />
                    )}
                    <span style={{ fontSize: 11, color: "#888" }}>
                      {item.label2}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabla de flujos */}
            <div style={card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  margin: "0 0 14px",
                  textTransform: "uppercase",
                }}
              >
                Tabla de flujos
              </h2>
              <div
                style={{
                  overflowX: "auto",
                  maxHeight: 360,
                  overflowY: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "#111",
                    }}
                  >
                    <tr>
                      {[
                        "Mes",
                        "Flujo",
                        "Flujo acumulado",
                        "VAN parcial",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "right",
                            padding: "6px 12px",
                            color: "#666",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            fontSize: 10,
                            textTransform: "uppercase",
                            borderBottom: "1px solid #222",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flujos.map((f, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid #1a1a1a",
                          background:
                            i === paybackMes
                              ? "rgba(245,158,11,0.07)"
                              : i % 2 === 0
                              ? "#0d0d0d"
                              : "transparent",
                        }}
                      >
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            color:
                              i === paybackMes ? "#f59e0b" : "#888",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          {i === paybackMes ? `★ ${i}` : i}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            color:
                              f > 0
                                ? "#22c55e"
                                : f < 0
                                ? "#ef4444"
                                : "#444",
                          }}
                        >
                          {f !== 0 ? fmtARS(f) : "—"}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            color:
                              resultados.flujosAcum[i] >= 0
                                ? "#22c55e"
                                : "#ef4444",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          {fmtARS(resultados.flujosAcum[i])}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            color: "#666",
                          }}
                        >
                          {fmtARS(vanParciales[i])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Sensibilidad ────────────────────────────────────────── */}
        {tab === "sensibilidad" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  margin: "0 0 6px",
                  textTransform: "uppercase",
                }}
              >
                Análisis de sensibilidad — Variación de ingresos
              </h2>
              <p style={{ fontSize: 12, color: "#666", margin: "0 0 16px" }}>
                {tipo === "desarrollo"
                  ? "Variando el ingreso total de ventas ±30%"
                  : tipo === "custom"
                  ? "Variando los flujos positivos ±30%"
                  : "Variando el precio de venta ±30%"}
              </p>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Variación",
                        tipo === "desarrollo"
                          ? "Ingreso ventas"
                          : tipo === "custom"
                          ? "Ingresos totales"
                          : "Precio de venta",
                        "VAN",
                        "TIR Anual",
                        "Payback",
                        "Viable",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "right",
                            padding: "10px 16px",
                            color: "#666",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            fontSize: 10,
                            textTransform: "uppercase",
                            borderBottom: "1px solid #222",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensibilidad.map((row) => (
                      <tr
                        key={row.precioPct}
                        style={{
                          borderBottom: "1px solid #1a1a1a",
                          background:
                            row.precioPct === 0
                              ? "rgba(255,255,255,0.03)"
                              : row.viable
                              ? "rgba(34,197,94,0.04)"
                              : "rgba(204,0,0,0.04)",
                        }}
                      >
                        <td
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            color:
                              row.precioPct === 0
                                ? "#fff"
                                : row.precioPct > 0
                                ? "#22c55e"
                                : "#ef4444",
                          }}
                        >
                          {row.precioPct > 0 ? "+" : ""}
                          {row.precioPct}%
                          {row.precioPct === 0 ? " (base)" : ""}
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            color: "#aaa",
                          }}
                        >
                          {fmtARS(row.precioVenta)}
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            color: row.van >= 0 ? "#22c55e" : "#ef4444",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          {fmtARS(row.van)}
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            color:
                              row.tir !== null &&
                              row.tir > tasaDescuento
                                ? "#22c55e"
                                : "#ef4444",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          {fmtPct(row.tir)}
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            color:
                              row.payback >= 0 ? "#f59e0b" : "#cc0000",
                          }}
                        >
                          {fmtMeses(row.payback)}
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 12,
                              background: row.viable
                                ? "rgba(34,197,94,0.15)"
                                : "rgba(204,0,0,0.15)",
                              color: row.viable ? "#22c55e" : "#cc0000",
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            {row.viable ? "Sí" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Punto de equilibrio */}
            <div style={card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  margin: "0 0 14px",
                  textTransform: "uppercase",
                }}
              >
                Punto de equilibrio
              </h2>
              <p style={{ fontSize: 13, color: "#888", margin: "0 0 12px" }}>
                {tipo === "desarrollo"
                  ? "Ingreso mínimo de ventas"
                  : tipo === "custom"
                  ? "Factor mínimo de ingresos"
                  : "Precio mínimo de venta"}{" "}
                para que el VAN sea igual a cero (a tasa{" "}
                {tasaDescuento}% anual):
              </p>
              {puntoEquilibrio !== null ? (
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 32,
                    color: "#f59e0b",
                  }}
                >
                  {fmtARS(puntoEquilibrio)}
                  {(tipo === "compraventa" || tipo === "alquiler") && (
                    <span
                      style={{
                        fontSize: 14,
                        color: "#888",
                        fontWeight: 400,
                        marginLeft: 8,
                      }}
                    >
                      USD
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ color: "#666", fontSize: 14 }}>
                  No calculable para este tipo de proyecto
                </div>
              )}

              {/* Comparación con base */}
              {puntoEquilibrio !== null && tipo === "compraventa" && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
                  Precio base:{" "}
                  <span style={{ color: "#fff" }}>
                    USD {cv.valorVenta.toLocaleString("es-AR")}
                  </span>{" "}
                  — Margen de seguridad:{" "}
                  <span
                    style={{
                      color:
                        cv.valorVenta > puntoEquilibrio
                          ? "#22c55e"
                          : "#cc0000",
                      fontWeight: 700,
                    }}
                  >
                    {(
                      ((cv.valorVenta - puntoEquilibrio) / cv.valorVenta) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
              {puntoEquilibrio !== null && tipo === "alquiler" && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
                  Precio base (año 5):{" "}
                  <span style={{ color: "#fff" }}>
                    USD {alq.valorVenta.toLocaleString("es-AR")}
                  </span>{" "}
                  — Margen de seguridad:{" "}
                  <span
                    style={{
                      color:
                        alq.valorVenta > puntoEquilibrio
                          ? "#22c55e"
                          : "#cc0000",
                      fontWeight: 700,
                    }}
                  >
                    {(
                      ((alq.valorVenta - puntoEquilibrio) / alq.valorVenta) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
              {puntoEquilibrio !== null && tipo === "desarrollo" && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
                  Ingresos proyectados:{" "}
                  <span style={{ color: "#fff" }}>
                    USD{" "}
                    {des.ingresoTotalVentas.toLocaleString("es-AR")}
                  </span>{" "}
                  — Margen de seguridad:{" "}
                  <span
                    style={{
                      color:
                        des.ingresoTotalVentas > puntoEquilibrio
                          ? "#22c55e"
                          : "#cc0000",
                      fontWeight: 700,
                    }}
                  >
                    {(
                      ((des.ingresoTotalVentas - puntoEquilibrio) /
                        des.ingresoTotalVentas) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
            </div>

            {/* Mini KPIs resumen */}
            <div style={card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  margin: "0 0 14px",
                  textTransform: "uppercase",
                }}
              >
                Resumen (escenario base)
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    background: "#0d0d0d",
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <div style={label}>Total invertido</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      color: "#ef4444",
                    }}
                  >
                    {fmtARS(resultados.totalInversion)}
                  </div>
                </div>
                <div
                  style={{
                    background: "#0d0d0d",
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <div style={label}>Total cobrado</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      color: "#22c55e",
                    }}
                  >
                    {fmtARS(resultados.totalIngresos)}
                  </div>
                </div>
                <div
                  style={{
                    background: "#0d0d0d",
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <div style={label}>Ganancia bruta</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      color:
                        resultados.totalIngresos - resultados.totalInversion >= 0
                          ? "#22c55e"
                          : "#ef4444",
                    }}
                  >
                    {fmtARS(
                      resultados.totalIngresos - resultados.totalInversion
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
