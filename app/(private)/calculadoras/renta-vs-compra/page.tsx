"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Componente ───────────────────────────────────────────────────────────────

export default function RentaVsCompra() {
  // Compra
  const [precioCompra, setPrecioCompra] = useState(120000);
  const [enganche, setEnganche] = useState(20);
  const [tnaHipoteca, setTnaHipoteca] = useState(8.5);
  const [plazoAnios, setPlazoAnios] = useState(20);
  const [gastosCompraUSD, setGastosCompraUSD] = useState(6000);
  const [expensasMensual, setExpensasMensual] = useState(80);
  const [mantenimientoAnual, setMantenimientoAnual] = useState(0.5); // % del valor
  const [impuestosAnuales, setImpuestosAnuales] = useState(500);
  const [apreciaAnual, setApreciaAnual] = useState(3);

  // Alquiler
  const [alquilerMensual, setAlquilerMensual] = useState(600);
  const [incrementoAlquilerAnual, setIncrementoAlquilerAnual] = useState(10);
  const [depositoMeses, setDepositoMeses] = useState(1);

  // General
  const [horizonte, setHorizonte] = useState(10);
  const [tasaInversion, setTasaInversion] = useState(6); // retorno de la inversión alternativa
  const [tcDolar, setTcDolar] = useState(1200);

  const resultado = useMemo(() => {
    const meses = horizonte * 12;
    const capitalPropio = precioCompra * enganche / 100 + gastosCompraUSD;
    const prestamo = precioCompra * (1 - enganche / 100);
    const tnaMensual = tnaHipoteca / 12 / 100;

    // Cuota hipotecaria mensual (sistema francés)
    const cuotaHipoteca = tnaMensual === 0
      ? prestamo / (plazoAnios * 12)
      : prestamo * tnaMensual * Math.pow(1 + tnaMensual, plazoAnios * 12) / (Math.pow(1 + tnaMensual, plazoAnios * 12) - 1);

    const cuotaEfectiva = Math.min(meses, plazoAnios * 12) === meses ? cuotaHipoteca : 0; // si horizonte < plazo sigue pagando

    // ESCENARIO COMPRA — costos acumulados por año
    const costosTotalesCompra: number[] = [];
    let costoAcumCompra = capitalPropio; // inversión inicial

    for (let anio = 1; anio <= horizonte; anio++) {
      const hipotecaAnual = meses >= anio * 12
        ? cuotaHipoteca * 12
        : cuotaHipoteca * Math.max(0, plazoAnios * 12 - (anio - 1) * 12);
      const mantAnual = (precioCompra * Math.pow(1 + apreciaAnual / 100, anio)) * mantenimientoAnual / 100;
      const costoAnual = hipotecaAnual + expensasMensual * 12 + impuestosAnuales + mantAnual;
      costoAcumCompra += costoAnual;
      costosTotalesCompra.push(costoAcumCompra);
    }

    // Valor de la propiedad al final
    const valorFinal = precioCompra * Math.pow(1 + apreciaAnual / 100, horizonte);
    const gastoVenta = valorFinal * 0.04;
    const patrimonioNetoCompra = valorFinal - gastoVenta - costosTotalesCompra[horizonte - 1];

    // ESCENARIO ALQUILER — costos + inversión alternativa del capital propio
    const costosTotalesAlquiler: number[] = [];
    let costoAcumAlquiler = 0;
    let capitalInvertido = capitalPropio; // se invierte el capital que habrías puesto de enganche
    const tasaMensual = tasaInversion / 12 / 100;

    for (let anio = 1; anio <= horizonte; anio++) {
      const alquileresTanio = alquilerMensual * Math.pow(1 + incrementoAlquilerAnual / 100, anio - 1) * 12;
      costoAcumAlquiler += alquileresTanio;
      costosTotalesAlquiler.push(costoAcumAlquiler + alquilerMensual * depositoMeses); // depósito es recuperable
    }

    // Capital propio invertido a tasa alternativa
    const patrimonioInversionAlternativa = capitalPropio * Math.pow(1 + tasaInversion / 100, horizonte);

    // Diferencia: cuánto gana el comprador vs el inquilino
    const ventajaComprador = valorFinal - gastoVenta - patrimonioInversionAlternativa;

    // Punto de quiebre: ¿cuándo conviene comprar?
    let anioBreakeven: number | null = null;
    for (let a = 1; a <= horizonte; a++) {
      const valorPropAnio = precioCompra * Math.pow(1 + apreciaAnual / 100, a);
      const capitalInvAnio = capitalPropio * Math.pow(1 + tasaInversion / 100, a);
      const alqAcum = Array.from({ length: a }, (_, i) => alquilerMensual * Math.pow(1 + incrementoAlquilerAnual / 100, i) * 12).reduce((s, v) => s + v, 0);
      const costoCompraAnio = costosTotalesCompra[a - 1] ?? 0;

      // Patrimonio neto comprador = valorProp - costoAcum + saldo deuda recuperado
      const patrimonioCompra = valorPropAnio - costoCompraAnio + capitalPropio;
      // Patrimonio inquilino = capitalInvertido - alqAcum
      const patrimonioInq = capitalInvAnio - alqAcum;

      if (patrimonioCompra > patrimonioInq && anioBreakeven === null) {
        anioBreakeven = a;
      }
    }

    return {
      capitalPropio,
      prestamo,
      cuotaHipoteca,
      costosTotalesCompra,
      costosTotalesAlquiler,
      valorFinal,
      patrimonioNetoCompra,
      patrimonioInversionAlternativa,
      ventajaComprador,
      anioBreakeven,
    };
  }, [precioCompra, enganche, tnaHipoteca, plazoAnios, gastosCompraUSD, expensasMensual, mantenimientoAnual, impuestosAnuales, apreciaAnual, alquilerMensual, incrementoAlquilerAnual, depositoMeses, horizonte, tasaInversion, tcDolar]);

  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const fmtUSD = (n: number) => `USD ${fmt(n)}`;

  const convieneCOmprar = resultado.ventajaComprador > 0;
  const ratioCuotaAlquiler = alquilerMensual > 0 ? resultado.cuotaHipoteca / alquilerMensual : 0;

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

  // Gráfico SVG costos acumulados
  const maxCosto = Math.max(
    ...resultado.costosTotalesCompra,
    ...resultado.costosTotalesAlquiler,
    1,
  );
  const svgW = 500, svgH = 120;

  function makePath(datos: number[], color: string): string {
    return datos.map((v, i) => {
      const x = ((i + 1) / horizonte) * svgW;
      const y = svgH - (v / maxCosto) * svgH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>🏠 Renta vs Compra</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Comparación financiera a {horizonte} años: ¿conviene más alquilar o comprar?</p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Veredicto */}
        <div style={{
          background: convieneCOmprar ? "#22c55e10" : "#3b82f610",
          border: `2px solid ${convieneCOmprar ? "#22c55e" : "#3b82f6"}`,
          borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16,
        }}>
          <span style={{ fontSize: 40 }}>{convieneCOmprar ? "🏠" : "🔑"}</span>
          <div>
            <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: convieneCOmprar ? "#22c55e" : "#3b82f6" }}>
              {convieneCOmprar ? "En este escenario conviene COMPRAR" : "En este escenario conviene ALQUILAR"}
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
              {convieneCOmprar
                ? `La compra genera un patrimonio neto superior de ${fmtUSD(Math.abs(resultado.ventajaComprador))} respecto a invertir el capital`
                : `Alquilar e invertir el capital genera ${fmtUSD(Math.abs(resultado.ventajaComprador))} más de patrimonio en ${horizonte} años`
              }
              {resultado.anioBreakeven !== null && resultado.anioBreakeven <= horizonte && ` · Break-even en año ${resultado.anioBreakeven}`}
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 14px", fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000", textTransform: "uppercase" }}>Compra</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><label style={labelStyle}>Precio propiedad (USD)</label><input type="number" value={precioCompra} onChange={e => setPrecioCompra(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Enganche (%)</label><input type="number" step={1} value={enganche} onChange={e => setEnganche(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>TNA hipoteca (%)</label><input type="number" step={0.1} value={tnaHipoteca} onChange={e => setTnaHipoteca(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Plazo hipoteca (años)</label><input type="number" min={5} max={30} value={plazoAnios} onChange={e => setPlazoAnios(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Gastos compra (USD)</label><input type="number" value={gastosCompraUSD} onChange={e => setGastosCompraUSD(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Expensas/mes (USD)</label><input type="number" value={expensasMensual} onChange={e => setExpensasMensual(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Mantenimiento anual (% del valor)</label><input type="number" step={0.1} value={mantenimientoAnual} onChange={e => setMantenimientoAnual(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Impuestos anuales (USD)</label><input type="number" value={impuestosAnuales} onChange={e => setImpuestosAnuales(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Apreciación anual (%)</label><input type="number" step={0.1} value={apreciaAnual} onChange={e => setApreciaAnual(+e.target.value)} style={inputStyle} /></div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 14px", fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#3b82f6", textTransform: "uppercase" }}>Alquiler</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><label style={labelStyle}>Alquiler mensual (USD)</label><input type="number" value={alquilerMensual} onChange={e => setAlquilerMensual(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Incremento anual (%)</label><input type="number" step={0.5} value={incrementoAlquilerAnual} onChange={e => setIncrementoAlquilerAnual(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Depósito (meses)</label><input type="number" min={0} max={6} value={depositoMeses} onChange={e => setDepositoMeses(+e.target.value)} style={inputStyle} /></div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 14px", fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#a78bfa", textTransform: "uppercase" }}>Horizonte</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><label style={labelStyle}>Años de comparación</label><input type="number" min={1} max={30} value={horizonte} onChange={e => setHorizonte(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Retorno inversión alternativa (%/año)</label><input type="number" step={0.5} value={tasaInversion} onChange={e => setTasaInversion(+e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>TC (ARS/USD)</label><input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} style={inputStyle} /></div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {[
            { label: "Capital propio inicial", val: fmtUSD(resultado.capitalPropio), sub: `${enganche}% enganche + gastos`, color: "#cc0000" },
            { label: "Cuota hipotecaria", val: `${fmtUSD(resultado.cuotaHipoteca)}/mes`, sub: `${ratioCuotaAlquiler.toFixed(1)}× el alquiler`, color: "#f59e0b" },
            { label: "Valor prop. año " + horizonte, val: fmtUSD(resultado.valorFinal), sub: `+${apreciaAnual}%/año`, color: "#22c55e" },
            { label: "Patrimonio si compra", val: fmtUSD(resultado.patrimonioNetoCompra), sub: "Valor venta − costos acum.", color: "#22c55e" },
            { label: "Patrimonio si alquila", val: fmtUSD(resultado.patrimonioInversionAlternativa), sub: `Capital + ${tasaInversion}%/año`, color: "#3b82f6" },
            { label: "Ventaja", val: fmtUSD(Math.abs(resultado.ventajaComprador)), sub: convieneCOmprar ? "Favor de comprar" : "Favor de alquilar", color: convieneCOmprar ? "#22c55e" : "#3b82f6" },
            { label: "Break-even", val: resultado.anioBreakeven !== null ? `Año ${resultado.anioBreakeven}` : `+${horizonte} años`, sub: "¿Cuándo conviene comprar?", color: "#a78bfa" },
          ].map((kpi, i) => (
            <div key={i} style={{ background: "#111", border: `1px solid ${kpi.color}33`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 10, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Gráfico costos acumulados */}
        <div style={sectionStyle}>
          <h2 style={{ margin: "0 0 12px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
            Costo acumulado a {horizonte} años
          </h2>
          <svg width="100%" viewBox={`0 0 ${svgW} ${svgH + 24}`} style={{ overflow: "visible" }}>
            <line x1="0" y1={svgH} x2={svgW} y2={svgH} stroke="#222" strokeWidth={1} />
            <path d={makePath(resultado.costosTotalesCompra, "#cc0000")} fill="none" stroke="#cc0000" strokeWidth={2.5} />
            <path d={makePath(resultado.costosTotalesAlquiler, "#3b82f6")} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
            {[0.25, 0.5, 0.75, 1].map(pct => (
              <text key={pct} x={pct * svgW} y={svgH + 16} fill="#555" fontSize={10} textAnchor="middle">{`Año ${Math.round(pct * horizonte)}`}</text>
            ))}
          </svg>
          <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
            {[{ color: "#cc0000", label: "Costos de comprar (hipoteca + gastos)" }, { color: "#3b82f6", label: "Costos de alquilar" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#888" }}>
                <div style={{ width: 20, height: 3, background: l.color, borderRadius: 2 }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        {/* Supuestos clave */}
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#666" }}>
          <strong style={{ color: "#888" }}>Supuestos:</strong> La comparación asume que en el escenario alquiler, el capital propio ({fmtUSD(resultado.capitalPropio)}) se invierte al {tasaInversion}% anual en USD.
          La apreciación de la propiedad es del {apreciaAnual}% anual en USD. Los gastos de venta son del 4% del valor final.
          El análisis no considera el impacto fiscal de ningún escenario.
        </div>

      </div>
    </div>
  );
}
