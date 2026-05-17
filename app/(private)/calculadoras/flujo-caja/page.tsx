"use client";

import { useState, useMemo } from "react";

interface Config {
  precioCompraUSD: number;
  tipocambio: number;
  alquilerInicialARS: number;
  inflacionAnualPct: number;
  vacanciaPct: number;
  gastosAdminPct: number;
  mantenimientoAnualARS: number;
  expensasARS: number;
  impuestoPropAnualARS: number;
  seguroAnualARS: number;
  financiamientoPct: number;
  tasaAnualPct: number;
  plazoAnios: number;
  aumentoAlquilerMeses: number; // cada cuántos meses sube
}

interface MesData {
  mes: number;
  anio: number;
  alquilerBruto: number;
  vacanciaARS: number;
  gastoAdmin: number;
  mantenimiento: number;
  expensas: number;
  impuesto: number;
  seguro: number;
  cuotaHipoteca: number;
  ingresosNetos: number;
  egresosTotales: number;
  cashflow: number;
  cashflowAcum: number;
}

function cuotaMensual(capital: number, tna: number, plazoAnios: number): number {
  const r = tna / 100 / 12;
  const n = plazoAnios * 12;
  if (r === 0) return capital / n;
  return (capital * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

const fmtARS = (v: number) =>
  "$ " + Math.round(v).toLocaleString("es-AR");

const fmtK = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "+";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${Math.round(abs).toLocaleString("es-AR")}`;
};

function colorCF(v: number): string {
  if (v > 0) return "#22c55e";
  if (v < -5000) return "#ef4444";
  return "#f97316";
}

export default function FlujoCajaPage() {
  const [cfg, setCfg] = useState<Config>({
    precioCompraUSD: 100000,
    tipocambio: 1000,
    alquilerInicialARS: 600000,
    inflacionAnualPct: 60,
    vacanciaPct: 8,
    gastosAdminPct: 5,
    mantenimientoAnualARS: 120000,
    expensasARS: 30000,
    impuestoPropAnualARS: 60000,
    seguroAnualARS: 36000,
    financiamientoPct: 0,
    tasaAnualPct: 8,
    plazoAnios: 20,
    aumentoAlquilerMeses: 6,
  });
  const [horizonte, setHorizonte] = useState(24); // meses
  const [vistaAnual, setVistaAnual] = useState(false);

  const capitalFinanciado = cfg.precioCompraUSD * cfg.tipocambio * (cfg.financiamientoPct / 100);
  const cuota = cuotaMensual(capitalFinanciado, cfg.tasaAnualPct, cfg.plazoAnios);

  const meses = useMemo((): MesData[] => {
    const data: MesData[] = [];
    let acum = 0;
    const inflacionMensual = Math.pow(1 + cfg.inflacionAnualPct / 100, 1 / 12) - 1;

    for (let i = 0; i < horizonte; i++) {
      const periodoAumento = Math.floor(i / cfg.aumentoAlquilerMeses);
      const factorAumento = Math.pow(
        1 + (cfg.inflacionAnualPct / 100) * (cfg.aumentoAlquilerMeses / 12),
        periodoAumento
      );
      const alquilerBruto = cfg.alquilerInicialARS * factorAumento;

      const factorInflacion = Math.pow(1 + inflacionMensual, i);
      const expensasMes = cfg.expensasARS * factorInflacion;
      const mantenimientoMes = (cfg.mantenimientoAnualARS / 12) * factorInflacion;
      const impuestoMes = (cfg.impuestoPropAnualARS / 12) * factorInflacion;
      const seguroMes = (cfg.seguroAnualARS / 12) * factorInflacion;

      const vacanciaARS = alquilerBruto * (cfg.vacanciaPct / 100);
      const ingresoEfectivo = alquilerBruto - vacanciaARS;
      const gastoAdmin = ingresoEfectivo * (cfg.gastosAdminPct / 100);
      const ingresosNetos = ingresoEfectivo - gastoAdmin;

      const egresosTotales =
        expensasMes + mantenimientoMes + impuestoMes + seguroMes + cuota;

      const cf = ingresosNetos - egresosTotales;
      acum += cf;

      data.push({
        mes: i + 1,
        anio: Math.floor(i / 12) + 1,
        alquilerBruto,
        vacanciaARS,
        gastoAdmin,
        mantenimiento: mantenimientoMes,
        expensas: expensasMes,
        impuesto: impuestoMes,
        seguro: seguroMes,
        cuotaHipoteca: cuota,
        ingresosNetos,
        egresosTotales,
        cashflow: cf,
        cashflowAcum: acum,
      });
    }
    return data;
  }, [cfg, horizonte, cuota]);

  const aniosSafe = useMemo(() => {
    const map = new Map<number, typeof meses[number][]>();
    for (const m of meses) {
      if (!map.has(m.anio)) map.set(m.anio, []);
      map.get(m.anio)!.push(m);
    }
    const result: Array<{
      anio: number; ingresosNetos: number; egresosTotales: number;
      cashflow: number; cashflowAcum: number; rentaNetaPct: number;
    }> = [];
    let acum = 0;
    for (const [anio, arr] of map) {
      const ing = arr.reduce((s, x) => s + x.ingresosNetos, 0);
      const egr = arr.reduce((s, x) => s + x.egresosTotales, 0);
      const cf = ing - egr;
      acum += cf;
      result.push({
        anio,
        ingresosNetos: ing,
        egresosTotales: egr,
        cashflow: cf,
        cashflowAcum: acum,
        rentaNetaPct: (ing / (cfg.precioCompraUSD * cfg.tipocambio)) * 100,
      });
    }
    return result;
  }, [meses, cfg]);

  const totalCF = meses.reduce((s, m) => s + m.cashflow, 0);
  const mesesPositivos = meses.filter((m) => m.cashflow > 0).length;
  const breakEvenMes = meses.find((m) => m.cashflowAcum >= 0);

  // SVG cashflow chart
  const svgW = 680;
  const svgH = 160;
  const pad = { top: 16, bottom: 24, left: 48, right: 16 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;

  const allCF = meses.map((m) => m.cashflow);
  const minCF = Math.min(...allCF);
  const maxCF = Math.max(...allCF);
  const rangeY = maxCF - minCF || 1;
  const zeroY = pad.top + ((maxCF / rangeY) * chartH);

  function xPos(i: number) {
    return pad.left + (i / (meses.length - 1)) * chartW;
  }
  function yPos(v: number) {
    return pad.top + ((maxCF - v) / rangeY) * chartH;
  }

  const barW = Math.max(2, chartW / meses.length - 1);

  const inp: React.CSSProperties = {
    background: "#111", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 14, width: "100%",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>
            Flujo de Caja
          </h1>
          <p style={{ color: "#999", fontSize: 14, margin: "8px 0 0" }}>
            Proyección mes a mes de ingresos, egresos y cashflow neto
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
          {/* Config */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, height: "fit-content" }}>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, margin: "0 0 16px", color: "#cc0000" }}>
              Parámetros
            </h2>

            {[
              { label: "Precio compra (USD)", key: "precioCompraUSD", step: 5000 },
              { label: "Tipo de cambio (ARS/USD)", key: "tipochangio", step: 50 },
              { label: "Alquiler inicial (ARS/mes)", key: "alquilerInicialARS", step: 10000 },
              { label: "Inflación anual (%)", key: "inflacionAnualPct", step: 1 },
              { label: "Vacancia (%)", key: "vacanciaPct", step: 1, max: 50 },
              { label: "Gastos admin (%)", key: "gastosAdminPct", step: 1, max: 30 },
              { label: "Mantenimiento (ARS/año)", key: "mantenimientoAnualARS", step: 10000 },
              { label: "Expensas (ARS/mes)", key: "expensasARS", step: 5000 },
              { label: "Imp. inmueble (ARS/año)", key: "impuestoPropAnualARS", step: 5000 },
              { label: "Seguro (ARS/año)", key: "seguroAnualARS", step: 5000 },
              { label: "% Financiado", key: "financiamientoPct", step: 5, max: 90 },
              { label: "TNA crédito (%)", key: "tasaAnualPct", step: 0.5, max: 30 },
              { label: "Aumento alquiler (meses)", key: "aumentoAlquilerMeses", step: 1, min: 1, max: 24 },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 3, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                  {f.label}
                </div>
                <input
                  type="number"
                  value={(cfg as unknown as Record<string, number>)[f.key] ?? 0}
                  step={f.step}
                  min={f.min ?? 0}
                  max={f.max}
                  onChange={(e) => setCfg((c) => ({ ...c, [f.key]: parseFloat(e.target.value) || 0 }))}
                  style={inp}
                />
              </div>
            ))}

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: "#888", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                Horizonte de proyección
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[12, 24, 36, 60].map((h) => (
                  <button key={h} onClick={() => setHorizonte(h)} style={{
                    flex: 1, padding: "6px 0", borderRadius: 6,
                    border: horizonte === h ? "1px solid #cc0000" : "1px solid #333",
                    background: horizonte === h ? "rgba(204,0,0,0.15)" : "#161616",
                    color: horizonte === h ? "#cc0000" : "#888",
                    fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, cursor: "pointer",
                  }}>
                    {h}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { label: "CF acumulado", value: fmtK(totalCF), color: totalCF >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Meses positivos", value: `${mesesPositivos}/${horizonte}`, color: "#fff" },
                {
                  label: "CF mensual promedio",
                  value: fmtK(totalCF / horizonte),
                  color: totalCF / horizonte >= 0 ? "#22c55e" : "#ef4444",
                },
                {
                  label: "Break-even acum.",
                  value: breakEvenMes ? `Mes ${breakEvenMes.mes}` : "No alcanzado",
                  color: breakEvenMes ? "#22c55e" : "#f97316",
                },
              ].map((k) => (
                <div key={k.label} style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                    {k.label}
                  </div>
                  <div style={{ fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: k.color }}>
                    {k.value}
                  </div>
                </div>
              ))}
            </div>

            {/* SVG Chart */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "20px 20px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>
                  Cashflow mensual (ARS)
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { v: false, l: "Mensual" },
                    { v: true, l: "Anual" },
                  ].map((t) => (
                    <button key={String(t.v)} onClick={() => setVistaAnual(t.v)} style={{
                      padding: "4px 12px", borderRadius: 12,
                      border: vistaAnual === t.v ? "1px solid #cc0000" : "1px solid #333",
                      background: vistaAnual === t.v ? "rgba(204,0,0,0.15)" : "transparent",
                      color: vistaAnual === t.v ? "#cc0000" : "#666",
                      fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, cursor: "pointer",
                    }}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <svg width={svgW} height={svgH}>
                  {/* Zero line */}
                  <line x1={pad.left} y1={zeroY} x2={svgW - pad.right} y2={zeroY} stroke="#333" strokeWidth={1} strokeDasharray="4,4" />
                  {/* Bars */}
                  {meses.map((m, i) => {
                    const bx = pad.left + (i / meses.length) * chartW;
                    const bh = Math.abs(yPos(m.cashflow) - zeroY);
                    const by = m.cashflow >= 0 ? yPos(m.cashflow) : zeroY;
                    return (
                      <rect
                        key={m.mes}
                        x={bx + 1}
                        y={by}
                        width={barW}
                        height={Math.max(1, bh)}
                        fill={m.cashflow >= 0 ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"}
                        rx={1}
                      />
                    );
                  })}
                  {/* Acum line */}
                  {meses.length > 1 && (() => {
                    const acumVals = meses.map((m) => m.cashflowAcum);
                    const minA = Math.min(...acumVals);
                    const maxA = Math.max(...acumVals);
                    const rA = maxA - minA || 1;
                    const pts = meses.map((m, i) => {
                      const ax = pad.left + (i / (meses.length - 1)) * chartW;
                      const ay = pad.top + ((maxA - m.cashflowAcum) / rA) * chartH;
                      return `${ax},${ay}`;
                    }).join(" ");
                    return <polyline points={pts} fill="none" stroke="#cc0000" strokeWidth={2} opacity={0.8} />;
                  })()}
                  {/* Labels */}
                  {[0, Math.floor(horizonte / 4), Math.floor(horizonte / 2), Math.floor((3 * horizonte) / 4), horizonte - 1].map((i) =>
                    i < meses.length ? (
                      <text key={i} x={pad.left + (i / (meses.length - 1)) * chartW} y={svgH - 4} textAnchor="middle" fill="#666" fontSize={9} fontFamily="Montserrat,sans-serif">
                        m{i + 1}
                      </text>
                    ) : null
                  )}
                </svg>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 12, height: 8, borderRadius: 2, background: "rgba(34,197,94,0.7)" }} />
                  <span style={{ fontSize: 11, color: "#888" }}>Cashflow positivo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 12, height: 8, borderRadius: 2, background: "rgba(239,68,68,0.7)" }} />
                  <span style={{ fontSize: 11, color: "#888" }}>Cashflow negativo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 20, height: 2, background: "#cc0000" }} />
                  <span style={{ fontSize: 11, color: "#888" }}>CF acumulado</span>
                </div>
              </div>
            </div>

            {/* Tabla */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: "0 0 16px", color: "#fff" }}>
                Detalle {vistaAnual ? "Anual" : "Mensual"}
              </h3>
              <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0, background: "#111", zIndex: 1 }}>
                    <tr>
                      {[
                        vistaAnual ? "Año" : "Mes",
                        "Alquiler bruto",
                        "Ingresos netos",
                        "Egresos",
                        "Cashflow",
                        "CF acumulado",
                      ].map((h) => (
                        <th key={h} style={{ textAlign: "right", padding: "6px 10px", color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid #222" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vistaAnual
                      ? aniosSafe.map((a) => (
                          <tr key={a.anio} style={{ borderBottom: "1px solid #1a1a1a" }}>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#888" }}>Año {a.anio}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", color: "#fff" }}>—</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", color: "#22c55e" }}>{fmtK(a.ingresosNetos)}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", color: "#ef4444" }}>{fmtK(-a.egresosTotales)}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: colorCF(a.cashflow) }}>{fmtK(a.cashflow)}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: a.cashflowAcum >= 0 ? "#22c55e" : "#ef4444" }}>{fmtK(a.cashflowAcum)}</td>
                          </tr>
                        ))
                      : meses.map((m) => (
                          <tr key={m.mes} style={{ borderBottom: "1px solid #161616" }}>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>M{m.mes}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "#aaa" }}>{fmtARS(m.alquilerBruto)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "#22c55e" }}>{fmtARS(m.ingresosNetos)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "#ef4444" }}>{fmtARS(-m.egresosTotales)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: colorCF(m.cashflow) }}>{fmtARS(m.cashflow)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: m.cashflowAcum >= 0 ? "#22c55e" : "#ef4444" }}>{fmtARS(m.cashflowAcum)}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
