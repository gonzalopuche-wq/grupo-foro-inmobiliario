"use client";

import { useState, useMemo } from "react";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Config {
  // Pozo
  precioPozoUSD: number;
  precioTerminadoUSD: number;
  m2totales: number;
  // Estructura de pagos
  reservaUSD: number;
  cuotasMonto: number;    // monto cuota en USD
  cuotasTotal: number;    // cantidad de cuotas
  saldoEntregaUSD: number;
  // Tiempo
  mesesObra: number;
  // Inflacion/TC
  tipoCambioHoy: number;
  apreciacionAnualUSD: number; // % revalorizacion USD anual al entregar
  // Alquiler post-entrega
  alquilerMensualUSD: number;
  vacanciaPct: number;
  gastosOperativosPct: number;
  // Alternativa: plazo fijo/bono
  tasaAltAnualUSD: number;
}

function fmtUSD(v: number, decimals = 0) {
  return "USD " + v.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(v: number) { return v.toFixed(2) + "%"; }

// TIR simplificada con Newton-Raphson
function calcTIR(flujos: number[], guess = 0.1): number {
  let r = guess;
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < flujos.length; t++) {
      npv += flujos[t] / Math.pow(1 + r, t);
      dnpv -= t * flujos[t] / Math.pow(1 + r, t + 1);
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const rNew = r - npv / dnpv;
    if (Math.abs(rNew - r) < 1e-8) { r = rNew; break; }
    r = rNew;
  }
  return r;
}

export default function InversionPozoPage() {
  const [cfg, setCfg] = useState<Config>({
    precioPozoUSD: 80000,
    precioTerminadoUSD: 120000,
    m2totales: 55,
    reservaUSD: 5000,
    cuotasMonto: 700,
    cuotasTotal: 36,
    saldoEntregaUSD: 35000,
    mesesObra: 42,
    tipoCambioHoy: 1000,
    apreciacionAnualUSD: 5,
    alquilerMensualUSD: 600,
    vacanciaPct: 8,
    gastosOperativosPct: 20,
    tasaAltAnualUSD: 7,
  });

  const [tab, setTab] = useState<"resumen" | "flujos" | "comparacion">("resumen");

  // Calcular costo total de adquisición
  const costoTotal = useMemo(() => {
    const cuotas = cfg.cuotasMonto * cfg.cuotasTotal;
    return cfg.reservaUSD + cuotas + cfg.saldoEntregaUSD;
  }, [cfg]);

  // Precio m2 pozo vs terminado
  const precioPozoM2 = cfg.m2totales > 0 ? cfg.precioPozoUSD / cfg.m2totales : 0;
  const precioTerminadoM2 = cfg.m2totales > 0 ? cfg.precioTerminadoUSD / cfg.m2totales : 0;

  // Valor al entregar con apreciación adicional
  const apreciacionFactor = Math.pow(
    1 + cfg.apreciacionAnualUSD / 100,
    cfg.mesesObra / 12
  );
  const valorAlEntregar = cfg.precioTerminadoUSD * apreciacionFactor;

  // Ganancia capital
  const gananciaCapital = valorAlEntregar - costoTotal;
  const gananciaCapitalPct = costoTotal > 0 ? (gananciaCapital / costoTotal) * 100 : 0;

  // Renta anual neta post-entrega
  const rentaBrutaAnual = cfg.alquilerMensualUSD * 12;
  const rentaEfectiva = rentaBrutaAnual * (1 - cfg.vacanciaPct / 100);
  const gastos = rentaEfectiva * (cfg.gastosOperativosPct / 100);
  const rentaNetaAnual = rentaEfectiva - gastos;
  const rentaNetaPct = valorAlEntregar > 0 ? (rentaNetaAnual / valorAlEntregar) * 100 : 0;

  // Flujos mensuales para TIR (horizonte 5 años post-entrega = obra + 60 meses)
  const flujosMensuales = useMemo(() => {
    const horizon = cfg.mesesObra + 60;
    const fl: number[] = new Array(horizon + 1).fill(0);

    // Mes 0: reserva (egreso)
    fl[0] -= cfg.reservaUSD;

    // Cuotas durante obra
    for (let m = 1; m <= Math.min(cfg.cuotasTotal, cfg.mesesObra); m++) {
      fl[m] -= cfg.cuotasMonto;
    }

    // Saldo contra entrega
    fl[cfg.mesesObra] -= cfg.saldoEntregaUSD;

    // Ingresos por alquiler post-entrega (60 meses = 5 años)
    const rentaMensualNeta = rentaNetaAnual / 12;
    for (let m = cfg.mesesObra + 1; m <= horizon; m++) {
      fl[m] += rentaMensualNeta;
    }

    // Venta al final del horizonte
    fl[horizon] += valorAlEntregar;

    return fl;
  }, [cfg, rentaNetaAnual, valorAlEntregar]);

  const tirMensual = useMemo(() => {
    try { return calcTIR(flujosMensuales); }
    catch { return null; }
  }, [flujosMensuales]);

  const tirAnual = tirMensual != null ? (Math.pow(1 + tirMensual, 12) - 1) * 100 : null;

  // Alternativa: invertir en renta fija USD
  const inversionEquivalente = cfg.reservaUSD + cfg.cuotasMonto * Math.min(cfg.cuotasTotal, cfg.mesesObra);
  const tasaAltMensual = cfg.tasaAltAnualUSD / 100 / 12;
  const valorAltAlEntregar = inversionEquivalente * Math.pow(1 + tasaAltMensual, cfg.mesesObra);

  // Ventaja vs alternativa
  const ventajaVsAlt = gananciaCapital - (valorAltAlEntregar - inversionEquivalente);

  // Tabla de flujos por año
  const flujosAnuales = useMemo(() => {
    const result: Array<{ anio: number; egreso: number; ingreso: number; neto: number; acum: number }> = [];
    let acum = 0;
    const totalAnios = Math.ceil((cfg.mesesObra + 60) / 12);
    for (let a = 0; a < totalAnios; a++) {
      let egreso = 0;
      let ingreso = 0;
      for (let m = a * 12; m < Math.min((a + 1) * 12, flujosMensuales.length); m++) {
        const f = flujosMensuales[m] ?? 0;
        if (f < 0) egreso += Math.abs(f);
        else ingreso += f;
      }
      const neto = ingreso - egreso;
      acum += neto;
      result.push({ anio: a + 1, egreso, ingreso, neto, acum });
    }
    return result;
  }, [flujosMensuales, cfg.mesesObra]);

  const payback = useMemo(() => {
    return flujosAnuales.find((a) => a.acum >= 0)?.anio ?? null;
  }, [flujosAnuales]);

  const inp: React.CSSProperties = {
    background: "#111", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 10px", fontSize: 13, width: "100%",
    fontFamily: "Inter, sans-serif",
  };

  const set = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCfg((c) => ({ ...c, [k]: parseFloat(e.target.value) || 0 }));

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>
            Inversión en Pozo
          </h1>
          <p style={{ color: "#999", fontSize: 14, margin: "8px 0 0" }}>
            Análisis de rentabilidad para compra en pre-construcción
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
          {/* Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Propiedad */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 18 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#cc0000", marginBottom: 14, textTransform: "uppercase" }}>
                Propiedad
              </div>
              {[
                { label: "Precio pozo (USD)", key: "precioPozoUSD" as const, step: 1000 },
                { label: "Precio terminado (USD)", key: "precioTerminadoUSD" as const, step: 1000 },
                { label: "Superficie (m²)", key: "m2totales" as const, step: 1 },
                { label: "Meses de obra", key: "mesesObra" as const, step: 1, min: 6 },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 3, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                    {f.label}
                  </div>
                  <input type="number" value={cfg[f.key]} step={f.step} min={f.min ?? 0} onChange={set(f.key)} style={inp} />
                </div>
              ))}
            </div>

            {/* Pagos */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 18 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#3b82f6", marginBottom: 14, textTransform: "uppercase" }}>
                Estructura de Pagos
              </div>
              {[
                { label: "Reserva (USD)", key: "reservaUSD" as const, step: 500 },
                { label: "Cuota mensual (USD)", key: "cuotasMonto" as const, step: 50 },
                { label: "Cantidad de cuotas", key: "cuotasTotal" as const, step: 1 },
                { label: "Saldo contra entrega (USD)", key: "saldoEntregaUSD" as const, step: 1000 },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 3, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                    {f.label}
                  </div>
                  <input type="number" value={cfg[f.key]} step={f.step} min={0} onChange={set(f.key)} style={inp} />
                </div>
              ))}
            </div>

            {/* Post-entrega */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 18 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#22c55e", marginBottom: 14, textTransform: "uppercase" }}>
                Renta Post-Entrega
              </div>
              {[
                { label: "Apreciación anual USD (%)", key: "apreciacionAnualUSD" as const, step: 0.5 },
                { label: "Alquiler mensual (USD)", key: "alquilerMensualUSD" as const, step: 50 },
                { label: "Vacancia (%)", key: "vacanciaPct" as const, step: 1, max: 50 },
                { label: "Gastos operativos (%)", key: "gastosOperativosPct" as const, step: 1, max: 40 },
                { label: "Tasa alternativa anual (%)", key: "tasaAltAnualUSD" as const, step: 0.5 },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 3, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                    {f.label}
                  </div>
                  <input type="number" value={cfg[f.key]} step={f.step} min={0} max={(f as { max?: number }).max} onChange={set(f.key)} style={inp} />
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Tab selector */}
            <div style={{ display: "flex", gap: 8 }}>
              {(["resumen", "flujos", "comparacion"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "8px 20px", borderRadius: 8,
                  border: tab === t ? "1px solid #cc0000" : "1px solid #333",
                  background: tab === t ? "rgba(204,0,0,0.15)" : "#111",
                  color: tab === t ? "#cc0000" : "#888",
                  fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12,
                  cursor: "pointer", textTransform: "capitalize",
                }}>
                  {t === "resumen" ? "Resumen" : t === "flujos" ? "Flujos" : "Comparación"}
                </button>
              ))}
            </div>

            {/* RESUMEN */}
            {tab === "resumen" && (
              <>
                {/* KPIs principales */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                  {[
                    { label: "Costo total inversión", value: fmtUSD(costoTotal), sub: `vs precio pozo ${fmtUSD(cfg.precioPozoUSD)}` },
                    { label: "Valor al entregar", value: fmtUSD(Math.round(valorAlEntregar)), sub: `apreciación incluida` },
                    {
                      label: "Ganancia capital",
                      value: fmtUSD(Math.round(gananciaCapital)),
                      sub: fmtPct(gananciaCapitalPct) + " sobre inversión",
                      highlight: gananciaCapital > 0,
                    },
                  ].map((k) => (
                    <div key={k.label} style={{ background: "#111", border: k.highlight ? "1px solid rgba(34,197,94,0.4)" : "1px solid #222", borderRadius: 12, padding: "18px 16px" }}>
                      <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                        {k.label}
                      </div>
                      <div style={{ fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: k.highlight ? "#22c55e" : "#fff", marginBottom: 4 }}>
                        {k.value}
                      </div>
                      <div style={{ fontSize: 11, color: "#666" }}>{k.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                  {[
                    { label: "TIR anual (5a post-entrega)", value: tirAnual != null ? fmtPct(tirAnual) : "—", color: tirAnual != null && tirAnual > 10 ? "#22c55e" : "#f97316" },
                    { label: "Renta neta anual", value: fmtPct(rentaNetaPct), color: rentaNetaPct > 4 ? "#22c55e" : "#f97316" },
                    { label: "Payback total", value: payback != null ? `Año ${payback}` : "No alcanzado", color: "#fff" },
                  ].map((k) => (
                    <div key={k.label} style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "18px 16px" }}>
                      <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                        {k.label}
                      </div>
                      <div style={{ fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: k.color }}>
                        {k.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desglose de inversión */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
                  <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: "0 0 16px", color: "#fff" }}>
                    Desglose de Inversión
                  </h3>
                  {[
                    { label: "Reserva", value: cfg.reservaUSD, color: "#cc0000" },
                    { label: `${cfg.cuotasTotal} cuotas × ${fmtUSD(cfg.cuotasMonto)}`, value: cfg.cuotasMonto * cfg.cuotasTotal, color: "#3b82f6" },
                    { label: "Saldo contra entrega", value: cfg.saldoEntregaUSD, color: "#f97316" },
                  ].map((row) => {
                    const pct = costoTotal > 0 ? (row.value / costoTotal) * 100 : 0;
                    return (
                      <div key={row.label} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: "#aaa" }}>{row.label}</span>
                          <span style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>
                            {fmtUSD(row.value)} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div style={{ height: 6, background: "#1a1a1a", borderRadius: 3 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: row.color, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #222", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>Total</span>
                    <span style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000" }}>{fmtUSD(costoTotal)}</span>
                  </div>
                </div>

                {/* Precio m2 */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
                  <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: "0 0 14px", color: "#fff" }}>
                    Precio por m²
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                    {[
                      { label: "Precio en pozo", value: `${fmtUSD(Math.round(precioPozoM2))}/m²`, color: "#3b82f6" },
                      { label: "Precio terminado", value: `${fmtUSD(Math.round(precioTerminadoM2))}/m²`, color: "#f59e0b" },
                      { label: "Precio al entregar", value: `${fmtUSD(Math.round(valorAlEntregar / cfg.m2totales))}/m²`, color: "#22c55e" },
                    ].map((k) => (
                      <div key={k.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                          {k.label}
                        </div>
                        <div style={{ fontSize: 16, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: k.color }}>
                          {k.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* FLUJOS */}
            {tab === "flujos" && (
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: "0 0 16px", color: "#fff" }}>
                  Flujos Anuales (obra + 5 años post-entrega)
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Año", "Egresos", "Ingresos", "Neto", "Acumulado", "Estado"].map((h) => (
                          <th key={h} style={{ textAlign: "right", padding: "8px 12px", color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid #222" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {flujosAnuales.map((a) => (
                        <tr key={a.anio} style={{ borderBottom: "1px solid #1a1a1a" }}>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: a.anio <= Math.ceil(cfg.mesesObra / 12) ? "#f97316" : "#22c55e" }}>
                            {a.anio <= Math.ceil(cfg.mesesObra / 12) ? `Obra a${a.anio}` : `Post ${a.anio - Math.ceil(cfg.mesesObra / 12)}a`}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#ef4444" }}>{a.egreso > 0 ? `-${fmtUSD(Math.round(a.egreso))}` : "—"}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#22c55e" }}>{a.ingreso > 0 ? `+${fmtUSD(Math.round(a.ingreso))}` : "—"}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: a.neto >= 0 ? "#22c55e" : "#ef4444" }}>
                            {a.neto >= 0 ? "+" : ""}{fmtUSD(Math.round(a.neto))}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: a.acum >= 0 ? "#22c55e" : "#ef4444" }}>
                            {fmtUSD(Math.round(a.acum))}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>
                            {a.acum >= 0 ? (
                              <span style={{ fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.15)", borderRadius: 4, padding: "2px 6px" }}>✓ Recuperado</span>
                            ) : (
                              <span style={{ fontSize: 11, color: "#666" }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* COMPARACIÓN */}
            {tab === "comparacion" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
                  <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: "0 0 16px", color: "#fff" }}>
                    Pozo vs Renta Fija (USD {cfg.tasaAltAnualUSD}% anual)
                  </h3>
                  <p style={{ fontSize: 12, color: "#666", margin: "0 0 16px" }}>
                    Comparación de invertir la reserva + cuotas en un instrumento de renta fija en dólares durante el período de obra ({cfg.mesesObra} meses)
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[
                      {
                        label: "Inversión en Pozo",
                        color: "#cc0000",
                        rows: [
                          ["Costo total adquisición", fmtUSD(costoTotal)],
                          ["Valor al entregar", fmtUSD(Math.round(valorAlEntregar))],
                          ["Ganancia capital", fmtUSD(Math.round(gananciaCapital))],
                          ["Rentabilidad capital", fmtPct(gananciaCapitalPct)],
                          ["TIR anual (5a)", tirAnual != null ? fmtPct(tirAnual) : "—"],
                        ],
                      },
                      {
                        label: `Renta Fija ${cfg.tasaAltAnualUSD}% USD`,
                        color: "#3b82f6",
                        rows: [
                          ["Capital invertido equiv.", fmtUSD(Math.round(inversionEquivalente))],
                          ["Valor al vencer (obra)", fmtUSD(Math.round(valorAltAlEntregar))],
                          ["Ganancia", fmtUSD(Math.round(valorAltAlEntregar - inversionEquivalente))],
                          ["Rentabilidad", fmtPct(inversionEquivalente > 0 ? ((valorAltAlEntregar - inversionEquivalente) / inversionEquivalente) * 100 : 0)],
                          ["TIR anual", fmtPct(cfg.tasaAltAnualUSD)],
                        ],
                      },
                    ].map((col) => (
                      <div key={col.label} style={{ background: "#161616", borderRadius: 10, padding: 16, border: `1px solid ${col.color}33` }}>
                        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: col.color, marginBottom: 14 }}>
                          {col.label}
                        </div>
                        {col.rows.map(([l, v]) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, borderBottom: "1px solid #222", paddingBottom: 8 }}>
                            <span style={{ fontSize: 12, color: "#888" }}>{l}</span>
                            <span style={{ fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, background: ventajaVsAlt > 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${ventajaVsAlt > 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
                      Ventaja del pozo sobre renta fija (ganancia capital)
                    </div>
                    <div style={{ fontSize: 26, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: ventajaVsAlt > 0 ? "#22c55e" : "#ef4444" }}>
                      {ventajaVsAlt >= 0 ? "+" : ""}{fmtUSD(Math.round(ventajaVsAlt))}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {ventajaVsAlt > 0
                        ? "El pozo supera a la renta fija en ganancia de capital"
                        : "La renta fija supera la ganancia de capital del pozo"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
