"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcularIRR(flujos: number[], maxIter = 1000, tol = 1e-6): number | null {
  // Newton-Raphson para encontrar la tasa donde VAN=0
  let r = 0.1;
  for (let i = 0; i < maxIter; i++) {
    let van = 0, dvan = 0;
    flujos.forEach((f, t) => {
      van += f / Math.pow(1 + r, t);
      dvan -= t * f / Math.pow(1 + r, t + 1);
    });
    if (Math.abs(dvan) < 1e-12) return null;
    const rNuevo = r - van / dvan;
    if (Math.abs(rNuevo - r) < tol) return rNuevo;
    r = rNuevo;
  }
  return null;
}

function calcularVAN(flujos: number[], tasa: number): number {
  return flujos.reduce((s, f, t) => s + f / Math.pow(1 + tasa, t), 0);
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function CalculadoraVANIRR() {
  const [precioCompra, setPrecioCompra] = useState(120000);
  const [gastosCompra, setGastosCompra] = useState(6000); // escritura + comisión
  const [rentaMensual, setRentaMensual] = useState(650);
  const [vacancia, setVacancia] = useState(5);
  const [gastosMensuales, setGastosMensuales] = useState(120); // expensas + mantenimiento
  const [incrementoRentaAnual, setIncrementoRentaAnual] = useState(8); // % anual USD
  const [horizonte, setHorizonte] = useState(10);
  const [apreciaAnual, setApreciaAnual] = useState(3); // % apreciación anual del inmueble
  const [tasaDescuento, setTasaDescuento] = useState(8); // % costo oportunidad
  const [impuestoAnual, setImpuestoAnual] = useState(500); // ABL + rentas anuales
  const [remodelacion, setRemodelacion] = useState(0);

  const resultado = useMemo(() => {
    const inversionInicial = precioCompra + gastosCompra + remodelacion;

    // Flujo de caja por año
    const flujos: number[] = [-inversionInicial];
    const tablaCFAnual: { anio: number; renta: number; gastos: number; flujoNeto: number; flujoAcum: number }[] = [];
    let flujoAcum = -inversionInicial;

    for (let anio = 1; anio <= horizonte; anio++) {
      const rentaAnualBruta = rentaMensual * 12 * Math.pow(1 + incrementoRentaAnual / 100, anio - 1);
      const rentaEfectiva = rentaAnualBruta * (1 - vacancia / 100);
      const gastosAnuales = gastosMensuales * 12 + impuestoAnual;
      const flujoNeto = rentaEfectiva - gastosAnuales;

      if (anio === horizonte) {
        // En el último año: flujo operativo + valor de venta del inmueble
        const valorVenta = precioCompra * Math.pow(1 + apreciaAnual / 100, horizonte);
        const gastosVenta = valorVenta * 0.03; // 3% comisión + gastos
        flujos.push(flujoNeto + valorVenta - gastosVenta);
        flujoAcum += flujoNeto + valorVenta - gastosVenta;
        tablaCFAnual.push({ anio, renta: rentaEfectiva, gastos: gastosAnuales, flujoNeto: flujoNeto + valorVenta - gastosVenta, flujoAcum });
      } else {
        flujos.push(flujoNeto);
        flujoAcum += flujoNeto;
        tablaCFAnual.push({ anio, renta: rentaEfectiva, gastos: gastosAnuales, flujoNeto, flujoAcum });
      }
    }

    const tasa = tasaDescuento / 100;
    const van = calcularVAN(flujos, tasa);
    const irrRaw = calcularIRR(flujos);
    const irr = irrRaw !== null ? irrRaw * 100 : null;

    // Payback
    let payback: number | null = null;
    let acum = -inversionInicial;
    for (let i = 0; i < tablaCFAnual.length; i++) {
      acum += tablaCFAnual[i].flujoNeto;
      if (acum >= 0 && payback === null) {
        payback = i + 1;
      }
    }

    // Yields
    const rentaAnio1 = rentaMensual * 12 * (1 - vacancia / 100);
    const gastosAnio1 = gastosMensuales * 12 + impuestoAnual;
    const grossYield = (rentaMensual * 12 / precioCompra) * 100;
    const netYield = ((rentaAnio1 - gastosAnio1) / precioCompra) * 100;

    const valorVentaFinal = precioCompra * Math.pow(1 + apreciaAnual / 100, horizonte);
    const gananciaCapital = valorVentaFinal - precioCompra;
    const rentaAcumuladaNeta = tablaCFAnual.slice(0, -1).reduce((s, f) => s + f.flujoNeto, 0);

    return {
      inversionInicial, van, irr, payback, grossYield, netYield,
      valorVentaFinal, gananciaCapital, rentaAcumuladaNeta,
      tablaCFAnual, flujos,
    };
  }, [precioCompra, gastosCompra, rentaMensual, vacancia, gastosMensuales, incrementoRentaAnual, horizonte, apreciaAnual, tasaDescuento, impuestoAnual, remodelacion]);

  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const fmtUSD = (n: number) => `USD ${fmt(n)}`;
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 13, width: "100%",
    fontFamily: "Inter, sans-serif", boxSizing: "border-box" as const,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4, display: "block",
  };
  const sectionStyle: React.CSSProperties = { background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" };

  // SVG de flujos acumulados
  const maxAcum = Math.max(...resultado.tablaCFAnual.map(r => Math.abs(r.flujoAcum)), resultado.inversionInicial, 1);
  const svgW = 500, svgH = 120;

  function flujoPath(): string {
    const puntos = [{ x: 0, y: -resultado.inversionInicial }]
      .concat(resultado.tablaCFAnual.map((r, i) => ({ x: i + 1, y: r.flujoAcum })));
    return puntos.map((p, i) => {
      const x = (p.x / horizonte) * svgW;
      const y = svgH / 2 - (p.y / maxAcum) * (svgH / 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  const [mostrarTabla, setMostrarTabla] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>📐 VAN / IRR — Inversión Inmobiliaria</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Valor Actual Neto, Tasa Interna de Retorno y flujo de caja proyectado</p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Inputs en dos columnas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000", textTransform: "uppercase" }}>Inversión</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><label style={labelStyle}>Precio de compra (USD)</label><input type="number" value={precioCompra} onChange={e => setPrecioCompra(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Gastos de compra (USD)</label><input type="number" value={gastosCompra} onChange={e => setGastosCompra(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Remodelación / mejoras (USD)</label><input type="number" value={remodelacion} onChange={e => setRemodelacion(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Horizonte de inversión (años)</label><input type="number" min={1} max={30} value={horizonte} onChange={e => setHorizonte(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Apreciación anual estimada (%)</label><input type="number" step={0.1} value={apreciaAnual} onChange={e => setApreciaAnual(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Tasa de descuento / costo oportunidad (%)</label><input type="number" step={0.1} value={tasaDescuento} onChange={e => setTasaDescuento(+e.target.value)} style={inputStyle} /></div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#3b82f6", textTransform: "uppercase" }}>Operación</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><label style={labelStyle}>Renta mensual (USD)</label><input type="number" value={rentaMensual} onChange={e => setRentaMensual(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Vacancia / días sin alquilar (%)</label><input type="number" step={0.5} value={vacancia} onChange={e => setVacancia(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Incremento anual de renta (%)</label><input type="number" step={0.5} value={incrementoRentaAnual} onChange={e => setIncrementoRentaAnual(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Gastos mensuales (expensas, mant.) USD</label><input type="number" value={gastosMensuales} onChange={e => setGastosMensuales(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Impuestos anuales (ABL, rentas) USD</label><input type="number" value={impuestoAnual} onChange={e => setImpuestoAnual(+e.target.value)} style={inputStyle} /></div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {[
            { label: "VAN", val: fmtUSD(resultado.van), sub: resultado.van >= 0 ? "✓ Conveniente" : "✗ Por debajo costo oportunidad", color: resultado.van >= 0 ? "#22c55e" : "#ef4444" },
            { label: "IRR anual", val: resultado.irr !== null ? fmtPct(resultado.irr) : "N/D", sub: resultado.irr !== null && resultado.irr > tasaDescuento ? `Supera tasa desc. ${tasaDescuento}%` : "Inferior al costo oportunidad", color: resultado.irr !== null && resultado.irr > tasaDescuento ? "#22c55e" : "#ef4444" },
            { label: "Yield bruto", val: fmtPct(resultado.grossYield), sub: "Renta / Precio compra", color: "#3b82f6" },
            { label: "Yield neto", val: fmtPct(resultado.netYield), sub: "Renta neta / Precio compra", color: "#a78bfa" },
            { label: "Payback", val: resultado.payback !== null ? `${resultado.payback} años` : "+${horizonte}a", sub: "Recupero de inversión", color: "#f59e0b" },
            { label: "Valor venta est.", val: fmtUSD(resultado.valorVentaFinal), sub: `+${fmtPct(apreciaAnual)}/año × ${horizonte}a`, color: "#22c55e" },
            { label: "Ganancia capital", val: fmtUSD(resultado.gananciaCapital), sub: "Apreciación del inmueble", color: "#22c55e" },
            { label: "Renta acumulada", val: fmtUSD(resultado.rentaAcumuladaNeta), sub: `${horizonte - 1} años neta`, color: "#f59e0b" },
          ].map((kpi, i) => (
            <div key={i} style={{ background: "#111", border: `1px solid ${kpi.color}33`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 10, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Gráfico flujo acumulado */}
        <div style={sectionStyle}>
          <h2 style={{ margin: "0 0 12px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
            Flujo de caja acumulado
          </h2>
          <svg width="100%" viewBox={`0 0 ${svgW} ${svgH + 24}`} style={{ overflow: "visible" }}>
            <line x1="0" y1={svgH / 2} x2={svgW} y2={svgH / 2} stroke="#333" strokeWidth={1} strokeDasharray="4" />
            <line x1="0" y1="0" x2="0" y2={svgH} stroke="#222" strokeWidth={1} />
            <path d={flujoPath()} fill="none" stroke={resultado.van >= 0 ? "#22c55e" : "#ef4444"} strokeWidth={2.5} />
            {resultado.tablaCFAnual.map((r, i) => {
              const x = ((i + 1) / horizonte) * svgW;
              const y = svgH / 2 - (r.flujoAcum / maxAcum) * (svgH / 2);
              return (
                <circle key={i} cx={x} cy={y} r={3} fill={r.flujoAcum >= 0 ? "#22c55e" : "#ef4444"} />
              );
            })}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => (
              <text key={pct} x={pct * svgW} y={svgH + 16} fill="#555" fontSize={10} textAnchor="middle">{`Año ${Math.round(pct * horizonte)}`}</text>
            ))}
            <text x={4} y={12} fill="#888" fontSize={10}>{fmtUSD(maxAcum)}</text>
            <text x={4} y={svgH - 2} fill="#888" fontSize={10}>-{fmtUSD(maxAcum)}</text>
          </svg>
          <div style={{ marginTop: 4, fontSize: 12, color: "#666", textAlign: "center" }}>
            La línea cruza cero en el año de recupero (payback = {resultado.payback !== null ? `año ${resultado.payback}` : `no alcanzado en ${horizonte} años`})
          </div>
        </div>

        {/* Tabla de flujos */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
          <div onClick={() => setMostrarTabla(!mostrarTabla)} style={{ padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
              Flujo de caja anual detallado
            </h2>
            <span style={{ color: "#666" }}>{mostrarTabla ? "▲ Ocultar" : "▼ Ver tabla"}</span>
          </div>
          {mostrarTabla && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  {["Año","Renta efectiva","Gastos","Flujo neto","Flujo acumulado"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #111", background: "#cc000010" }}>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#888" }}>0 (inversión)</td>
                  <td colSpan={2} style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#888" }}>—</td>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#ef4444", fontWeight: 700 }}>-{fmtUSD(resultado.inversionInicial)}</td>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#ef4444" }}>-{fmtUSD(resultado.inversionInicial)}</td>
                </tr>
                {resultado.tablaCFAnual.map((r, i) => (
                  <tr key={r.anio} style={{ borderBottom: "1px solid #111", background: i % 2 === 0 ? "#0d0d0d" : "transparent" }}>
                    <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#888" }}>{r.anio}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#22c55e" }}>{fmtUSD(r.renta)}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#ef4444" }}>-{fmtUSD(r.gastos)}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: r.flujoNeto >= 0 ? "#22c55e" : "#ef4444" }}>{r.flujoNeto >= 0 ? "" : "-"}{fmtUSD(Math.abs(r.flujoNeto))}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: r.flujoAcum >= 0 ? "#22c55e" : "#ef4444" }}>{r.flujoAcum >= 0 ? "" : "-"}{fmtUSD(Math.abs(r.flujoAcum))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Nota metodológica */}
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#666" }}>
          <strong style={{ color: "#888" }}>Metodología:</strong> El VAN descuenta todos los flujos futuros (rentas netas + valor de venta − gastos) a la tasa de costo de oportunidad indicada.
          La IRR es la tasa que hace VAN=0 (calculada por Newton-Raphson).
          El año final incluye el valor de venta estimado con apreciación compuesta y gastos de venta estimados en 3%.
        </div>

      </div>
    </div>
  );
}
