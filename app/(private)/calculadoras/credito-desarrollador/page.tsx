"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TipoCredito = "puente" | "obra" | "fideicomiso";

type Garantia = "hipotecaria" | "prendaria" | "personal" | "mixta";

interface CuotaPuente {
  mes: number;
  capital: number;
  interes: number;
  cuota: number;
  saldo: number;
}

interface ResultadoPuente {
  cuotas: CuotaPuente[];
  totalIntereses: number;
  totalPagado: number;
  cfaMensualOperativa: number;
}

interface DesembolsoObra {
  mes: number;
  pct: number;
  monto: number;
  saldoAcumulado: number;
}

interface ResultadoObra {
  desembolsos: DesembolsoObra[];
  saldoPorMes: number[];
  totalIntereses: number;
  totalADevolver: number;
  costoFinancieroPct: number;
}

interface ResultadoFideicomiso {
  costoTotal: number;
  ingresoTotal: number;
  gananciaProyecto: number;
  margenPct: number;
  montoFinanciar: number;
  anticipoUSD: number;
  saldoUSD: number;
  cuotaMensualUSD: number;
  precioPorM2Inversion: number;
  rendimientoInversor: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtARS(n: number): string {
  return `$ ${fmt(n)}`;
}

function fmtUSD(n: number): string {
  return `USD ${fmt(n)}`;
}

// ── Cálculo Crédito Puente ────────────────────────────────────────────────────

function calcPuente(monto: number, tna: number, plazo: number): ResultadoPuente {
  const mensual = tna / 100 / 12;
  const interesMensual = monto * mensual;
  const cuotas: CuotaPuente[] = Array.from({ length: plazo }, (_, i) => ({
    mes: i + 1,
    capital: i === plazo - 1 ? monto : 0,
    interes: interesMensual,
    cuota: i === plazo - 1 ? monto + interesMensual : interesMensual,
    saldo: i === plazo - 1 ? 0 : monto,
  }));
  return {
    cuotas,
    totalIntereses: interesMensual * plazo,
    totalPagado: monto + interesMensual * plazo,
    cfaMensualOperativa: interesMensual,
  };
}

// ── Cálculo Crédito Obra ──────────────────────────────────────────────────────

const DESEMBOLSOS_PCT = [0.20, 0.25, 0.30, 0.25];
const DESEMBOLSOS_MESES = [0, 6, 12, 18];

function calcObra(monto: number, tna: number, plazo: number): ResultadoObra {
  const tem = tna / 100 / 12;

  // Construir desembolsos
  const desembolsos: DesembolsoObra[] = DESEMBOLSOS_PCT.map((pct, i) => ({
    mes: DESEMBOLSOS_MESES[i],
    pct,
    monto: monto * pct,
    saldoAcumulado: 0,
  }));

  // Calcular saldo acumulado por desembolso
  let acum = 0;
  desembolsos.forEach((d) => {
    acum += d.monto;
    d.saldoAcumulado = acum;
  });

  // Simular saldo deudor mes a mes
  const saldoPorMes: number[] = new Array(plazo + 1).fill(0);
  let saldo = 0;
  let totalIntereses = 0;

  for (let mes = 0; mes <= plazo; mes++) {
    // Agregar desembolso si corresponde
    const desIdx = DESEMBOLSOS_MESES.indexOf(mes);
    if (desIdx >= 0) {
      saldo += desembolsos[desIdx].monto;
    }
    saldoPorMes[mes] = saldo;

    // Intereses sobre saldo deudor (simplificado: solo intereses, capital al final)
    if (mes > 0 && saldo > 0) {
      totalIntereses += saldo * tem;
    }
  }

  const totalADevolver = monto + totalIntereses;
  const costoFinancieroPct = monto > 0 ? (totalIntereses / monto) * 100 : 0;

  return {
    desembolsos,
    saldoPorMes: saldoPorMes.slice(0, plazo + 1),
    totalIntereses,
    totalADevolver,
    costoFinancieroPct,
  };
}

// ── Cálculo Fideicomiso ───────────────────────────────────────────────────────

function calcFideicomiso(
  superficieM2: number,
  costoM2USD: number,
  precioVentaM2USD: number,
  cuotas: number,
  anticipoPct: number
): ResultadoFideicomiso {
  const costoTotal = superficieM2 * costoM2USD;
  const ingresoTotal = superficieM2 * precioVentaM2USD;
  const gananciaProyecto = ingresoTotal - costoTotal;
  const margenPct = costoTotal > 0 ? (gananciaProyecto / costoTotal) * 100 : 0;

  const montoFinanciar = costoTotal * 0.70;
  const anticipoUSD = montoFinanciar * (anticipoPct / 100);
  const saldoUSD = montoFinanciar - anticipoUSD;
  const cuotaMensualUSD = cuotas > 0 ? saldoUSD / cuotas : 0;
  const precioPorM2Inversion = superficieM2 > 0 ? montoFinanciar / superficieM2 : 0;
  const rendimientoInversor = montoFinanciar > 0 ? (ingresoTotal / montoFinanciar - 1) * 100 : 0;

  return {
    costoTotal,
    ingresoTotal,
    gananciaProyecto,
    margenPct,
    montoFinanciar,
    anticipoUSD,
    saldoUSD,
    cuotaMensualUSD,
    precioPorM2Inversion,
    rendimientoInversor,
  };
}

// ── Estilos comunes ───────────────────────────────────────────────────────────

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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
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

const kpiCardStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 10,
  padding: "16px",
  flex: 1,
  minWidth: 140,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 13,
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 800,
  color: "#cc0000",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

// ── Componente Principal ──────────────────────────────────────────────────────

export default function CreditoDesarrolladorPage() {
  const [tab, setTab] = useState<TipoCredito>("puente");

  // ── Estado Tab Puente ─────────────────────────────────────────────────────
  const [puenteMonto, setPuenteMonto] = useState(200_000_000);
  const [puenteTna, setPuenteTna] = useState(55);
  const [puentePlazo, setPuentePlazo] = useState(12);
  const [puenteGarantia, setPuenteGarantia] = useState<Garantia>("hipotecaria");
  const [puenteTc, setPuenteTc] = useState(1300);

  // ── Estado Tab Obra ───────────────────────────────────────────────────────
  const [obraMontoTotal, setObraMontoTotal] = useState(500_000_000);
  const [obraSuperficie, setObraSuperficie] = useState(1000);
  const [obraTna, setObraTna] = useState(48);
  const [obraPlazo, setObraPlazo] = useState(24);
  const [obraCostoM2, setObraCostoM2] = useState(1400);

  // ── Estado Tab Fideicomiso ────────────────────────────────────────────────
  const [fidSuperficie, setFidSuperficie] = useState(500);
  const [fidCostoM2, setFidCostoM2] = useState(1400);
  const [fidPrecioVentaM2, setFidPrecioVentaM2] = useState(1800);
  const [fidCuotas, setFidCuotas] = useState<24 | 36 | 48>(36);
  const [fidAnticipoP, setFidAnticipoP] = useState(30);
  const [fidTc, setFidTc] = useState(1300);

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const resPuente = useMemo(
    () => calcPuente(puenteMonto, puenteTna, puentePlazo),
    [puenteMonto, puenteTna, puentePlazo]
  );

  const resObra = useMemo(
    () => calcObra(obraMontoTotal, obraTna, obraPlazo),
    [obraMontoTotal, obraTna, obraPlazo]
  );

  const resFid = useMemo(
    () => calcFideicomiso(fidSuperficie, fidCostoM2, fidPrecioVentaM2, fidCuotas, fidAnticipoP),
    [fidSuperficie, fidCostoM2, fidPrecioVentaM2, fidCuotas, fidAnticipoP]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    background: active ? "#cc0000" : "#1a1a1a",
    color: active ? "#fff" : "#888",
    border: active ? "1px solid #cc0000" : "1px solid #333",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    transition: "all 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "#888", textDecoration: "none", fontSize: 13, flexShrink: 0 }}>
          ← Calculadoras
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>
            Crédito para Desarrolladores
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            Crédito puente · Financiamiento de obra · Fideicomiso al costo
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "12px 24px", display: "flex", gap: 10 }}>
        <button style={tabBtnStyle(tab === "puente")} onClick={() => setTab("puente")}>
          Crédito Puente
        </button>
        <button style={tabBtnStyle(tab === "obra")} onClick={() => setTab("obra")}>
          Crédito Obra
        </button>
        <button style={tabBtnStyle(tab === "fideicomiso")} onClick={() => setTab("fideicomiso")}>
          Fideicomiso al Costo
        </button>
      </div>

      {/* Contenido */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1 — CRÉDITO PUENTE
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "puente" && (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

            {/* Panel izquierdo: inputs */}
            <div style={{ width: 260, flexShrink: 0 }}>
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 20 }}>
                <h2 style={sectionTitleStyle}>Parámetros</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  <div>
                    <label style={labelStyle}>Monto (ARS)</label>
                    <input
                      type="number"
                      value={puenteMonto}
                      onChange={e => setPuenteMonto(Number(e.target.value))}
                      style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
                      Máx. $ 500.000.000
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>TNA (%)</label>
                    <input
                      type="number"
                      step={0.5}
                      value={puenteTna}
                      onChange={e => setPuenteTna(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Plazo (meses)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="range"
                        min={6}
                        max={24}
                        value={puentePlazo}
                        onChange={e => setPuentePlazo(Number(e.target.value))}
                        style={{ flex: 1, accentColor: "#cc0000" }}
                      />
                      <span style={{ minWidth: 28, fontSize: 13, color: "#fff", textAlign: "right" }}>
                        {puentePlazo}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Garantía</label>
                    <select
                      value={puenteGarantia}
                      onChange={e => setPuenteGarantia(e.target.value as Garantia)}
                      style={selectStyle}
                    >
                      <option value="hipotecaria">Hipotecaria</option>
                      <option value="prendaria">Prendaria</option>
                      <option value="personal">Personal</option>
                      <option value="mixta">Mixta</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Tipo de cambio (ARS/USD)</label>
                    <input
                      type="number"
                      value={puenteTc}
                      onChange={e => setPuenteTc(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Info garantía */}
                <div style={{ marginTop: 16, padding: "10px 12px", background: "#0a0a0a", borderRadius: 8, fontSize: 11, color: "#555", lineHeight: 1.5 }}>
                  <strong style={{ color: "#888" }}>Garantía:</strong>{" "}
                  {puenteGarantia === "hipotecaria" && "Bien inmueble como colateral. Menor tasa."}
                  {puenteGarantia === "prendaria" && "Bien mueble registrable. Tasa intermedia."}
                  {puenteGarantia === "personal" && "Aval personal del desarrollador. Mayor tasa."}
                  {puenteGarantia === "mixta" && "Combinación de garantías. Tasa negociada."}
                </div>
              </div>
            </div>

            {/* Panel derecho: resultados */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* KPI Cards */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  {
                    label: "Cuota mensual (intereses)",
                    value: fmtARS(resPuente.cfaMensualOperativa),
                    sub: fmtUSD(resPuente.cfaMensualOperativa / puenteTc),
                    color: "#cc0000",
                  },
                  {
                    label: "Total intereses",
                    value: fmtARS(resPuente.totalIntereses),
                    sub: `TNA ${puenteTna}% · ${puentePlazo} meses`,
                    color: "#f97316",
                  },
                  {
                    label: "Total a pagar",
                    value: fmtARS(resPuente.totalPagado),
                    sub: fmtUSD(resPuente.totalPagado / puenteTc),
                    color: "#e5e5e5",
                  },
                  {
                    label: "Monto en USD",
                    value: fmtUSD(puenteMonto / puenteTc),
                    sub: `TC $ ${fmt(puenteTc)}`,
                    color: "#3b82f6",
                  },
                ].map((kpi, i) => (
                  <div key={i} style={kpiCardStyle}>
                    <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color, fontFamily: "Montserrat, sans-serif" }}>
                      {kpi.value}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* SVG Bar Chart — cuotas */}
              <PuenteBarChart cuotas={resPuente.cuotas} />

              {/* Tabla de amortización */}
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: "#1a1a1a", padding: "10px 16px", borderBottom: "1px solid #222" }}>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#fff" }}>
                    Tabla de Amortización — Bullet
                  </span>
                </div>
                <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#161616", position: "sticky", top: 0 }}>
                        {["Mes", "Capital", "Intereses", "Cuota", "Saldo"].map(h => (
                          <th key={h} style={{ padding: "8px 14px", textAlign: "right", fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, borderBottom: "1px solid #222" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resPuente.cuotas.map((c, i) => (
                        <tr
                          key={c.mes}
                          style={{
                            background: c.mes === puentePlazo ? "#cc000015" : i % 2 === 0 ? "#0d0d0d" : "transparent",
                            borderBottom: "1px solid #1a1a1a",
                          }}
                        >
                          <td style={{ padding: "7px 14px", textAlign: "right", color: "#888" }}>{c.mes}</td>
                          <td style={{ padding: "7px 14px", textAlign: "right", color: c.capital > 0 ? "#cc0000" : "#333" }}>
                            {c.capital > 0 ? fmtARS(c.capital) : "—"}
                          </td>
                          <td style={{ padding: "7px 14px", textAlign: "right", color: "#f97316" }}>
                            {fmtARS(c.interes)}
                          </td>
                          <td style={{ padding: "7px 14px", textAlign: "right", fontWeight: 700, color: "#fff" }}>
                            {fmtARS(c.cuota)}
                          </td>
                          <td style={{ padding: "7px 14px", textAlign: "right", color: "#666" }}>
                            {c.saldo > 0 ? fmtARS(c.saldo) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#1a1a1a", borderTop: "2px solid #333" }}>
                        <td style={{ padding: "8px 14px", color: "#888", fontSize: 11, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>TOTAL</td>
                        <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: "#cc0000", fontSize: 12 }}>{fmtARS(puenteMonto)}</td>
                        <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: "#f97316", fontSize: 12 }}>{fmtARS(resPuente.totalIntereses)}</td>
                        <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 800, color: "#fff", fontSize: 12 }}>{fmtARS(resPuente.totalPagado)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Nota */}
              <div style={{ background: "#1a1a0a", border: "1px solid #cc000033", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#666" }}>
                <strong style={{ color: "#cc0000" }}>Modalidad Bullet:</strong> Solo se pagan intereses mensualmente.
                El capital completo se devuelve en el último mes junto con los intereses de ese período.
                Garantía: <strong style={{ color: "#888" }}>{puenteGarantia}</strong>.
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2 — CRÉDITO OBRA
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "obra" && (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

            {/* Panel izquierdo: inputs */}
            <div style={{ width: 260, flexShrink: 0 }}>
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 20 }}>
                <h2 style={sectionTitleStyle}>Parámetros</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  <div>
                    <label style={labelStyle}>Monto total (ARS)</label>
                    <input
                      type="number"
                      value={obraMontoTotal}
                      onChange={e => setObraMontoTotal(Number(e.target.value))}
                      style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>Máx. $ 1.000.000.000</div>
                  </div>

                  <div>
                    <label style={labelStyle}>Superficie total (m²)</label>
                    <input
                      type="number"
                      value={obraSuperficie}
                      onChange={e => setObraSuperficie(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>TNA (%)</label>
                    <input
                      type="number"
                      step={0.5}
                      value={obraTna}
                      onChange={e => setObraTna(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Plazo obra (meses)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="range"
                        min={12}
                        max={48}
                        step={6}
                        value={obraPlazo}
                        onChange={e => setObraPlazo(Number(e.target.value))}
                        style={{ flex: 1, accentColor: "#cc0000" }}
                      />
                      <span style={{ minWidth: 28, fontSize: 13, color: "#fff", textAlign: "right" }}>
                        {obraPlazo}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Costo construcción (USD/m²)</label>
                    <input
                      type="number"
                      value={obraCostoM2}
                      onChange={e => setObraCostoM2(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Resumen del proyecto */}
                <div style={{ marginTop: 16, padding: "10px 12px", background: "#0a0a0a", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>Proyecto</div>
                  <div style={{ fontSize: 12, color: "#888", lineHeight: 1.8 }}>
                    <div>{fmt(obraSuperficie)} m² · {fmt(obraMontoTotal / (obraSuperficie || 1))} ARS/m²</div>
                    <div style={{ color: "#555", fontSize: 11 }}>Desembolsos en 4 tramos</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel derecho */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* KPI Cards */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  {
                    label: "Costo total / m²",
                    value: fmtARS(obraSuperficie > 0 ? obraMontoTotal / obraSuperficie : 0),
                    sub: fmtUSD(obraCostoM2) + " / m²",
                    color: "#cc0000",
                  },
                  {
                    label: "Intereses totales",
                    value: fmtARS(resObra.totalIntereses),
                    sub: `TNA ${obraTna}% · ${obraPlazo} meses`,
                    color: "#f97316",
                  },
                  {
                    label: "Total a devolver",
                    value: fmtARS(resObra.totalADevolver),
                    sub: "Capital + intereses",
                    color: "#e5e5e5",
                  },
                  {
                    label: "Costo financiero",
                    value: `${fmt(resObra.costoFinancieroPct, 1)}%`,
                    sub: "sobre el capital",
                    color: "#a855f7",
                  },
                ].map((kpi, i) => (
                  <div key={i} style={kpiCardStyle}>
                    <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color, fontFamily: "Montserrat, sans-serif" }}>
                      {kpi.value}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Timeline de desembolsos */}
              <ObraTimeline desembolsos={resObra.desembolsos} montoTotal={obraMontoTotal} />

              {/* SVG Area Chart — saldo deudor */}
              <ObraAreaChart saldoPorMes={resObra.saldoPorMes} montoTotal={obraMontoTotal} plazo={obraPlazo} />

              {/* Tabla desembolsos */}
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: "#1a1a1a", padding: "10px 16px", borderBottom: "1px solid #222" }}>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#fff" }}>
                    Plan de Desembolsos
                  </span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#161616" }}>
                      {["Tramo", "Mes", "% del Total", "Monto", "Saldo Acumulado"].map(h => (
                        <th key={h} style={{ padding: "8px 14px", textAlign: "right", fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, borderBottom: "1px solid #222" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resObra.desembolsos.map((d, i) => {
                      const labels = ["Anticipo", "Avance 25%", "Avance 50%", "Cierre de obra"];
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#0d0d0d" : "transparent", borderBottom: "1px solid #1a1a1a" }}>
                          <td style={{ padding: "8px 14px", color: "#cc0000", fontWeight: 700 }}>{labels[i]}</td>
                          <td style={{ padding: "8px 14px", textAlign: "right", color: "#888" }}>Mes {d.mes}</td>
                          <td style={{ padding: "8px 14px", textAlign: "right", color: "#f97316" }}>{(d.pct * 100).toFixed(0)}%</td>
                          <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: "#fff" }}>{fmtARS(d.monto)}</td>
                          <td style={{ padding: "8px 14px", textAlign: "right", color: "#a855f7" }}>{fmtARS(d.saldoAcumulado)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3 — FIDEICOMISO AL COSTO
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "fideicomiso" && (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

            {/* Panel izquierdo: inputs */}
            <div style={{ width: 260, flexShrink: 0 }}>
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 20 }}>
                <h2 style={sectionTitleStyle}>Parámetros</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  <div>
                    <label style={labelStyle}>Superficie total (m²)</label>
                    <input
                      type="number"
                      value={fidSuperficie}
                      onChange={e => setFidSuperficie(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Costo construcción (USD/m²)</label>
                    <input
                      type="number"
                      value={fidCostoM2}
                      onChange={e => setFidCostoM2(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Precio venta (USD/m²)</label>
                    <input
                      type="number"
                      value={fidPrecioVentaM2}
                      onChange={e => setFidPrecioVentaM2(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Cuotas inversores</label>
                    <select
                      value={fidCuotas}
                      onChange={e => setFidCuotas(Number(e.target.value) as 24 | 36 | 48)}
                      style={selectStyle}
                    >
                      <option value={24}>24 cuotas</option>
                      <option value={36}>36 cuotas</option>
                      <option value={48}>48 cuotas</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Anticipo (%)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="range"
                        min={10}
                        max={50}
                        step={5}
                        value={fidAnticipoP}
                        onChange={e => setFidAnticipoP(Number(e.target.value))}
                        style={{ flex: 1, accentColor: "#cc0000" }}
                      />
                      <span style={{ minWidth: 32, fontSize: 13, color: "#fff", textAlign: "right" }}>
                        {fidAnticipoP}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Tipo de cambio (ARS/USD)</label>
                    <input
                      type="number"
                      value={fidTc}
                      onChange={e => setFidTc(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Panel derecho */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* KPI Cards */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  {
                    label: "Costo por m² (inversión)",
                    value: fmtUSD(resFid.precioPorM2Inversion),
                    sub: `70% del costo construcción`,
                    color: "#cc0000",
                  },
                  {
                    label: "Precio venta m²",
                    value: fmtUSD(fidPrecioVentaM2),
                    sub: `Costo: ${fmtUSD(fidCostoM2)}/m²`,
                    color: "#22c55e",
                  },
                  {
                    label: "Margen bruto",
                    value: `${fmt(resFid.margenPct, 1)}%`,
                    sub: fmtUSD(resFid.gananciaProyecto),
                    color: "#f97316",
                  },
                  {
                    label: "Rendimiento inversor",
                    value: `${fmt(resFid.rendimientoInversor, 1)}%`,
                    sub: "sobre capital invertido",
                    color: "#a855f7",
                  },
                ].map((kpi, i) => (
                  <div key={i} style={kpiCardStyle}>
                    <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color, fontFamily: "Montserrat, sans-serif" }}>
                      {kpi.value}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Panel dos columnas: tabla + donut */}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

                {/* Tabla resumen inversores */}
                <div style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ background: "#1a1a1a", padding: "10px 16px", borderBottom: "1px solid #222" }}>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#fff" }}>
                      Estructura para Inversores
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <tbody>
                      {[
                        { label: "Costo construcción total", value: fmtUSD(resFid.costoTotal), color: "#888" },
                        { label: "Monto a financiar (70%)", value: fmtUSD(resFid.montoFinanciar), color: "#cc0000" },
                        { label: `Anticipo (${fidAnticipoP}%)`, value: fmtUSD(resFid.anticipoUSD), color: "#f97316" },
                        { label: "Saldo en cuotas", value: fmtUSD(resFid.saldoUSD), color: "#888" },
                        { label: `Cuota mensual (${fidCuotas} cuotas)`, value: fmtUSD(resFid.cuotaMensualUSD), color: "#22c55e", bold: true },
                        { label: "Total invertido por inversor", value: fmtUSD(resFid.montoFinanciar), color: "#888" },
                        { label: "Ingreso total del proyecto", value: fmtUSD(resFid.ingresoTotal), color: "#22c55e" },
                        { label: "Ganancia por m²", value: fmtUSD(fidPrecioVentaM2 - fidCostoM2), color: "#a855f7" },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #1a1a1a", background: i % 2 === 0 ? "#0d0d0d" : "transparent" }}>
                          <td style={{ padding: "9px 14px", fontSize: 12, color: "#888" }}>{row.label}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: row.bold ? 800 : 600, color: row.color, fontSize: row.bold ? 14 : 12 }}>
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Nota UVA */}
                  <div style={{ padding: "10px 14px", background: "#0a0a0a", borderTop: "1px solid #1a1a1a", fontSize: 11, color: "#555" }}>
                    Las cuotas se pueden emitir en UVA o pesos ajustados según contrato de fideicomiso.
                  </div>
                </div>

                {/* Donut SVG */}
                <FideicomisoDonut costoTotal={resFid.costoTotal} gananciaProyecto={resFid.gananciaProyecto} />
              </div>

              {/* Proyección de cuotas en ARS */}
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 16 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#fff", marginBottom: 12 }}>
                  Cuotas en ARS al TC actual
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {[
                    { label: "Anticipo", value: fmtARS(resFid.anticipoUSD * fidTc), sub: fmtUSD(resFid.anticipoUSD) },
                    { label: "Cuota mensual", value: fmtARS(resFid.cuotaMensualUSD * fidTc), sub: fmtUSD(resFid.cuotaMensualUSD) },
                    { label: "Total en cuotas (ARS)", value: fmtARS(resFid.saldoUSD * fidTc), sub: `${fidCuotas} cuotas` },
                    { label: "Total invertido (ARS)", value: fmtARS(resFid.montoFinanciar * fidTc), sub: "Anticipo + cuotas" },
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#cc0000", fontFamily: "Montserrat, sans-serif" }}>{item.value}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subcomponentes SVG ────────────────────────────────────────────────────────

function PuenteBarChart({ cuotas }: { cuotas: CuotaPuente[] }) {
  const W = 600;
  const H = 200;
  const PAD = { top: 16, bottom: 28, left: 8, right: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxCuota = Math.max(...cuotas.map(c => c.cuota), 1);
  const barW = Math.max(2, chartW / cuotas.length - 2);

  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 16 }}>
      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#fff", marginBottom: 12 }}>
        Flujo de pagos por mes
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          {cuotas.map((c, i) => {
            const x = PAD.left + i * (chartW / cuotas.length) + (chartW / cuotas.length - barW) / 2;
            const intH = Math.max(1, (c.interes / maxCuota) * chartH);
            const capH = Math.max(0, (c.capital / maxCuota) * chartH);
            const totalH = intH + capH;
            const isLast = i === cuotas.length - 1;
            return (
              <g key={c.mes}>
                {/* Capital bar (bottom segment of last) */}
                {capH > 0 && (
                  <rect
                    x={x}
                    y={PAD.top + chartH - totalH}
                    width={barW}
                    height={capH}
                    fill="#cc0000"
                    opacity={isLast ? 1 : 0.6}
                  />
                )}
                {/* Interest bar */}
                <rect
                  x={x}
                  y={PAD.top + chartH - intH - capH}
                  width={barW}
                  height={intH}
                  fill={isLast ? "#cc0000" : "#333"}
                />
                {/* Last bar highlight stroke */}
                {isLast && (
                  <rect
                    x={x - 1}
                    y={PAD.top + chartH - totalH - 1}
                    width={barW + 2}
                    height={totalH + 2}
                    fill="none"
                    stroke="#cc0000"
                    strokeWidth={1.5}
                  />
                )}
                {/* Mes label */}
                {(i === 0 || (i + 1) % 3 === 0 || i === cuotas.length - 1) && (
                  <text
                    x={x + barW / 2}
                    y={H - 6}
                    fontSize={9}
                    fill="#555"
                    textAnchor="middle"
                  >
                    {c.mes}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#666" }}>
          <div style={{ width: 12, height: 10, background: "#333", borderRadius: 2 }} /> Intereses mensuales
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#666" }}>
          <div style={{ width: 12, height: 10, background: "#cc0000", borderRadius: 2 }} /> Capital (último mes)
        </div>
      </div>
    </div>
  );
}

function ObraTimeline({ desembolsos, montoTotal }: { desembolsos: DesembolsoObra[]; montoTotal: number }) {
  const labels = ["Anticipo", "Avance 25%", "Avance 50%", "Cierre"];
  const colors = ["#cc0000", "#f97316", "#eab308", "#22c55e"];

  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 20 }}>
      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#fff", marginBottom: 16 }}>
        Timeline de Desembolsos
      </div>
      <div style={{ position: "relative" }}>
        {/* Línea horizontal */}
        <div style={{ position: "absolute", top: 16, left: "6%", right: "6%", height: 2, background: "#333", zIndex: 0 }} />
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          {desembolsos.map((d, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              {/* Nodo */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: colors[i],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "#fff",
                fontFamily: "Montserrat, sans-serif",
                border: `2px solid ${colors[i]}`,
                boxShadow: `0 0 10px ${colors[i]}44`,
              }}>
                {(d.pct * 100).toFixed(0)}%
              </div>
              {/* Flecha abajo */}
              <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `8px solid ${colors[i]}`, marginTop: 4 }} />
              {/* Info */}
              <div style={{ marginTop: 8, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: colors[i] }}>{labels[i]}</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>Mes {d.mes}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                  {montoTotal > 0 ? `$ ${fmt(d.monto / 1_000_000, 1)}M` : "—"}
                </div>
                <div style={{ fontSize: 10, color: "#555" }}>
                  Saldo: $ {fmt(d.saldoAcumulado / 1_000_000, 1)}M
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ObraAreaChart({ saldoPorMes, montoTotal, plazo }: { saldoPorMes: number[]; montoTotal: number; plazo: number }) {
  const W = 600;
  const H = 160;
  const PAD = { top: 16, bottom: 24, left: 8, right: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxSaldo = Math.max(montoTotal, 1);
  const n = saldoPorMes.length;
  if (n < 2) return null;

  const pts = saldoPorMes.map((s, i) => {
    const x = PAD.left + (i / (n - 1)) * chartW;
    const y = PAD.top + chartH - (s / maxSaldo) * chartH;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${PAD.left},${PAD.top + chartH}`,
    ...pts,
    `${PAD.left + chartW},${PAD.top + chartH}`,
  ].join(" ");

  // Marcadores en meses de desembolso
  const markers = DESEMBOLSOS_MESES.filter(m => m < n).map(m => ({
    m,
    x: PAD.left + (m / (n - 1)) * chartW,
    y: PAD.top + chartH - (saldoPorMes[m] / maxSaldo) * chartH,
    saldo: saldoPorMes[m],
  }));

  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 16 }}>
      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#fff", marginBottom: 8 }}>
        Saldo deudor acumulado (mes a mes)
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          <defs>
            <linearGradient id="obraGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cc0000" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#cc0000" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {/* Area */}
          <polygon points={areaPoints} fill="url(#obraGrad)" />
          {/* Line */}
          <polyline points={pts.join(" ")} fill="none" stroke="#cc0000" strokeWidth={2} />
          {/* Markers */}
          {markers.map(mk => (
            <g key={mk.m}>
              <circle cx={mk.x} cy={mk.y} r={4} fill="#cc0000" />
              <text x={mk.x} y={H - 6} fontSize={9} fill="#555" textAnchor="middle">M{mk.m}</text>
            </g>
          ))}
          {/* Eje Y referencia */}
          <text x={PAD.left} y={PAD.top + 8} fontSize={9} fill="#555">
            $ {fmt(montoTotal / 1_000_000, 0)}M
          </text>
          <text x={PAD.left} y={PAD.top + chartH} fontSize={9} fill="#555">0</text>
        </svg>
      </div>
    </div>
  );
}

function FideicomisoDonut({ costoTotal, gananciaProyecto }: { costoTotal: number; gananciaProyecto: number }) {
  const total = costoTotal + Math.max(0, gananciaProyecto);
  const r = 50;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;

  const costoPct = total > 0 ? costoTotal / total : 0;
  const gananciaPct = total > 0 ? Math.max(0, gananciaProyecto) / total : 0;

  const costoLen = costoPct * circumference;
  const gananciaLen = gananciaPct * circumference;

  const fmt2 = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 20, minWidth: 200, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#fff" }}>
        Estructura del Proyecto
      </div>
      <svg width={160} height={160} viewBox="0 0 160 160">
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#222" strokeWidth={20} />
        {/* Costo */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#cc0000"
          strokeWidth={20}
          strokeDasharray={`${costoLen} ${circumference - costoLen}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="butt"
        />
        {/* Ganancia */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#22c55e"
          strokeWidth={20}
          strokeDasharray={`${gananciaLen} ${circumference - gananciaLen}`}
          strokeDashoffset={circumference / 4 - costoLen}
          strokeLinecap="butt"
        />
        {/* Centro */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={12} fontWeight="800" fill="#fff" fontFamily="Montserrat, sans-serif">
          {total > 0 ? `${(gananciaPct * 100).toFixed(0)}%` : "—"}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#888">margen</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#cc0000" }} />
            <span style={{ color: "#888" }}>Costo</span>
          </div>
          <span style={{ color: "#cc0000", fontWeight: 700 }}>USD {fmt2(costoTotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e" }} />
            <span style={{ color: "#888" }}>Ganancia</span>
          </div>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>USD {fmt2(Math.max(0, gananciaProyecto))}</span>
        </div>
      </div>
    </div>
  );
}
