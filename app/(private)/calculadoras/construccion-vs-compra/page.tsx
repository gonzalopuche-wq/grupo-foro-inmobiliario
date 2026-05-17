"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ResultadoConstruir {
  costoObra: number;
  costoObraConImprevistos: number;
  gastosLegalesTerreno: number;
  alquilerObraUSD: number;
  inversionTotalUSD: number;
  costoM2Resultante: number;
  valorFinal10: number;
  gananciaCapital10: number;
  roi10: number;
}

interface ResultadoComprar {
  gastosCompraUSD: number;
  refaccionesUSD: number;
  inversionTotalUSD: number;
  costoM2Resultante: number;
  valorFinal10: number;
  gananciaCapital10: number;
  roi10: number;
}

interface ProyeccionAnio {
  anio: number;
  valorConstruida: number;
  valorComprada: number;
  diferencia: number;
}

// ── Estilos reutilizables ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#fff",
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  fontFamily: "Inter, sans-serif",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
  display: "block",
};

const panelStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 12,
  padding: "20px 24px",
};

const sectionStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 10,
  padding: "20px 24px",
};

// ── Subcomponentes ────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        value={value}
        step={step ?? 1}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        style={inputStyle}
      />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConstruccionVsCompra() {
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // Opción A — Construir
  const [costoTerreno, setCostoTerreno] = useState(40000);
  const [costoM2Construccion, setCostoM2Construccion] = useState(800);
  const [superficieM2, setSuperficieM2] = useState(100);
  const [mesesObra, setMesesObra] = useState(18);
  const [imprevistos, setImprevistos] = useState(15);
  const [gastosLegales, setGastosLegales] = useState(5);
  const [alquilerDuranteObra, setAlquilerDuranteObra] = useState(200000);
  const [tipoCambio, setTipoCambio] = useState(1300);

  // Opción B — Comprar
  const [precioCompra, setPrecioCompra] = useState(90000);
  const [gastosCompra, setGastosCompra] = useState(7.5);
  const [necesitaRefacciones, setNecesitaRefacciones] = useState(false);
  const [costoRefacciones, setCostoRefacciones] = useState(0);

  // Proyección común
  const [apreciacionAnual, setApreciacionAnual] = useState(3);
  const [inflacionAnual, setInflacionAnual] = useState(80);

  // ── Cálculos ───────────────────────────────────────────────────────────────

  const resultadoConstruir = useMemo<ResultadoConstruir>(() => {
    const costoObra = costoM2Construccion * superficieM2;
    const costoObraConImprevistos = costoObra * (1 + imprevistos / 100);
    const gastosLegalesTerreno = costoTerreno * (gastosLegales / 100);
    const alquilerObraARS = alquilerDuranteObra * mesesObra;
    const alquilerObraUSD = alquilerObraARS / tipoCambio;

    const inversionTotalUSD =
      costoTerreno +
      costoObraConImprevistos +
      gastosLegalesTerreno +
      alquilerObraUSD;
    const costoM2Resultante =
      superficieM2 > 0 ? inversionTotalUSD / superficieM2 : 0;

    const valorFinal10 =
      inversionTotalUSD * Math.pow(1 + apreciacionAnual / 100, 10);
    const gananciaCapital10 = valorFinal10 - inversionTotalUSD;
    const roi10 =
      inversionTotalUSD > 0
        ? (gananciaCapital10 / inversionTotalUSD) * 100
        : 0;

    return {
      costoObra,
      costoObraConImprevistos,
      gastosLegalesTerreno,
      alquilerObraUSD,
      inversionTotalUSD,
      costoM2Resultante,
      valorFinal10,
      gananciaCapital10,
      roi10,
    };
  }, [
    costoTerreno,
    costoM2Construccion,
    superficieM2,
    mesesObra,
    imprevistos,
    gastosLegales,
    alquilerDuranteObra,
    tipoCambio,
    apreciacionAnual,
  ]);

  const resultadoComprar = useMemo<ResultadoComprar>(() => {
    const gastosCompraUSD = precioCompra * (gastosCompra / 100);
    const refaccionesUSD = necesitaRefacciones ? costoRefacciones : 0;
    const inversionTotalUSD = precioCompra + gastosCompraUSD + refaccionesUSD;
    const costoM2Resultante =
      superficieM2 > 0 ? inversionTotalUSD / superficieM2 : 0;

    const valorFinal10 =
      inversionTotalUSD * Math.pow(1 + apreciacionAnual / 100, 10);
    const gananciaCapital10 = valorFinal10 - inversionTotalUSD;
    const roi10 =
      inversionTotalUSD > 0
        ? (gananciaCapital10 / inversionTotalUSD) * 100
        : 0;

    return {
      gastosCompraUSD,
      refaccionesUSD,
      inversionTotalUSD,
      costoM2Resultante,
      valorFinal10,
      gananciaCapital10,
      roi10,
    };
  }, [
    precioCompra,
    gastosCompra,
    necesitaRefacciones,
    costoRefacciones,
    superficieM2,
    apreciacionAnual,
  ]);

  const proyeccion = useMemo<ProyeccionAnio[]>(() => {
    return Array.from({ length: 11 }, (_, i) => {
      const valorConstruida =
        resultadoConstruir.inversionTotalUSD *
        Math.pow(1 + apreciacionAnual / 100, i);
      const valorComprada =
        resultadoComprar.inversionTotalUSD *
        Math.pow(1 + apreciacionAnual / 100, i);
      return {
        anio: i,
        valorConstruida,
        valorComprada,
        diferencia: valorConstruida - valorComprada,
      };
    });
  }, [
    resultadoConstruir.inversionTotalUSD,
    resultadoComprar.inversionTotalUSD,
    apreciacionAnual,
  ]);

  // ── Diferencia ─────────────────────────────────────────────────────────────
  const construirEsMasBarato =
    resultadoConstruir.inversionTotalUSD <= resultadoComprar.inversionTotalUSD;
  const diferencia = Math.abs(
    resultadoConstruir.inversionTotalUSD - resultadoComprar.inversionTotalUSD
  );
  const pctDiferencia =
    Math.max(
      resultadoConstruir.inversionTotalUSD,
      resultadoComprar.inversionTotalUSD
    ) > 0
      ? (diferencia /
          Math.max(
            resultadoConstruir.inversionTotalUSD,
            resultadoComprar.inversionTotalUSD
          )) *
        100
      : 0;

  // ── Formateo ───────────────────────────────────────────────────────────────
  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const fmtUSD = (n: number) => `USD ${fmt(Math.round(n))}`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  // ── SVG Waterfall ──────────────────────────────────────────────────────────
  const waterfallW = 600;
  const waterfallH = 240;
  const waterfallPad = { top: 20, bottom: 30, left: 50, right: 20 };
  const innerW = waterfallW - waterfallPad.left - waterfallPad.right;
  const innerH = waterfallH - waterfallPad.top - waterfallPad.bottom;

  const conceptosConstruir = [
    { label: "Terreno", val: costoTerreno },
    { label: "Obra", val: resultadoConstruir.costoObraConImprevistos },
    { label: "Gastos leg.", val: resultadoConstruir.gastosLegalesTerreno },
    { label: "Alquiler obra", val: resultadoConstruir.alquilerObraUSD },
    { label: "Total", val: resultadoConstruir.inversionTotalUSD },
  ];

  const conceptosComprar = [
    { label: "Precio", val: precioCompra },
    { label: "Gastos comp.", val: resultadoComprar.gastosCompraUSD },
    { label: "Refacciones", val: resultadoComprar.refaccionesUSD },
    { label: "", val: 0 },
    { label: "Total", val: resultadoComprar.inversionTotalUSD },
  ];

  const maxWaterfall = Math.max(
    ...conceptosConstruir.map((c) => c.val),
    ...conceptosComprar.map((c) => c.val),
    1
  );

  const barW = innerW / 12;
  const barGap = barW * 0.3;

  function buildWaterfallBar(
    vals: { label: string; val: number }[],
    color: string,
    offsetX: number
  ) {
    return vals.map((item, i) => {
      if (item.val === 0 && item.label === "") return null;
      const barHeight = (item.val / maxWaterfall) * innerH;
      const x = waterfallPad.left + offsetX + i * (barW * 2 + barGap);
      const y = waterfallPad.top + innerH - barHeight;
      const isTotal = i === vals.length - 1;
      return (
        <g key={`${color}-${i}`}>
          <rect
            x={x}
            y={y}
            width={barW}
            height={barHeight}
            fill={isTotal ? color : `${color}99`}
            rx={3}
          />
          <text
            x={x + barW / 2}
            y={waterfallPad.top + innerH + 14}
            fill="#888"
            fontSize={8}
            textAnchor="middle"
          >
            {item.label}
          </text>
          {item.val > 0 && (
            <text
              x={x + barW / 2}
              y={y - 4}
              fill={isTotal ? color : "#aaa"}
              fontSize={8}
              textAnchor="middle"
            >
              {`${Math.round(item.val / 1000)}k`}
            </text>
          )}
        </g>
      );
    });
  }

  // ── SVG Line chart ─────────────────────────────────────────────────────────
  const lineW = 860;
  const lineH = 280;
  const linePad = { top: 24, bottom: 36, left: 70, right: 24 };
  const lineInnerW = lineW - linePad.left - linePad.right;
  const lineInnerH = lineH - linePad.top - linePad.bottom;

  const allVals = proyeccion.flatMap((p) => [p.valorConstruida, p.valorComprada]);
  const maxLine = Math.max(...allVals, 1);
  const minLine = Math.min(...allVals, 0);
  const lineRange = maxLine - minLine || 1;

  function toLineX(anio: number) {
    return linePad.left + (anio / 10) * lineInnerW;
  }
  function toLineY(val: number) {
    return linePad.top + lineInnerH - ((val - minLine) / lineRange) * lineInnerH;
  }

  const pathConstruir = proyeccion
    .map((p, i) => `${i === 0 ? "M" : "L"}${toLineX(p.anio).toFixed(1)},${toLineY(p.valorConstruida).toFixed(1)}`)
    .join(" ");

  const pathComprar = proyeccion
    .map((p, i) => `${i === 0 ? "M" : "L"}${toLineX(p.anio).toFixed(1)},${toLineY(p.valorComprada).toFixed(1)}`)
    .join(" ");

  // Punto de cruce: buscar entre años consecutivos
  let crucePunto: { x: number; y: number } | null = null;
  for (let i = 0; i < proyeccion.length - 1; i++) {
    const p1 = proyeccion[i];
    const p2 = proyeccion[i + 1];
    const d1 = p1.valorConstruida - p1.valorComprada;
    const d2 = p2.valorConstruida - p2.valorComprada;
    if (d1 !== 0 && d2 !== 0 && Math.sign(d1) !== Math.sign(d2)) {
      const t = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
      const anioFrac = i + t;
      const valFrac =
        p1.valorConstruida + t * (p2.valorConstruida - p1.valorConstruida);
      crucePunto = { x: toLineX(anioFrac), y: toLineY(valFrac) };
    }
  }

  // ── Tabs UI ────────────────────────────────────────────────────────────────
  const tabs = ["Configurar", "Comparar", "Proyección 10 años"];

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
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 22,
              color: "#fff",
            }}
          >
            Construir vs. Comprar
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            ¿Conviene construir una casa o comprar una ya construida? Comparación
            a 10 años.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          background: "#111",
          borderBottom: "1px solid #222",
          padding: "0 24px",
          display: "flex",
          gap: 0,
        }}
      >
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i as 0 | 1 | 2)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === i ? "2px solid #cc0000" : "2px solid transparent",
              color: tab === i ? "#fff" : "#666",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "14px 20px",
              cursor: "pointer",
              transition: "color 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* ── TAB 0: Configurar ─────────────────────────────────────── */}
        {tab === 0 && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
                alignItems: "start",
              }}
            >
              {/* Panel A — Construir */}
              <div style={{ ...panelStyle, borderColor: "#cc000044" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span
                    style={{
                      background: "#cc0000",
                      color: "#fff",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 20,
                      letterSpacing: "0.05em",
                    }}
                  >
                    OPCIÓN A
                  </span>
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 15,
                      color: "#fff",
                    }}
                  >
                    Construir
                  </h2>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field
                    label="Costo terreno (USD)"
                    value={costoTerreno}
                    onChange={setCostoTerreno}
                  />
                  <Field
                    label="Costo construcción x m² (USD)"
                    value={costoM2Construccion}
                    onChange={setCostoM2Construccion}
                  />
                  <Field
                    label="Superficie (m²)"
                    value={superficieM2}
                    onChange={setSuperficieM2}
                    min={1}
                  />
                  <Field
                    label="Duración obra (meses)"
                    value={mesesObra}
                    onChange={setMesesObra}
                    min={1}
                  />
                  <Field
                    label="Imprevistos (% sobre obra)"
                    value={imprevistos}
                    onChange={setImprevistos}
                    step={0.5}
                    min={0}
                  />
                  <Field
                    label="Gastos legales (% del terreno)"
                    value={gastosLegales}
                    onChange={setGastosLegales}
                    step={0.5}
                    min={0}
                  />
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field
                      label="Alquiler durante obra (ARS/mes)"
                      value={alquilerDuranteObra}
                      onChange={setAlquilerDuranteObra}
                    />
                  </div>
                </div>
              </div>

              {/* Panel B — Comprar */}
              <div style={{ ...panelStyle, borderColor: "#3b82f644" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span
                    style={{
                      background: "#3b82f6",
                      color: "#fff",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 20,
                      letterSpacing: "0.05em",
                    }}
                  >
                    OPCIÓN B
                  </span>
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 15,
                      color: "#fff",
                    }}
                  >
                    Comprar
                  </h2>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field
                    label="Precio de compra (USD)"
                    value={precioCompra}
                    onChange={setPrecioCompra}
                  />
                  <Field
                    label="Gastos de compra (%)"
                    value={gastosCompra}
                    onChange={setGastosCompra}
                    step={0.5}
                    min={0}
                  />
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>¿Necesita refacciones?</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          onClick={() => setNecesitaRefacciones(v)}
                          style={{
                            background: necesitaRefacciones === v ? (v ? "#3b82f6" : "#333") : "#1a1a1a",
                            border: `1px solid ${necesitaRefacciones === v ? (v ? "#3b82f6" : "#555") : "#333"}`,
                            borderRadius: 6,
                            color: "#fff",
                            padding: "8px 16px",
                            fontSize: 12,
                            fontFamily: "Inter, sans-serif",
                            cursor: "pointer",
                          }}
                        >
                          {v ? "Sí" : "No"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {necesitaRefacciones && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Field
                        label="Costo refacciones (USD)"
                        value={costoRefacciones}
                        onChange={setCostoRefacciones}
                        min={0}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs comunes */}
            <div style={sectionStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 12,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Parámetros compartidos
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 16,
                }}
              >
                <Field
                  label="Tipo de cambio (ARS/USD)"
                  value={tipoCambio}
                  onChange={setTipoCambio}
                  min={1}
                />
                <Field
                  label="Apreciación anual inmuebles (% USD)"
                  value={apreciacionAnual}
                  onChange={setApreciacionAnual}
                  step={0.5}
                />
                <Field
                  label="Inflación anual (%)"
                  value={inflacionAnual}
                  onChange={setInflacionAnual}
                  step={1}
                />
              </div>
            </div>

            {/* KPIs rápidos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div
                style={{
                  background: "#cc000010",
                  border: "1px solid #cc000033",
                  borderRadius: 10,
                  padding: "16px 20px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#cc0000",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Inversión total — Construir
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {fmtUSD(resultadoConstruir.inversionTotalUSD)}
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  {fmtUSD(resultadoConstruir.costoM2Resultante)} / m²
                </div>
              </div>
              <div
                style={{
                  background: "#3b82f610",
                  border: "1px solid #3b82f633",
                  borderRadius: 10,
                  padding: "16px 20px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#3b82f6",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Inversión total — Comprar
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {fmtUSD(resultadoComprar.inversionTotalUSD)}
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  {fmtUSD(resultadoComprar.costoM2Resultante)} / m²
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── TAB 1: Comparar ──────────────────────────────────────── */}
        {tab === 1 && (
          <>
            {/* Badge ganador */}
            <div
              style={{
                background: "#22c55e14",
                border: "2px solid #22c55e",
                borderRadius: 12,
                padding: "20px 28px",
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div
                style={{
                  background: "#22c55e",
                  color: "#000",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  padding: "6px 18px",
                  borderRadius: 20,
                  whiteSpace: "nowrap",
                }}
              >
                {construirEsMasBarato ? "Construir" : "Comprar"} es {fmtPct(pctDiferencia)} más barato
              </div>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    color: "#22c55e",
                  }}
                >
                  {construirEsMasBarato
                    ? "Construir tiene menor inversión inicial"
                    : "Comprar tiene menor inversión inicial"}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  Diferencia de {fmtUSD(diferencia)} entre ambas opciones
                </div>
              </div>
            </div>

            {/* Tabla comparativa */}
            <div style={sectionStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Tabla comparativa
              </h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        color: "#666",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: "uppercase",
                        borderBottom: "1px solid #222",
                      }}
                    >
                      Concepto
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "10px 12px",
                        color: "#cc0000",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: "uppercase",
                        borderBottom: "1px solid #222",
                      }}
                    >
                      Construir
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "10px 12px",
                        color: "#3b82f6",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: "uppercase",
                        borderBottom: "1px solid #222",
                      }}
                    >
                      Comprar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "Inversión base",
                      a: fmtUSD(costoTerreno + resultadoConstruir.costoObra),
                      b: fmtUSD(precioCompra),
                    },
                    {
                      label: "Gastos adicionales",
                      a: fmtUSD(
                        resultadoConstruir.gastosLegalesTerreno +
                          resultadoConstruir.alquilerObraUSD +
                          (resultadoConstruir.costoObraConImprevistos -
                            resultadoConstruir.costoObra)
                      ),
                      b: fmtUSD(
                        resultadoComprar.gastosCompraUSD +
                          resultadoComprar.refaccionesUSD
                      ),
                    },
                    {
                      label: "Total invertido",
                      a: fmtUSD(resultadoConstruir.inversionTotalUSD),
                      b: fmtUSD(resultadoComprar.inversionTotalUSD),
                      bold: true,
                    },
                    {
                      label: `Costo por m² (${superficieM2} m²)`,
                      a: fmtUSD(resultadoConstruir.costoM2Resultante),
                      b: fmtUSD(resultadoComprar.costoM2Resultante),
                    },
                    {
                      label: "Valor en 10 años",
                      a: fmtUSD(resultadoConstruir.valorFinal10),
                      b: fmtUSD(resultadoComprar.valorFinal10),
                    },
                    {
                      label: "Ganancia de capital",
                      a: fmtUSD(resultadoConstruir.gananciaCapital10),
                      b: fmtUSD(resultadoComprar.gananciaCapital10),
                    },
                    {
                      label: "ROI 10 años",
                      a: fmtPct(resultadoConstruir.roi10),
                      b: fmtPct(resultadoComprar.roi10),
                    },
                    {
                      label: "Mejor opción",
                      a: construirEsMasBarato ? "✓" : "—",
                      b: !construirEsMasBarato ? "✓" : "—",
                      isBest: true,
                    },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        background: i % 2 === 0 ? "transparent" : "#ffffff05",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          color: "#aaa",
                          fontWeight: row.bold ? 700 : 400,
                          borderBottom: "1px solid #1a1a1a",
                        }}
                      >
                        {row.label}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          color:
                            row.isBest
                              ? row.a === "✓"
                                ? "#22c55e"
                                : "#444"
                              : row.bold
                              ? "#fff"
                              : "#ccc",
                          fontWeight: row.bold || row.isBest ? 700 : 400,
                          fontSize: row.isBest ? 16 : 13,
                          borderBottom: "1px solid #1a1a1a",
                        }}
                      >
                        {row.a}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          color:
                            row.isBest
                              ? row.b === "✓"
                                ? "#22c55e"
                                : "#444"
                              : row.bold
                              ? "#fff"
                              : "#ccc",
                          fontWeight: row.bold || row.isBest ? 700 : 400,
                          fontSize: row.isBest ? 16 : 13,
                          borderBottom: "1px solid #1a1a1a",
                        }}
                      >
                        {row.b}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SVG Waterfall doble */}
            <div style={sectionStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Desglose de costos
              </h2>
              <svg
                width="100%"
                viewBox={`0 0 ${waterfallW} ${waterfallH}`}
                style={{ overflow: "visible" }}
              >
                {/* Eje Y guías */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const y = waterfallPad.top + innerH - pct * innerH;
                  return (
                    <g key={pct}>
                      <line
                        x1={waterfallPad.left}
                        y1={y}
                        x2={waterfallW - waterfallPad.right}
                        y2={y}
                        stroke="#1a1a1a"
                        strokeWidth={1}
                      />
                      <text
                        x={waterfallPad.left - 6}
                        y={y + 4}
                        fill="#555"
                        fontSize={8}
                        textAnchor="end"
                      >
                        {`${Math.round((pct * maxWaterfall) / 1000)}k`}
                      </text>
                    </g>
                  );
                })}

                {/* Eje base */}
                <line
                  x1={waterfallPad.left}
                  y1={waterfallPad.top + innerH}
                  x2={waterfallW - waterfallPad.right}
                  y2={waterfallPad.top + innerH}
                  stroke="#333"
                  strokeWidth={1}
                />

                {/* Barras Construir (izq) */}
                {buildWaterfallBar(conceptosConstruir, "#cc0000", 0)}

                {/* Barras Comprar (der) */}
                {buildWaterfallBar(
                  conceptosComprar,
                  "#3b82f6",
                  barW + barGap
                )}
              </svg>

              <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
                {[
                  { color: "#cc0000", label: "Construir" },
                  { color: "#3b82f6", label: "Comprar" },
                ].map((l) => (
                  <div
                    key={l.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "#888",
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 10,
                        background: l.color,
                        borderRadius: 2,
                      }}
                    />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── TAB 2: Proyección 10 años ─────────────────────────────── */}
        {tab === 2 && (
          <>
            {/* Line chart */}
            <div style={sectionStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Valor del activo — Años 0 a 10
              </h2>
              <svg
                width="100%"
                viewBox={`0 0 ${lineW} ${lineH}`}
                style={{ overflow: "visible" }}
              >
                {/* Guías horizontales */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const val = minLine + pct * lineRange;
                  const y = toLineY(val);
                  return (
                    <g key={pct}>
                      <line
                        x1={linePad.left}
                        y1={y}
                        x2={lineW - linePad.right}
                        y2={y}
                        stroke="#1a1a1a"
                        strokeWidth={1}
                      />
                      <text
                        x={linePad.left - 8}
                        y={y + 4}
                        fill="#555"
                        fontSize={9}
                        textAnchor="end"
                      >
                        {`${Math.round(val / 1000)}k`}
                      </text>
                    </g>
                  );
                })}

                {/* Eje X — años */}
                {Array.from({ length: 11 }, (_, i) => (
                  <g key={i}>
                    <line
                      x1={toLineX(i)}
                      y1={linePad.top + lineInnerH}
                      x2={toLineX(i)}
                      y2={linePad.top + lineInnerH + 5}
                      stroke="#333"
                      strokeWidth={1}
                    />
                    <text
                      x={toLineX(i)}
                      y={linePad.top + lineInnerH + 16}
                      fill="#555"
                      fontSize={9}
                      textAnchor="middle"
                    >
                      {i === 0 ? "Hoy" : `Año ${i}`}
                    </text>
                  </g>
                ))}

                {/* Línea eje X */}
                <line
                  x1={linePad.left}
                  y1={linePad.top + lineInnerH}
                  x2={lineW - linePad.right}
                  y2={linePad.top + lineInnerH}
                  stroke="#333"
                  strokeWidth={1}
                />

                {/* Línea Comprar (azul) — detrás */}
                <path
                  d={pathComprar}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />

                {/* Línea Construir (roja) — delante */}
                <path
                  d={pathConstruir}
                  fill="none"
                  stroke="#cc0000"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />

                {/* Puntos iniciales */}
                <circle
                  cx={toLineX(0)}
                  cy={toLineY(resultadoConstruir.inversionTotalUSD)}
                  r={5}
                  fill="#cc0000"
                />
                <circle
                  cx={toLineX(0)}
                  cy={toLineY(resultadoComprar.inversionTotalUSD)}
                  r={5}
                  fill="#3b82f6"
                />

                {/* Puntos finales */}
                <circle
                  cx={toLineX(10)}
                  cy={toLineY(resultadoConstruir.valorFinal10)}
                  r={5}
                  fill="#cc0000"
                />
                <circle
                  cx={toLineX(10)}
                  cy={toLineY(resultadoComprar.valorFinal10)}
                  r={5}
                  fill="#3b82f6"
                />

                {/* Punto de cruce */}
                {crucePunto !== null && (
                  <>
                    <circle
                      cx={crucePunto.x}
                      cy={crucePunto.y}
                      r={6}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth={2}
                    />
                    <text
                      x={crucePunto.x + 10}
                      y={crucePunto.y - 6}
                      fill="#22c55e"
                      fontSize={9}
                    >
                      Cruce
                    </text>
                  </>
                )}
              </svg>

              <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
                {[
                  { color: "#cc0000", label: "Construir — valor del activo" },
                  { color: "#3b82f6", label: "Comprar — valor del activo" },
                  ...(crucePunto !== null
                    ? [{ color: "#22c55e", label: "Punto de cruce" }]
                    : []),
                ].map((l) => (
                  <div
                    key={l.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "#888",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 3,
                        background: l.color,
                        borderRadius: 2,
                      }}
                    />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Tabla proyección anual */}
            <div style={sectionStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Tabla año a año
              </h2>
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
              >
                <thead>
                  <tr>
                    {["Año", "Valor construida", "Valor comprada", "Diferencia"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === "Año" ? "left" : "right",
                            padding: "10px 12px",
                            color: "#666",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            fontSize: 11,
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
                  {proyeccion.map((p, i) => {
                    const construirGana = p.diferencia > 0;
                    return (
                      <tr
                        key={i}
                        style={{
                          background: i % 2 === 0 ? "transparent" : "#ffffff05",
                        }}
                      >
                        <td
                          style={{
                            padding: "9px 12px",
                            color: "#888",
                            borderBottom: "1px solid #1a1a1a",
                          }}
                        >
                          {p.anio === 0 ? "Hoy" : `Año ${p.anio}`}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            color: "#cc0000",
                            borderBottom: "1px solid #1a1a1a",
                          }}
                        >
                          {fmtUSD(p.valorConstruida)}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            color: "#3b82f6",
                            borderBottom: "1px solid #1a1a1a",
                          }}
                        >
                          {fmtUSD(p.valorComprada)}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            color:
                              Math.abs(p.diferencia) < 100
                                ? "#666"
                                : construirGana
                                ? "#cc0000"
                                : "#3b82f6",
                            borderBottom: "1px solid #1a1a1a",
                          }}
                        >
                          {Math.abs(p.diferencia) < 100
                            ? "—"
                            : `${construirGana ? "Constr. +" : "Compra +"}${fmtUSD(Math.abs(p.diferencia))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div
                style={{
                  fontSize: 11,
                  color: "#555",
                  marginTop: 10,
                  lineHeight: 1.5,
                }}
              >
                * Nota: ambas opciones tienen el mismo factor de apreciación ({apreciacionAnual}%/año). La diferencia de valor a lo largo del tiempo
                refleja la brecha de inversión inicial, no cambios en la apreciación.
              </div>
            </div>

            {/* Consideraciones adicionales */}
            <div
              style={{
                background: "#111",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
                padding: "18px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 12,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Consideraciones adicionales
              </h3>
              {[
                `El tiempo de obra (${mesesObra} meses) implica pagar alquiler y esperar para habitar la propiedad.`,
                "Construir permite personalizar cada detalle del inmueble, pero tiene mayor incertidumbre de costos por imprevistos y variaciones de materiales.",
                "Comprar da certeza de precio y disponibilidad inmediata, pero puede requerir refacciones y ajustes a gusto del comprador.",
                `La inflación estimada del ${inflacionAnual}% anual impacta principalmente en los costos de construcción en pesos.`,
                "Esta calculadora compara inversiones iniciales; no considera gastos operativos posteriores (expensas, impuestos, mantenimiento).",
              ].map((txt, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 12,
                    color: "#666",
                    lineHeight: 1.6,
                  }}
                >
                  <span style={{ color: "#cc0000", flexShrink: 0, marginTop: 2 }}>
                    •
                  </span>
                  {txt}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
