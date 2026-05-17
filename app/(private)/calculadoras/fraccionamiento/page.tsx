"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ─── Formatters ─────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}
function usd(n: number): string {
  return `USD ${fmt(Math.round(n))}`;
}
function m2(n: number): string {
  return `${fmt(n, 1)} m²`;
}
function pctFmt(n: number, d = 1): string {
  return `${n.toFixed(d)}%`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PrecioPorUbicacion {
  frente: number;
  interior: number;
  esquina: number;
  fondo: number;
}

interface DistribucionLotes {
  frentes: number;
  esquinas: number;
  interiores: number;
  fondos: number;
}

interface Calcs {
  superficieVendible: number;
  cantidadLotes: number;
  superficieRealPorLote: number;
  ingresosBrutos: number;
  costoTotal: number;
  gastosVenta: number;
  utilidadBruta: number;
  rentabilidad: number;
  pmTerrenoIncluido: number;
  distribucion: DistribucionLotes;
  precioPonderado: number;
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#111",
  border: "1px solid #1f2937",
  borderRadius: 10,
  padding: 16,
};

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#e5e5e5",
  padding: "5px 8px",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  display: "block",
  marginBottom: 2,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  fontSize: 11,
  color: "#9ca3af",
  letterSpacing: "0.1em",
  marginBottom: 12,
  textTransform: "uppercase",
};

// ─── Main component ──────────────────────────────────────────────────────────

export default function FraccionamientoPage() {
  // ── Inputs
  const [superficieTotal, setSuperficieTotal] = useState(10000);
  const [costoTerreno, setCostoTerreno] = useState(500000);
  const [porcentajeCalles, setPorcentajeCalles] = useState(15);
  const [porcentajeEspaciosVerdes, setPorcentajeEspaciosVerdes] = useState(5);
  const [porcentajeLoteMin, setPorcentajeLoteMin] = useState(0);
  const [superficieLoteMin, setSuperficieLoteMin] = useState(300);
  const [superficieLoteMax, setSuperficieLoteMax] = useState(600);
  const [superficieLoteObj, setSuperficieLoteObj] = useState(400);
  const [precioVentaPorM2, setPrecioVentaPorM2] = useState(150);
  const [costoInfraestructura, setCostoInfraestructura] = useState(50000);
  const [costoHonorarios, setCostoHonorarios] = useState(15000);
  const [gastosVentaPct, setGastosVentaPct] = useState(3.5);
  const [precioVariableSegunUbic, setPrecioVariableSegunUbic] = useState(false);
  const [precioPorUbicacion, setPrecioPorUbicacion] = useState<PrecioPorUbicacion>({
    frente: 150,
    interior: 130,
    esquina: 170,
    fondo: 120,
  });

  const [activeTab, setActiveTab] = useState<"resumen" | "distribucion" | "sensibilidad">("resumen");

  // ── Calculations
  const calcs = useMemo<Calcs>(() => {
    const superficieVendible =
      superficieTotal *
      (1 - porcentajeCalles / 100 - porcentajeEspaciosVerdes / 100 - porcentajeLoteMin / 100);

    const rawLotes = superficieVendible / Math.max(superficieLoteObj, 1);
    const cantidadLotes = Math.max(0, Math.floor(rawLotes));
    const superficieRealPorLote = cantidadLotes > 0 ? superficieVendible / cantidadLotes : 0;

    const distribucion: DistribucionLotes = {
      frentes: Math.round(cantidadLotes * 0.3),
      esquinas: Math.round(cantidadLotes * 0.2),
      interiores: Math.round(cantidadLotes * 0.35),
      fondos: Math.round(cantidadLotes * 0.15),
    };

    let ingresosBrutos: number;
    let precioPonderado: number;

    if (precioVariableSegunUbic) {
      const totalPonderado =
        distribucion.frentes * precioPorUbicacion.frente * superficieRealPorLote +
        distribucion.esquinas * precioPorUbicacion.esquina * superficieRealPorLote +
        distribucion.interiores * precioPorUbicacion.interior * superficieRealPorLote +
        distribucion.fondos * precioPorUbicacion.fondo * superficieRealPorLote;
      ingresosBrutos = totalPonderado;
      precioPonderado =
        cantidadLotes > 0 && superficieRealPorLote > 0
          ? ingresosBrutos / (cantidadLotes * superficieRealPorLote)
          : precioVentaPorM2;
    } else {
      ingresosBrutos = cantidadLotes * superficieRealPorLote * precioVentaPorM2;
      precioPonderado = precioVentaPorM2;
    }

    const costoTotal = costoTerreno + costoInfraestructura + costoHonorarios;
    const gastosVenta = ingresosBrutos * (gastosVentaPct / 100);
    const utilidadBruta = ingresosBrutos - gastosVenta - costoTotal;
    const rentabilidad = costoTotal > 0 ? (utilidadBruta / costoTotal) * 100 : 0;
    const pmTerrenoIncluido =
      cantidadLotes > 0 && superficieRealPorLote > 0
        ? costoTotal / (cantidadLotes * superficieRealPorLote)
        : 0;

    return {
      superficieVendible,
      cantidadLotes,
      superficieRealPorLote,
      ingresosBrutos,
      costoTotal,
      gastosVenta,
      utilidadBruta,
      rentabilidad,
      pmTerrenoIncluido,
      distribucion,
      precioPonderado,
    };
  }, [
    superficieTotal,
    costoTerreno,
    porcentajeCalles,
    porcentajeEspaciosVerdes,
    porcentajeLoteMin,
    superficieLoteObj,
    precioVentaPorM2,
    costoInfraestructura,
    costoHonorarios,
    gastosVentaPct,
    precioVariableSegunUbic,
    precioPorUbicacion,
  ]);

  // ── Sensitivity matrix data
  const sensibilidadData = useMemo(() => {
    const baseLotes = calcs.cantidadLotes;
    const basePrec = calcs.precioPonderado;
    const variaciones = [-20, -15, -10, -5, 0, 5, 10, 15, 20];

    const lotesVariados = variaciones.map((v) =>
      Math.max(0, Math.round(baseLotes * (1 + v / 100)))
    );
    const preciosVariados = variaciones.map((v) =>
      Math.max(0, basePrec * (1 + v / 100))
    );

    return variaciones.map((yVar, yi) => {
      const lotes = lotesVariados[yi];
      return preciosVariados.map((precio) => {
        const sup = calcs.superficieRealPorLote;
        const ing = lotes * sup * precio;
        const gv = ing * (gastosVentaPct / 100);
        return ing - gv - calcs.costoTotal;
      });
    });
  }, [calcs, gastosVentaPct]);

  const sensiVariaciones = [-20, -15, -10, -5, 0, 5, 10, 15, 20];

  // ── PDF Export
  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = [
      ["Terreno", usd(costoTerreno), pctFmt((costoTerreno / calcs.costoTotal) * 100)],
      ["Infraestructura", usd(costoInfraestructura), pctFmt((costoInfraestructura / calcs.costoTotal) * 100)],
      ["Honorarios", usd(costoHonorarios), pctFmt((costoHonorarios / calcs.costoTotal) * 100)],
      ["Gastos de venta", usd(calcs.gastosVenta), "—"],
      ["= Costo total", usd(calcs.costoTotal), "100%"],
      ["Ingresos brutos", usd(calcs.ingresosBrutos), "—"],
      ["= Utilidad neta", usd(calcs.utilidadBruta), pctFmt(calcs.rentabilidad) + " ROI"],
    ];
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Fraccionamiento</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#222}
    h1{font-size:20px}h2{font-size:14px;margin:20px 0 8px;color:#555}
    table{width:100%;border-collapse:collapse;margin-bottom:14px}
    th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:10px;border-bottom:2px solid #ddd}
    td{padding:5px 8px;border-bottom:1px solid #eee}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
    .kpi{padding:12px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px}
    .kv{font-size:20px;font-weight:700}.kl{font-size:10px;color:#888}
    </style></head><body>
    <h1>Calculadora de Fraccionamiento y Loteo — Argentina</h1>
    <p>Superficie total: ${fmt(superficieTotal)} m² · Terreno: ${usd(costoTerreno)}</p>
    <div class="grid">
      <div class="kpi"><div class="kv">${calcs.cantidadLotes}</div><div class="kl">Cantidad de lotes</div></div>
      <div class="kpi"><div class="kv">${m2(calcs.superficieRealPorLote)}</div><div class="kl">Superficie por lote</div></div>
      <div class="kpi"><div class="kv">${usd(calcs.ingresosBrutos)}</div><div class="kl">Ingresos totales</div></div>
      <div class="kpi"><div class="kv">${usd(calcs.costoTotal)}</div><div class="kl">Costo total</div></div>
      <div class="kpi"><div class="kv">${usd(calcs.utilidadBruta)}</div><div class="kl">Utilidad</div></div>
      <div class="kpi"><div class="kv">${pctFmt(calcs.rentabilidad)}</div><div class="kl">Rentabilidad</div></div>
    </div>
    <h2>Desglose financiero</h2>
    <table><thead><tr><th>Concepto</th><th>Monto USD</th><th>% del Total</th></tr></thead><tbody>
    ${rows.map(([c, m, p]) => `<tr><td>${c}</td><td>${m}</td><td>${p}</td></tr>`).join("")}
    </tbody></table>
    <p><strong>Precio mínimo de venta (BEP):</strong> ${usd(calcs.pmTerrenoIncluido)}/m²</p>
    <p style="color:#888;font-size:10px;margin-top:32px">Nota: Los porcentajes municipales (calles, espacios verdes) varían según municipio. Consultar ordenanza local vigente.</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  // ── KPI color helper
  const kpiColor = (val: number, positive = true): string => {
    if (positive) return val > 0 ? "#22c55e" : "#cc0000";
    return val < 0 ? "#cc0000" : "#22c55e";
  };

  // ── Tab button style helper
  const tabBtn = (tab: "resumen" | "distribucion" | "sensibilidad"): React.CSSProperties => ({
    padding: "8px 20px",
    background: "none",
    border: "none",
    borderBottom: `2px solid ${activeTab === tab ? "#cc0000" : "transparent"}`,
    color: activeTab === tab ? "#fff" : "#6b7280",
    fontSize: 12,
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    cursor: "pointer",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  });

  // ── SVG Layout
  const VW = 800;
  const VH = 500;
  const pctCalles = porcentajeCalles / 100;
  const pctVerdes = porcentajeEspaciosVerdes / 100;
  const pctReserva = porcentajeLoteMin / 100;
  const pctLotes = Math.max(0, 1 - pctCalles - pctVerdes - pctReserva);

  const callesH = Math.round(VH * pctCalles);
  const verdesH = Math.round(VH * pctVerdes);
  const reservaH = Math.round(VH * pctReserva);
  const lotesH = VH - callesH - verdesH - reservaH;

  const numCols = Math.max(1, Math.ceil(Math.sqrt(calcs.cantidadLotes * (VW / lotesH))));
  const numRows = calcs.cantidadLotes > 0 ? Math.ceil(calcs.cantidadLotes / numCols) : 0;
  const loteW = numCols > 0 ? VW / numCols : VW;
  const loteH = numRows > 0 ? lotesH / numRows : lotesH;

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
      <div style={{ maxWidth: 1140, margin: "0 auto" }}>
        {/* ── Header */}
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
                color: "#fff",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Fraccionamiento y Loteo
            </h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
              Calculadora de subdivisión y loteo de terrenos — Argentina
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link
              href="/calculadoras"
              style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}
            >
              ← Calculadoras
            </Link>
            <button
              onClick={exportPDF}
              style={{
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: 6,
                color: "#e5e5e5",
                padding: "6px 14px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
              }}
            >
              PDF
            </button>
          </div>
        </div>

        {/* ── KPI strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {[
            {
              label: "Cantidad de lotes",
              value: fmt(calcs.cantidadLotes),
              color: "#fff",
            },
            {
              label: "Superficie por lote",
              value: m2(calcs.superficieRealPorLote),
              color: "#fff",
            },
            {
              label: "Ingresos totales",
              value: usd(calcs.ingresosBrutos),
              color: "#22c55e",
            },
            {
              label: "Costo total",
              value: usd(calcs.costoTotal),
              color: "#f97316",
            },
            {
              label: "Utilidad",
              value: usd(calcs.utilidadBruta),
              color: kpiColor(calcs.utilidadBruta),
            },
            {
              label: "Rentabilidad",
              value: pctFmt(calcs.rentabilidad),
              color: kpiColor(calcs.rentabilidad),
            },
          ].map((k) => (
            <div key={k.label} style={{ ...card, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>
                {k.label}
              </div>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 16,
                  color: k.color,
                  lineHeight: 1.2,
                }}
              >
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main layout: inputs left, tabs right */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
          {/* ── Left: all inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Terreno */}
            <div style={card}>
              <div style={sectionTitle}>Terreno</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Superficie total (m²)</label>
                  <input
                    type="number"
                    value={superficieTotal}
                    min={100}
                    onChange={(e) =>
                      setSuperficieTotal(parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Costo del terreno (USD)</label>
                  <input
                    type="number"
                    value={costoTerreno}
                    min={0}
                    onChange={(e) =>
                      setCostoTerreno(parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Afectaciones */}
            <div style={card}>
              <div style={sectionTitle}>Afectaciones municipales</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Calles y espacio público (%)</label>
                  <input
                    type="number"
                    value={porcentajeCalles}
                    min={0}
                    max={50}
                    step={0.5}
                    onChange={(e) =>
                      setPorcentajeCalles(parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Espacios verdes / plazas (%)</label>
                  <input
                    type="number"
                    value={porcentajeEspaciosVerdes}
                    min={0}
                    max={30}
                    step={0.5}
                    onChange={(e) =>
                      setPorcentajeEspaciosVerdes(parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Reserva lote propio (%)</label>
                  <input
                    type="number"
                    value={porcentajeLoteMin}
                    min={0}
                    max={30}
                    step={0.5}
                    onChange={(e) =>
                      setPorcentajeLoteMin(parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  background: "#0a0a0a",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                Superficie vendible:{" "}
                <strong style={{ color: "#e5e5e5" }}>
                  {m2(calcs.superficieVendible)}
                </strong>{" "}
                ({pctFmt((calcs.superficieVendible / Math.max(superficieTotal, 1)) * 100)} del total)
              </div>
            </div>

            {/* Lotes */}
            <div style={card}>
              <div style={sectionTitle}>Configuración de lotes</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Superficie mínima por lote (m²)</label>
                  <input
                    type="number"
                    value={superficieLoteMin}
                    min={50}
                    onChange={(e) =>
                      setSuperficieLoteMin(parseFloat(e.target.value) || 1)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Superficie máxima por lote (m²)</label>
                  <input
                    type="number"
                    value={superficieLoteMax}
                    min={50}
                    onChange={(e) =>
                      setSuperficieLoteMax(parseFloat(e.target.value) || 1)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Superficie objetivo promedio (m²)</label>
                  <input
                    type="number"
                    value={superficieLoteObj}
                    min={50}
                    onChange={(e) =>
                      setSuperficieLoteObj(parseFloat(e.target.value) || 1)
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
              {calcs.superficieRealPorLote < superficieLoteMin && calcs.cantidadLotes > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    background: "rgba(204,0,0,0.1)",
                    border: "1px solid rgba(204,0,0,0.3)",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "#cc0000",
                  }}
                >
                  Alerta: superficie real ({m2(calcs.superficieRealPorLote)}) menor al mínimo exigido
                </div>
              )}
              {calcs.superficieRealPorLote > superficieLoteMax && calcs.cantidadLotes > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    background: "rgba(249,115,22,0.1)",
                    border: "1px solid rgba(249,115,22,0.3)",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "#f97316",
                  }}
                >
                  Nota: superficie real ({m2(calcs.superficieRealPorLote)}) supera el máximo definido
                </div>
              )}
            </div>

            {/* Costos */}
            <div style={card}>
              <div style={sectionTitle}>Costos del proyecto</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Infraestructura — calles, agua, luz (USD)</label>
                  <input
                    type="number"
                    value={costoInfraestructura}
                    min={0}
                    onChange={(e) =>
                      setCostoInfraestructura(parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Honorarios — escribano, planos (USD)</label>
                  <input
                    type="number"
                    value={costoHonorarios}
                    min={0}
                    onChange={(e) =>
                      setCostoHonorarios(parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Gastos de venta / comisión (%)</label>
                  <input
                    type="number"
                    value={gastosVentaPct}
                    min={0}
                    max={15}
                    step={0.25}
                    onChange={(e) =>
                      setGastosVentaPct(parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Precios */}
            <div style={card}>
              <div style={sectionTitle}>Precios de venta</div>
              <div>
                <label style={labelStyle}>Precio de venta (USD/m²)</label>
                <input
                  type="number"
                  value={precioVentaPorM2}
                  min={1}
                  onChange={(e) =>
                    setPrecioVentaPorM2(parseFloat(e.target.value) || 1)
                  }
                  style={inputStyle}
                  disabled={precioVariableSegunUbic}
                />
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
                onClick={() => setPrecioVariableSegunUbic((v) => !v)}
              >
                <div
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    background: precioVariableSegunUbic ? "#cc0000" : "#374151",
                    position: "relative",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      left: precioVariableSegunUbic ? 18 : 3,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  Precio variable según ubicación
                </span>
              </div>

              {precioVariableSegunUbic && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {(
                    [
                      { key: "esquina", label: "Esquina (USD/m²)" },
                      { key: "frente", label: "Frente (USD/m²)" },
                      { key: "interior", label: "Interior (USD/m²)" },
                      { key: "fondo", label: "Fondo (USD/m²)" },
                    ] as { key: keyof PrecioPorUbicacion; label: string }[]
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <input
                        type="number"
                        value={precioPorUbicacion[key]}
                        min={1}
                        onChange={(e) =>
                          setPrecioPorUbicacion((prev) => ({
                            ...prev,
                            [key]: parseFloat(e.target.value) || 1,
                          }))
                        }
                        style={inputStyle}
                      />
                    </div>
                  ))}
                  <div
                    style={{
                      padding: "6px 10px",
                      background: "#0a0a0a",
                      borderRadius: 6,
                      fontSize: 11,
                      color: "#6b7280",
                    }}
                  >
                    Precio ponderado:{" "}
                    <strong style={{ color: "#e5e5e5" }}>
                      {usd(calcs.precioPonderado)}/m²
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: tabs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Tab buttons */}
            <div
              style={{
                display: "flex",
                gap: 0,
                borderBottom: "1px solid #1f2937",
                marginBottom: 16,
              }}
            >
              {(["resumen", "distribucion", "sensibilidad"] as const).map((t) => (
                <button key={t} onClick={() => setActiveTab(t)} style={tabBtn(t)}>
                  {t === "resumen"
                    ? "Resumen"
                    : t === "distribucion"
                    ? "Distribución de lotes"
                    : "Sensibilidad"}
                </button>
              ))}
            </div>

            {/* ─────────────────────────────────── TAB 1: RESUMEN ── */}
            {activeTab === "resumen" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Desglose table */}
                <div style={card}>
                  <div style={sectionTitle}>Desglose financiero</div>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        {["Concepto", "Monto USD", "% del Total"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "6px 10px",
                              textAlign: h === "Concepto" ? "left" : "right",
                              fontSize: 10,
                              color: "#6b7280",
                              borderBottom: "1px solid #1f2937",
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 700,
                              textTransform: "uppercase" as const,
                              letterSpacing: "0.05em",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          label: "Terreno",
                          value: costoTerreno,
                          pct: calcs.costoTotal > 0 ? (costoTerreno / calcs.costoTotal) * 100 : 0,
                          color: "#f97316",
                          bold: false,
                        },
                        {
                          label: "Infraestructura",
                          value: costoInfraestructura,
                          pct:
                            calcs.costoTotal > 0
                              ? (costoInfraestructura / calcs.costoTotal) * 100
                              : 0,
                          color: "#f97316",
                          bold: false,
                        },
                        {
                          label: "Honorarios",
                          value: costoHonorarios,
                          pct:
                            calcs.costoTotal > 0
                              ? (costoHonorarios / calcs.costoTotal) * 100
                              : 0,
                          color: "#f97316",
                          bold: false,
                        },
                        {
                          label: `Gastos de venta (${gastosVentaPct}%)`,
                          value: calcs.gastosVenta,
                          pct:
                            calcs.costoTotal > 0
                              ? (calcs.gastosVenta / calcs.costoTotal) * 100
                              : 0,
                          color: "#f97316",
                          bold: false,
                        },
                        {
                          label: "= Costo total",
                          value: calcs.costoTotal,
                          pct: 100,
                          color: "#cc0000",
                          bold: true,
                        },
                        {
                          label: "Ingresos brutos",
                          value: calcs.ingresosBrutos,
                          pct:
                            calcs.costoTotal > 0
                              ? (calcs.ingresosBrutos / calcs.costoTotal) * 100
                              : 0,
                          color: "#22c55e",
                          bold: true,
                        },
                        {
                          label: "= Utilidad neta",
                          value: calcs.utilidadBruta,
                          pct:
                            calcs.costoTotal > 0
                              ? (calcs.utilidadBruta / calcs.costoTotal) * 100
                              : 0,
                          color: calcs.utilidadBruta >= 0 ? "#22c55e" : "#cc0000",
                          bold: true,
                        },
                      ].map((row) => (
                        <tr
                          key={row.label}
                          style={{ borderBottom: "1px solid #111" }}
                        >
                          <td
                            style={{
                              padding: "7px 10px",
                              color: row.bold ? "#e5e5e5" : "#9ca3af",
                              fontWeight: row.bold ? 700 : 400,
                            }}
                          >
                            {row.label}
                          </td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: row.bold ? 800 : 600,
                              color: row.color,
                              fontSize: row.bold ? 14 : 13,
                            }}
                          >
                            {usd(row.value)}
                          </td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              color: "#6b7280",
                              fontSize: 12,
                            }}
                          >
                            {pctFmt(row.pct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* BEP */}
                <div
                  style={{
                    ...card,
                    background: "rgba(204,0,0,0.07)",
                    border: "1px solid rgba(204,0,0,0.25)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 13,
                          color: "#e5e5e5",
                          marginBottom: 4,
                        }}
                      >
                        Precio mínimo de venta para no perder dinero (BEP)
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Incluye terreno + infraestructura + honorarios, distribuido en{" "}
                        {calcs.cantidadLotes} lotes de{" "}
                        {m2(calcs.superficieRealPorLote)} c/u
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        fontSize: 28,
                        color: "#cc0000",
                        flexShrink: 0,
                        marginLeft: 16,
                      }}
                    >
                      {usd(calcs.pmTerrenoIncluido)}/m²
                    </div>
                  </div>
                  {calcs.precioPonderado > 0 && calcs.pmTerrenoIncluido > 0 && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "6px 10px",
                        background: "#0a0a0a",
                        borderRadius: 6,
                        fontSize: 12,
                        color:
                          calcs.precioPonderado >= calcs.pmTerrenoIncluido
                            ? "#22c55e"
                            : "#cc0000",
                      }}
                    >
                      Precio actual ({usd(calcs.precioPonderado)}/m²) está{" "}
                      {calcs.precioPonderado >= calcs.pmTerrenoIncluido
                        ? "por encima"
                        : "por debajo"}{" "}
                      del BEP por{" "}
                      {usd(
                        Math.abs(calcs.precioPonderado - calcs.pmTerrenoIncluido)
                      )}
                      /m²
                    </div>
                  )}
                </div>

                {/* Cost bars */}
                <div style={card}>
                  <div style={sectionTitle}>Estructura de costos</div>
                  {[
                    { label: "Terreno", value: costoTerreno, color: "#f97316" },
                    {
                      label: "Infraestructura",
                      value: costoInfraestructura,
                      color: "#f59e0b",
                    },
                    {
                      label: "Honorarios",
                      value: costoHonorarios,
                      color: "#eab308",
                    },
                  ].map((c) => {
                    const pctV =
                      calcs.costoTotal > 0
                        ? (c.value / calcs.costoTotal) * 100
                        : 0;
                    return (
                      <div key={c.label} style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ color: "#9ca3af" }}>{c.label}</span>
                          <span
                            style={{
                              color: "#e5e5e5",
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 700,
                            }}
                          >
                            {usd(c.value)}{" "}
                            <span style={{ color: "#6b7280", fontSize: 10 }}>
                              ({pctFmt(pctV)})
                            </span>
                          </span>
                        </div>
                        <div
                          style={{
                            background: "#0a0a0a",
                            borderRadius: 4,
                            height: 7,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, pctV)}%`,
                              height: "100%",
                              background: c.color,
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Nota legal */}
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#111",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "#9ca3af" }}>Nota legal:</strong> Los
                  porcentajes municipales (calles, espacios verdes) varían según el
                  municipio y la ordenanza de urbanizaciones vigente. Consultar con
                  el organismo municipal correspondiente antes de realizar el proyecto.
                </div>
              </div>
            )}

            {/* ──────────────────────────── TAB 2: DISTRIBUCION ── */}
            {activeTab === "distribucion" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* SVG layout */}
                <div style={card}>
                  <div style={sectionTitle}>Vista esquemática del predio</div>
                  <div style={{ overflowX: "auto" }}>
                    <svg
                      viewBox={`0 0 ${VW} ${VH}`}
                      width="100%"
                      style={{
                        display: "block",
                        border: "1px solid #1f2937",
                        borderRadius: 6,
                        maxWidth: VW,
                      }}
                    >
                      {/* Background */}
                      <rect width={VW} height={VH} fill="#0a0a0a" />

                      {/* Lotes vendibles */}
                      {calcs.cantidadLotes > 0 &&
                        Array.from({ length: calcs.cantidadLotes }).map((_, i) => {
                          const col = i % numCols;
                          const row = Math.floor(i / numCols);
                          const x = col * loteW;
                          const y = row * loteH;
                          const isEsquina =
                            precioVariableSegunUbic &&
                            i < calcs.distribucion.esquinas;
                          const isFrente =
                            precioVariableSegunUbic &&
                            !isEsquina &&
                            i < calcs.distribucion.esquinas + calcs.distribucion.frentes;
                          const isFondo =
                            precioVariableSegunUbic &&
                            !isEsquina &&
                            !isFrente &&
                            i >=
                              calcs.cantidadLotes - calcs.distribucion.fondos;
                          const fillColor = isEsquina
                            ? "rgba(220,38,38,0.9)"
                            : isFrente
                            ? "rgba(204,0,0,0.65)"
                            : isFondo
                            ? "rgba(127,29,29,0.6)"
                            : "rgba(185,28,28,0.45)";
                          return (
                            <rect
                              key={i}
                              x={x + 1}
                              y={y + 1}
                              width={Math.max(0, loteW - 2)}
                              height={Math.max(0, loteH - 2)}
                              fill={fillColor}
                              rx={1}
                            />
                          );
                        })}

                      {/* Calles */}
                      <rect
                        x={0}
                        y={lotesH}
                        width={VW}
                        height={callesH}
                        fill="#374151"
                        opacity={0.9}
                      />
                      {callesH > 14 && (
                        <text
                          x={VW / 2}
                          y={lotesH + callesH / 2 + 5}
                          textAnchor="middle"
                          fill="#9ca3af"
                          fontSize={Math.min(callesH * 0.4, 14)}
                          fontFamily="Montserrat, sans-serif"
                          fontWeight={700}
                        >
                          CALLES Y ESPACIOS PÚBLICOS ({pctFmt(porcentajeCalles)})
                        </text>
                      )}

                      {/* Espacios verdes */}
                      <rect
                        x={0}
                        y={lotesH + callesH}
                        width={VW}
                        height={verdesH}
                        fill="#166534"
                        opacity={0.85}
                      />
                      {verdesH > 14 && (
                        <text
                          x={VW / 2}
                          y={lotesH + callesH + verdesH / 2 + 5}
                          textAnchor="middle"
                          fill="#86efac"
                          fontSize={Math.min(verdesH * 0.4, 14)}
                          fontFamily="Montserrat, sans-serif"
                          fontWeight={700}
                        >
                          ESPACIOS VERDES / PLAZAS ({pctFmt(porcentajeEspaciosVerdes)})
                        </text>
                      )}

                      {/* Reserva */}
                      {reservaH > 0 && (
                        <>
                          <rect
                            x={0}
                            y={lotesH + callesH + verdesH}
                            width={VW}
                            height={reservaH}
                            fill="#1e3a5f"
                            opacity={0.85}
                          />
                          {reservaH > 14 && (
                            <text
                              x={VW / 2}
                              y={lotesH + callesH + verdesH + reservaH / 2 + 5}
                              textAnchor="middle"
                              fill="#93c5fd"
                              fontSize={Math.min(reservaH * 0.4, 14)}
                              fontFamily="Montserrat, sans-serif"
                              fontWeight={700}
                            >
                              LOTE PROPIO ({pctFmt(porcentajeLoteMin)})
                            </text>
                          )}
                        </>
                      )}

                      {/* Label en lotes */}
                      {lotesH > 30 && calcs.cantidadLotes > 0 && (
                        <text
                          x={VW / 2}
                          y={Math.min(lotesH / 2, 30)}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.7)"
                          fontSize={13}
                          fontFamily="Montserrat, sans-serif"
                          fontWeight={800}
                        >
                          {calcs.cantidadLotes} LOTES VENDIBLES ({pctFmt(pctLotes * 100)})
                        </text>
                      )}
                    </svg>
                  </div>

                  {/* Leyenda */}
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      marginTop: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      {
                        color: "rgba(185,28,28,0.7)",
                        label: `Lotes vendibles — ${m2(calcs.superficieVendible)}`,
                      },
                      {
                        color: "#374151",
                        label: `Calles — ${m2(superficieTotal * (porcentajeCalles / 100))}`,
                      },
                      {
                        color: "#166534",
                        label: `Espacios verdes — ${m2(superficieTotal * (porcentajeEspaciosVerdes / 100))}`,
                      },
                      ...(porcentajeLoteMin > 0
                        ? [
                            {
                              color: "#1e3a5f",
                              label: `Lote propio — ${m2(superficieTotal * (porcentajeLoteMin / 100))}`,
                            },
                          ]
                        : []),
                    ].map((l) => (
                      <div
                        key={l.label}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            background: l.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>
                          {l.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Distribución por categoría (solo si precio variable) */}
                {precioVariableSegunUbic ? (
                  <div style={card}>
                    <div style={sectionTitle}>Distribución por categoría de lote</div>
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
                            "Categoría",
                            "Cant.",
                            "%",
                            "USD/m²",
                            "m² por lote",
                            "Subtotal USD",
                          ].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "6px 10px",
                                textAlign: h === "Categoría" ? "left" : "right",
                                fontSize: 10,
                                color: "#6b7280",
                                borderBottom: "1px solid #1f2937",
                                fontFamily: "Montserrat, sans-serif",
                                fontWeight: 700,
                                textTransform: "uppercase" as const,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            cat: "Esquina",
                            cant: calcs.distribucion.esquinas,
                            pct: 20,
                            precio: precioPorUbicacion.esquina,
                            color: "#dc2626",
                          },
                          {
                            cat: "Frente",
                            cant: calcs.distribucion.frentes,
                            pct: 30,
                            precio: precioPorUbicacion.frente,
                            color: "#cc0000",
                          },
                          {
                            cat: "Interior",
                            cant: calcs.distribucion.interiores,
                            pct: 35,
                            precio: precioPorUbicacion.interior,
                            color: "#9ca3af",
                          },
                          {
                            cat: "Fondo",
                            cant: calcs.distribucion.fondos,
                            pct: 15,
                            precio: precioPorUbicacion.fondo,
                            color: "#6b7280",
                          },
                        ].map((row) => {
                          const subtotal =
                            row.cant * calcs.superficieRealPorLote * row.precio;
                          return (
                            <tr
                              key={row.cat}
                              style={{ borderBottom: "1px solid #111" }}
                            >
                              <td
                                style={{
                                  padding: "7px 10px",
                                  fontFamily: "Montserrat, sans-serif",
                                  fontWeight: 700,
                                  color: row.color,
                                }}
                              >
                                {row.cat}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  textAlign: "right",
                                  color: "#e5e5e5",
                                }}
                              >
                                {row.cant}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  textAlign: "right",
                                  color: "#6b7280",
                                }}
                              >
                                {row.pct}%
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  textAlign: "right",
                                  color: "#e5e5e5",
                                  fontFamily: "Montserrat, sans-serif",
                                  fontWeight: 600,
                                }}
                              >
                                {usd(row.precio)}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  textAlign: "right",
                                  color: "#9ca3af",
                                }}
                              >
                                {m2(calcs.superficieRealPorLote)}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  textAlign: "right",
                                  fontFamily: "Montserrat, sans-serif",
                                  fontWeight: 700,
                                  color: "#22c55e",
                                }}
                              >
                                {usd(subtotal)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ borderTop: "2px solid #1f2937" }}>
                          <td
                            colSpan={3}
                            style={{
                              padding: "8px 10px",
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 800,
                              color: "#fff",
                            }}
                          >
                            TOTAL
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 700,
                              color: "#e5e5e5",
                            }}
                          >
                            {usd(calcs.precioPonderado)}/m² prom.
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: "#9ca3af",
                            }}
                          >
                            {calcs.cantidadLotes} lotes
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 800,
                              color: "#22c55e",
                              fontSize: 15,
                            }}
                          >
                            {usd(calcs.ingresosBrutos)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ ...card, textAlign: "center", padding: 24 }}>
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      Todos los{" "}
                      <strong style={{ color: "#e5e5e5" }}>
                        {calcs.cantidadLotes} lotes
                      </strong>{" "}
                      se venden al mismo precio:{" "}
                      <strong style={{ color: "#cc0000" }}>
                        {usd(precioVentaPorM2)}/m²
                      </strong>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      Activá "Precio variable según ubicación" para diferenciar por
                      categoría de lote.
                    </div>
                  </div>
                )}

                {/* Nota legal */}
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#111",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "#9ca3af" }}>Nota legal:</strong> Los
                  porcentajes municipales (calles, espacios verdes) varían según el
                  municipio y la ordenanza de urbanizaciones vigente. Consultar con
                  el organismo municipal correspondiente antes de realizar el proyecto.
                </div>
              </div>
            )}

            {/* ────────────────────────── TAB 3: SENSIBILIDAD ── */}
            {activeTab === "sensibilidad" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={card}>
                  <div style={sectionTitle}>
                    ¿A qué precio mínimo necesito vender?
                  </div>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}>
                    Utilidad resultante (USD) variando precio de venta (filas, ±20%)
                    y cantidad de lotes (columnas, ±20%). Verde = utilidad positiva,
                    rojo = pérdida, amarillo = margen menor al 10%.
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        borderCollapse: "collapse",
                        fontSize: 11,
                        minWidth: 600,
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              padding: "6px 10px",
                              color: "#6b7280",
                              fontFamily: "Montserrat, sans-serif",
                              fontSize: 10,
                              textAlign: "left",
                              borderBottom: "1px solid #1f2937",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Precio ↓ / Lotes →
                          </th>
                          {sensiVariaciones.map((v) => {
                            const lotes = Math.max(
                              0,
                              Math.round(calcs.cantidadLotes * (1 + v / 100))
                            );
                            return (
                              <th
                                key={v}
                                style={{
                                  padding: "6px 8px",
                                  textAlign: "center",
                                  color: v === 0 ? "#cc0000" : "#6b7280",
                                  fontFamily: "Montserrat, sans-serif",
                                  fontSize: 10,
                                  borderBottom: "1px solid #1f2937",
                                  whiteSpace: "nowrap",
                                  fontWeight: v === 0 ? 800 : 600,
                                }}
                              >
                                {v === 0 ? "Base" : (v > 0 ? "+" : "") + v + "%"}
                                <br />
                                <span style={{ fontSize: 9, color: "#4b5563" }}>
                                  {lotes} lotes
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {sensiVariaciones.map((yVar, yi) => {
                          const precio = Math.max(
                            0,
                            calcs.precioPonderado * (1 + yVar / 100)
                          );
                          const isBaseRow = yVar === 0;
                          return (
                            <tr key={yVar} style={{ borderBottom: "1px solid #0f0f0f" }}>
                              <td
                                style={{
                                  padding: "6px 10px",
                                  fontFamily: "Montserrat, sans-serif",
                                  fontWeight: isBaseRow ? 800 : 600,
                                  color: isBaseRow ? "#cc0000" : "#9ca3af",
                                  fontSize: 11,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {yVar === 0
                                  ? `Base — ${usd(calcs.precioPonderado)}/m²`
                                  : `${yVar > 0 ? "+" : ""}${yVar}% — ${usd(precio)}/m²`}
                              </td>
                              {sensiVariaciones.map((xVar, xi) => {
                                const utilidad = sensibilidadData[yi]?.[xi] ?? 0;
                                const isBaseCell = xVar === 0 && yVar === 0;
                                const margenPct =
                                  calcs.costoTotal > 0
                                    ? (utilidad / calcs.costoTotal) * 100
                                    : 0;
                                let bg: string;
                                if (isBaseCell) {
                                  bg = "rgba(204,0,0,0.2)";
                                } else if (utilidad < 0) {
                                  bg = "rgba(204,0,0,0.35)";
                                } else if (margenPct < 10) {
                                  bg = "rgba(234,179,8,0.25)";
                                } else {
                                  bg = "rgba(34,197,94,0.2)";
                                }
                                const textColor =
                                  utilidad < 0
                                    ? "#f87171"
                                    : margenPct < 10
                                    ? "#fde047"
                                    : "#86efac";
                                return (
                                  <td
                                    key={xVar}
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "center",
                                      background: bg,
                                      fontFamily: "Montserrat, sans-serif",
                                      fontWeight: isBaseCell ? 800 : 600,
                                      color: isBaseCell ? "#fff" : textColor,
                                      fontSize: 11,
                                      borderRadius: 3,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {utilidad >= 0 ? "+" : ""}
                                    {usd(utilidad)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Color legend */}
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      marginTop: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      {
                        color: "rgba(34,197,94,0.3)",
                        label: "Rentabilidad > 10%",
                        text: "#86efac",
                      },
                      {
                        color: "rgba(234,179,8,0.3)",
                        label: "Rentabilidad < 10% (margen ajustado)",
                        text: "#fde047",
                      },
                      {
                        color: "rgba(204,0,0,0.4)",
                        label: "Pérdida",
                        text: "#f87171",
                      },
                      {
                        color: "rgba(204,0,0,0.2)",
                        label: "Escenario base",
                        text: "#fff",
                      },
                    ].map((l) => (
                      <div
                        key={l.label}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            background: l.color,
                            border: `1px solid ${l.text}33`,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 11, color: "#6b7280" }}>
                          {l.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nota legal */}
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#111",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "#9ca3af" }}>Nota legal:</strong> Los
                  porcentajes municipales (calles, espacios verdes) varían según el
                  municipio y la ordenanza de urbanizaciones vigente. Consultar con
                  el organismo municipal correspondiente antes de realizar el proyecto.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
