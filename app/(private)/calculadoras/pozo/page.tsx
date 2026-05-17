"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const fmt = (n: number, d = 0) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = (n: number) => `USD ${fmt(Math.abs(n), 0)}`;
const fmtPct = (n: number) => `${fmt(n, 2)}%`;

const MESES_NOMBRE = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface PagoRow {
  mes: number;
  label: string;
  pago: number;          // USD nominal
  pagoAjustado: number;  // USD ajustado por CAC
  acumulado: number;
  acumuladoAjustado: number;
  tipo: "anticipo" | "cuota" | "saldo";
}

export default function CalculadoraPozo() {
  const [precio, setPrecio] = useState<string>("120000");
  const [superficie, setSuperficie] = useState<string>("55");
  const [anticipo, setAnticipo] = useState<string>("30");       // %
  const [nCuotas, setNCuotas] = useState<string>("30");         // cantidad de cuotas durante obra
  const [saldoEntrega, setSaldoEntrega] = useState<string>("20"); // %
  const [cacMensual, setCacMensual] = useState<string>("3.5");   // % ajuste mensual sobre cuotas
  const [mesInicio, setMesInicio] = useState<string>("1");       // mes 1-12
  const [anoInicio, setAnoInicio] = useState<string>("2026");
  const [precioMercado, setPrecioMercado] = useState<string>("160000"); // precio esperado al terminar
  const [comisionVenta, setComisionVenta] = useState<string>("3");      // %

  const r = useMemo(() => {
    const p = parseFloat(precio) || 0;
    const sup = parseFloat(superficie) || 1;
    const pctAnticipo = (parseFloat(anticipo) || 0) / 100;
    const pctSaldo = (parseFloat(saldoEntrega) || 0) / 100;
    const pctCuotas = Math.max(0, 1 - pctAnticipo - pctSaldo);
    const n = Math.max(1, parseInt(nCuotas) || 1);
    const cac = (parseFloat(cacMensual) || 0) / 100;
    const pmercado = parseFloat(precioMercado) || 0;
    const comVenta = (parseFloat(comisionVenta) || 0) / 100;

    const montoAnticipo = p * pctAnticipo;
    const montoCuotasBase = p * pctCuotas;
    const cuotaBase = montoCuotasBase / n;
    const montoSaldo = p * pctSaldo;

    // Generar pagos
    const pagos: PagoRow[] = [];
    let acum = 0;
    let acumAdj = 0;

    // Anticipo (mes 0)
    acum += montoAnticipo;
    acumAdj += montoAnticipo;
    pagos.push({ mes: 0, label: "Anticipo", pago: montoAnticipo, pagoAjustado: montoAnticipo, acumulado: acum, acumuladoAjustado: acumAdj, tipo: "anticipo" });

    // Cuotas ajustadas por CAC
    for (let i = 1; i <= n; i++) {
      const ajuste = Math.pow(1 + cac, i - 1);
      const cuotaAdj = cuotaBase * ajuste;
      acum += cuotaBase;
      acumAdj += cuotaAdj;
      pagos.push({ mes: i, label: `Cuota ${i}/${n}`, pago: cuotaBase, pagoAjustado: cuotaAdj, acumulado: acum, acumuladoAjustado: acumAdj, tipo: "cuota" });
    }

    // Saldo a entrega
    acum += montoSaldo;
    acumAdj += montoSaldo;
    pagos.push({ mes: n + 1, label: "Saldo entrega", pago: montoSaldo, pagoAjustado: montoSaldo, acumulado: acum, acumuladoAjustado: acumAdj, tipo: "saldo" });

    const totalNominal = acum;
    const totalAjustado = acumAdj;
    const totalCuotasAjustado = totalAjustado - montoAnticipo - montoSaldo;
    const inflacionCuotas = montoCuotasBase > 0 ? ((totalCuotasAjustado - montoCuotasBase) / montoCuotasBase) * 100 : 0;
    const precioM2Pozo = totalAjustado / sup;
    const precioM2Mercado = pmercado / sup;

    // ROI si vende al terminar
    const gastosVenta = pmercado * comVenta;
    const utilidadBruta = pmercado - totalAjustado;
    const utilidadNeta = pmercado - totalAjustado - gastosVenta;
    const roiCapital = totalAjustado > 0 ? (utilidadNeta / totalAjustado) * 100 : 0;
    const mesesTotal = n + 1;
    const roiAnualizado = mesesTotal > 0 ? (Math.pow(1 + roiCapital / 100, 12 / mesesTotal) - 1) * 100 : 0;
    const apreciacion = totalAjustado > 0 ? ((pmercado - totalAjustado) / totalAjustado) * 100 : 0;

    // Fecha de entrega
    const mesI = parseInt(mesInicio) - 1;
    const anoI = parseInt(anoInicio) || 2026;
    const fechaEntrega = new Date(anoI, mesI + n + 1, 1);
    const mesEntrega = MESES_NOMBRE[fechaEntrega.getMonth()];
    const anoEntrega = fechaEntrega.getFullYear();

    // Para gráfico — mostrar hasta 36 cuotas (1 punto por cuota)
    const pagosGrafico = pagos.slice(0, Math.min(pagos.length, 38));
    const maxAcum = acumAdj;

    return {
      pagos, totalNominal, totalAjustado, totalCuotasAjustado, inflacionCuotas,
      montoAnticipo, montoCuotasBase, montoSaldo, cuotaBase,
      precioM2Pozo, precioM2Mercado,
      utilidadBruta, utilidadNeta, gastosVenta,
      roiCapital, roiAnualizado, apreciacion,
      mesesTotal, mesEntrega, anoEntrega, pagosGrafico, maxAcum, p, sup,
    };
  }, [precio, superficie, anticipo, nCuotas, saldoEntrega, cacMensual, mesInicio, anoInicio, precioMercado, comisionVenta]);

  const inputStyle: React.CSSProperties = {
    background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, padding: "7px 10px", width: "100%", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4, display: "block",
  };
  const cardStyle: React.CSSProperties = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "18px 20px",
  };

  const [verTabla, setVerTabla] = useState(false);
  const isProfit = r.utilidadNeta > 0;
  const TIPO_COLOR = { anticipo: "#cc0000", cuota: "#3b82f6", saldo: "#22c55e" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Departamento en Pozo</h1>
        <span style={{ background: "#a78bfa", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>POZO</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "310px 1fr", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        {/* Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Propiedad</div>
            {[
              { label: "Precio total (USD)", v: precio, s: setPrecio },
              { label: "Superficie (m²)", v: superficie, s: setSuperficie },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type="number" value={f.v} onChange={e => f.s(e.target.value)} />
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Estructura de pago</div>
            {[
              { label: "Anticipo (%)", v: anticipo, s: setAnticipo },
              { label: "Cuotas durante obra (cantidad)", v: nCuotas, s: setNCuotas },
              { label: "Saldo a entrega (%)", v: saldoEntrega, s: setSaldoEntrega },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type="number" value={f.v} onChange={e => f.s(e.target.value)} />
              </div>
            ))}
            <div style={{ background: "#111", borderRadius: 6, padding: "10px 12px", marginTop: 4 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Distribución</div>
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                <div style={{ flex: parseFloat(anticipo) || 0, background: "#cc0000" }} />
                <div style={{ flex: Math.max(0, 100 - (parseFloat(anticipo) || 0) - (parseFloat(saldoEntrega) || 0)), background: "#3b82f6" }} />
                <div style={{ flex: parseFloat(saldoEntrega) || 0, background: "#22c55e" }} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                <span style={{ color: "#cc0000" }}>■ Anticipo {anticipo}%</span>
                <span style={{ color: "#3b82f6" }}>■ Cuotas {Math.max(0, 100 - (parseFloat(anticipo) || 0) - (parseFloat(saldoEntrega) || 0)).toFixed(0)}%</span>
                <span style={{ color: "#22c55e" }}>■ Saldo {saldoEntrega}%</span>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Ajuste CAC</div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Ajuste mensual de cuotas (%)</label>
              <input style={inputStyle} type="number" step="0.1" value={cacMensual} onChange={e => setCacMensual(e.target.value)} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Índice CAC (Cámara Arg. Construcción). Referencia: ~3-5%/mes en 2025.</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Mes de inicio</label>
                <select style={inputStyle} value={mesInicio} onChange={e => setMesInicio(e.target.value)}>
                  {MESES_NOMBRE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Año</label>
                <input style={inputStyle} type="number" value={anoInicio} onChange={e => setAnoInicio(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Venta / Inversión</div>
            {[
              { label: "Precio de mercado al terminar (USD)", v: precioMercado, s: setPrecioMercado },
              { label: "Comisión venta (%)", v: comisionVenta, s: setComisionVenta },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type="number" value={f.v} onChange={e => f.s(e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Resultados */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {[
              { label: "Total pagado (ajustado CAC)", val: fmtUSD(r.totalAjustado), sub: `Nominal: ${fmtUSD(r.totalNominal)}`, color: "#a78bfa" },
              { label: "Precio final m²", val: `USD ${fmt(r.precioM2Pozo, 0)}/m²`, sub: `Mercado: USD ${fmt(r.precioM2Mercado, 0)}/m²`, color: "#3b82f6" },
              { label: "Utilidad si vende", val: (isProfit ? "+" : "") + fmtUSD(r.utilidadNeta), sub: `ROI ${fmtPct(r.roiCapital)}`, color: isProfit ? "#22c55e" : "#ef4444" },
              { label: "Entrega estimada", val: `${r.mesEntrega} ${r.anoEntrega}`, sub: `${r.mesesTotal} meses de obra`, color: "#f59e0b" },
            ].map((k, i) => (
              <div key={i} style={{ ...cardStyle, textAlign: "center", padding: "14px 12px" }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: k.color, lineHeight: 1.2 }}>{k.val}</div>
                <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 5 }}>{k.label}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Impacto del CAC */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Impacto del ajuste CAC sobre cuotas</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                { label: "Cuotas base (sin ajuste)", val: fmtUSD(r.montoCuotasBase), color: "#6b7280" },
                { label: "Cuotas ajustadas CAC", val: fmtUSD(r.totalCuotasAjustado), color: "#f59e0b" },
                { label: "Sobrecosto por inflación", val: `+${fmtUSD(r.totalCuotasAjustado - r.montoCuotasBase)} (+${fmtPct(r.inflacionCuotas)})`, color: "#ef4444" },
              ].map((k, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 6, padding: "12px 14px" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 700, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Montserrat,sans-serif" }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico acumulado */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
              Flujo de pagos acumulado (azul = nominal, naranja = con CAC)
            </div>
            <svg width="100%" height={130} style={{ overflow: "visible" }}>
              {r.pagosGrafico.map((row, i, arr) => {
                const total = arr.length;
                const wPct = 100 / total;
                const x = `${i * wPct}%`;
                const hNom = (row.acumulado / r.maxAcum) * 110;
                const hAdj = (row.acumuladoAjustado / r.maxAcum) * 110;
                const color = TIPO_COLOR[row.tipo];
                return (
                  <g key={i}>
                    <rect x={x} y={130 - hNom} width={`${wPct * 0.45}%`} height={hNom} rx={1} fill="#3b82f6" opacity={0.6} />
                    <rect x={`${i * wPct + wPct * 0.5}%`} y={130 - hAdj} width={`${wPct * 0.45}%`} height={hAdj} rx={1} fill={color} opacity={0.85} />
                    {i % Math.max(1, Math.floor(total / 8)) === 0 && (
                      <text x={`${i * wPct + wPct * 0.45}%`} y={128} fontSize={7} fill="rgba(255,255,255,0.25)" textAnchor="middle">{row.mes === 0 ? "Ini" : `${row.mes}m`}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* ROI vs mercado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Comparativa precio</div>
              {[
                { label: "Precio de pozo (total pagado)", val: fmtUSD(r.totalAjustado), pct: 100, color: "#a78bfa" },
                { label: "Precio mercado estimado", val: fmtUSD(parseFloat(precioMercado) || 0), pct: r.totalAjustado > 0 ? ((parseFloat(precioMercado) || 0) / r.totalAjustado) * 100 : 0, color: "#22c55e" },
              ].map(b => (
                <div key={b.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{b.label}</span>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: b.color }}>{b.val}</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(b.pct, 150)}%`, background: b.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#111", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Apreciación esperada</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: r.apreciacion >= 0 ? "#22c55e" : "#ef4444", marginTop: 2 }}>
                  {r.apreciacion >= 0 ? "+" : ""}{fmtPct(r.apreciacion)}
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>ROI si vende al terminar</div>
              {[
                { label: "Total invertido (con CAC)", val: fmtUSD(r.totalAjustado), color: "#a78bfa" },
                { label: "Precio venta mercado", val: fmtUSD(parseFloat(precioMercado) || 0), color: "#22c55e" },
                { label: "Comisión venta", val: `-${fmtUSD(r.gastosVenta)}`, color: "#cc0000" },
                { label: "Utilidad neta", val: (isProfit ? "+" : "") + fmtUSD(r.utilidadNeta), color: isProfit ? "#22c55e" : "#ef4444" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{l.label}</span>
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: l.color }}>{l.val}</span>
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                {[
                  { label: "ROI total", val: fmtPct(r.roiCapital) },
                  { label: "ROI anualizado", val: fmtPct(r.roiAnualizado) },
                ].map((k, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: isProfit ? "#22c55e" : "#ef4444" }}>{k.val}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Montserrat,sans-serif" }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Cronograma de pagos</span>
              <button onClick={() => setVerTabla(v => !v)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "rgba(255,255,255,0.5)", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
                {verTabla ? "Ocultar" : "Ver tabla"}
              </button>
            </div>
            {verTabla && (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead style={{ position: "sticky", top: 0, background: "#0d0d0d" }}>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      {["Período","Concepto","Base USD","Ajustado USD","Acumulado"].map(h => (
                        <th key={h} style={{ textAlign: "right", padding: "6px 8px", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.pagos.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.35)", textAlign: "right" }}>{row.mes === 0 ? "0" : row.mes}</td>
                        <td style={{ padding: "5px 8px", color: TIPO_COLOR[row.tipo], textAlign: "right" }}>{row.label}</td>
                        <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.5)", textAlign: "right" }}>{fmtUSD(row.pago)}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: TIPO_COLOR[row.tipo], textAlign: "right" }}>{fmtUSD(row.pagoAjustado)}</td>
                        <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.6)", textAlign: "right" }}>{fmtUSD(row.acumuladoAjustado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!verTabla && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Anticipo", val: fmtUSD(r.montoAnticipo), color: "#cc0000" },
                  { label: `${nCuotas} cuotas (total ajustado)`, val: fmtUSD(r.totalCuotasAjustado), color: "#3b82f6" },
                  { label: "Saldo entrega", val: fmtUSD(r.montoSaldo), color: "#22c55e" },
                ].map((k, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 700, color: k.color }}>{k.val}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Montserrat,sans-serif" }}>{k.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
