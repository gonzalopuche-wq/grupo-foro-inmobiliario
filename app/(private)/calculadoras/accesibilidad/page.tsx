"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const BANCOS = [
  { nombre: "Banco Nación",   tna: 8.5,  plazo: 360, ltv: 75, enganche: 25, requisito: "Relación cuota/ingreso ≤ 25%" },
  { nombre: "Banco Ciudad",   tna: 9.0,  plazo: 300, ltv: 70, enganche: 30, requisito: "Antigüedad laboral ≥ 1 año" },
  { nombre: "Banco Provincia",tna: 9.5,  plazo: 360, ltv: 80, enganche: 20, requisito: "Ingresos demostrables" },
  { nombre: "Santander",      tna: 10.0, plazo: 240, ltv: 70, enganche: 30, requisito: "Cuota ≤ 30% ingreso" },
  { nombre: "Galicia",        tna: 9.8,  plazo: 300, ltv: 75, enganche: 25, requisito: "Sin veraz negativo" },
  { nombre: "BBVA",           tna: 10.5, plazo: 240, ltv: 70, enganche: 30, requisito: "Cuota ≤ 30% ingreso" },
  { nombre: "HSBC",           tna: 10.2, plazo: 240, ltv: 65, enganche: 35, requisito: "Ingresos ≥ 3× cuota" },
  { nombre: "Hipotecario",    tna: 8.0,  plazo: 360, ltv: 80, enganche: 20, requisito: "Primera vivienda" },
];

export default function AccesibilidadPage() {
  const [precioUSD, setPrecioUSD] = useState(100000);
  const [tc, setTc] = useState(1300);
  const [ingresoMensual, setIngresoMensual] = useState(1200000);
  const [ahorroActual, setAhorroActual] = useState(10000000);
  const [ahorroPct, setAhorroPct] = useState(15); // % del ingreso que ahorra
  const [incrementoIngreso, setIncrementoIngreso] = useState(60); // %/año
  const [aprecProp, setAprecProp] = useState(10); // % apreciación inmueble por año

  const precioARS = precioUSD * tc;

  const analisisBancos = useMemo(() => BANCOS.map(b => {
    const tem = b.tna / 100 / 12;
    const capital = precioARS * b.ltv / 100;
    const cuota = tem > 0
      ? capital * tem * Math.pow(1 + tem, b.plazo) / (Math.pow(1 + tem, b.plazo) - 1)
      : capital / b.plazo;
    const totalPagado = cuota * b.plazo;
    const totalInteres = totalPagado - capital;
    const cfi = totalInteres / capital * 100;
    const enganicheARS = precioARS * b.enganche / 100;
    const ratioIngreso = ingresoMensual > 0 ? (cuota / ingresoMensual) * 100 : 0;
    const ingresoNecesario = cuota / 0.3; // cuota ≤ 30% ingreso
    const califica = ingresoMensual >= ingresoNecesario && ahorroActual >= enganicheARS;
    // Cuántos meses para juntar el enganche (si no lo tiene)
    const ahorroMensual = ingresoMensual * ahorroPct / 100;
    const faltante = Math.max(0, enganicheARS - ahorroActual);
    const mesesParaEnganche = ahorroMensual > 0 && faltante > 0 ? Math.ceil(faltante / ahorroMensual) : 0;
    return { ...b, tem, capital, cuota, totalPagado, totalInteres, cfi, enganicheARS, ratioIngreso, ingresoNecesario, califica, mesesParaEnganche };
  }), [precioARS, ingresoMensual, ahorroActual, ahorroPct]);

  const mejorCuota = useMemo(() => analisisBancos.reduce((a, b) => a.cuota < b.cuota ? a : b), [analisisBancos]);
  const mejorPlazo = useMemo(() => analisisBancos.reduce((a, b) => a.plazo > b.plazo ? a : b), [analisisBancos]);
  const bancosCalifican = useMemo(() => analisisBancos.filter(b => b.califica), [analisisBancos]);

  // Índice de accesibilidad: precio / ingreso anual (años de salario para comprar)
  const añosSalario = ingresoMensual > 0 ? precioARS / (ingresoMensual * 12) : 0;

  // Cuánto tiempo para juntar enganche promedio
  const enganichePromedio = precioARS * 0.25;
  const faltantePromedio = Math.max(0, enganichePromedio - ahorroActual);
  const ahorroMensual = ingresoMensual * ahorroPct / 100;
  const mesesParaEnganchePromedio = ahorroMensual > 0 && faltantePromedio > 0 ? faltantePromedio / ahorroMensual : 0;

  // Proyección: precio en el futuro vs ahorro acumulado
  const proyeccion = useMemo(() => {
    const años = 10;
    const filas = [];
    let ahorro = ahorroActual;
    let ingreso = ingresoMensual;
    let precio = precioARS;
    for (let a = 1; a <= años; a++) {
      ingreso *= (1 + incrementoIngreso / 100);
      ahorro += ingreso * ahorroPct / 100 * 12;
      precio *= (1 + aprecProp / 100);
      const enganche25 = precio * 0.25;
      filas.push({ año: a, ingreso, ahorro, precio, enganche25, alcanza: ahorro >= enganche25 });
    }
    return filas;
  }, [ahorroActual, ingresoMensual, precioARS, ahorroPct, incrementoIngreso, aprecProp]);

  const primerAñoAlcanza = proyeccion.find(f => f.alcanza);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              🏦 Accesibilidad + Comparador Bancos
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
              ¿Podés comprar? ¿Cuánto te falta? Comparativa de condiciones hipotecarias
            </p>
          </div>
          <Link href="/calculadoras" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        {/* Inputs */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            {[
              { label: "Precio propiedad (USD)", val: precioUSD, set: setPrecioUSD },
              { label: "TC USD/ARS", val: tc, set: setTc },
              { label: "Ingreso mensual (ARS)", val: ingresoMensual, set: setIngresoMensual },
              { label: "Ahorro actual (ARS)", val: ahorroActual, set: setAhorroActual },
              { label: "Ahorro mensual (%)", val: ahorroPct, set: setAhorroPct, step: 1 },
              { label: "Incremento ingreso (%/año)", val: incrementoIngreso, set: setIncrementoIngreso, step: 5 },
              { label: "Apreciación propiedad (%/año)", val: aprecProp, set: setAprecProp, step: 1 },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type="number" value={f.val} step={f.step ?? 1}
                  onChange={e => f.set(parseFloat(e.target.value) || 0)}
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13, width: "100%", boxSizing: "border-box" as const }} />
              </div>
            ))}
          </div>
        </div>

        {/* Diagnóstico rápido */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Precio en ARS", val: `$ ${fmt(precioARS)}`, color: "#3b82f6" },
            { label: "Años de salario", val: `${añosSalario.toFixed(1)} años`, color: añosSalario > 10 ? "#cc0000" : añosSalario > 6 ? "#f97316" : "#22c55e" },
            { label: "Bancos que calificás", val: `${bancosCalifican.length}/${BANCOS.length}`, color: bancosCalifican.length > 0 ? "#22c55e" : "#cc0000" },
            { label: "Mejor cuota/mes", val: `$ ${fmt(mejorCuota.cuota)}`, color: "#a855f7" },
            { label: "Ahorro mensual", val: `$ ${fmt(ahorroMensual)}`, color: "#22c55e" },
            { label: primerAñoAlcanza ? `Enganche en año ${primerAñoAlcanza.año}` : "No alcanza en 10a", val: primerAñoAlcanza ? "✅ Proyectado" : "❌ Revisar ahorro", color: primerAñoAlcanza ? "#22c55e" : "#cc0000" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: `1px solid ${k.color}33`, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Alerta estado */}
        {bancosCalifican.length === 0 ? (
          <div style={{ background: "#7f1d1d22", border: "1px solid #cc000044", borderRadius: 10, padding: "14px 18px", marginBottom: 24 }}>
            <div style={{ fontWeight: 700, color: "#cc0000", marginBottom: 4 }}>❌ No calificás para ningún banco con los datos actuales</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              Ingreso necesario mínimo: <strong>$ {fmt(analisisBancos.reduce((min, b) => Math.min(min, b.ingresoNecesario), Infinity))}</strong> ·
              Tu ingreso actual: <strong>$ {fmt(ingresoMensual)}</strong>
            </div>
          </div>
        ) : (
          <div style={{ background: "#15803d22", border: "1px solid #22c55e44", borderRadius: 10, padding: "14px 18px", marginBottom: 24 }}>
            <div style={{ fontWeight: 700, color: "#22c55e", marginBottom: 4 }}>✅ Calificás para {bancosCalifican.length} banco{bancosCalifican.length !== 1 ? "s" : ""}</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              Mejor opción: <strong>{mejorCuota.nombre}</strong> · Cuota: <strong>$ {fmt(mejorCuota.cuota)}/mes</strong> · TNA: {mejorCuota.tna}% · {mejorCuota.plazo/12} años
            </div>
          </div>
        )}

        {/* Tabla bancos */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937" }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>
              Comparador de Bancos — Precio: USD {fmt(precioUSD)}
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#161616" }}>
                  {["Banco", "TNA", "Plazo", "LTV", "Enganche", "Capital", "Cuota/mes", "% Ingreso", "C.F.I.", "¿Calificás?"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #1f2937", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analisisBancos.map((b, i) => (
                  <tr key={b.nombre} style={{ background: i % 2 === 0 ? "#0f0f0f" : "#111", borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "8px 10px", color: b.califica ? "#22c55e" : "#9ca3af", fontWeight: 600, whiteSpace: "nowrap" }}>{b.nombre}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#e5e5e5" }}>{b.tna}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#9ca3af" }}>{b.plazo/12}a</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#9ca3af" }}>{b.ltv}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#e5e5e5" }}>$ {fmt(b.enganicheARS / 1000000, 1)}M</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#9ca3af" }}>$ {fmt(b.capital / 1000000, 1)}M</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: b === mejorCuota ? "#22c55e" : "#e5e5e5", fontWeight: b === mejorCuota ? 700 : 400 }}>$ {fmt(b.cuota)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: b.ratioIngreso > 30 ? "#cc0000" : b.ratioIngreso > 20 ? "#f97316" : "#22c55e", fontWeight: 600 }}>{b.ratioIngreso.toFixed(0)}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280" }}>{b.cfi.toFixed(0)}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      {b.califica
                        ? <span style={{ color: "#22c55e", fontWeight: 700 }}>✅ Sí</span>
                        : <span style={{ color: "#cc0000" }}>❌ No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Proyección ahorro vs precio */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937" }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Proyección: Ahorro vs Enganche necesario (10 años)</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#161616" }}>
                  {["Año","Ingreso/mes","Ahorro acum.","Precio prop.","Enganche 25%","Estado"].map(h => (
                    <th key={h} style={{ padding: "7px 12px", textAlign: "right", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #1f2937" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proyeccion.map((f, i) => (
                  <tr key={f.año} style={{ background: f.alcanza ? "#15803d22" : i % 2 === 0 ? "#0f0f0f" : "#111", borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#9ca3af" }}>{f.año}</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#e5e5e5" }}>$ {fmt(f.ingreso / 1000, 0)}k</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#3b82f6", fontWeight: 600 }}>$ {fmt(f.ahorro / 1000000, 1)}M</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#9ca3af" }}>$ {fmt(f.precio / 1000000, 1)}M</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#f97316" }}>$ {fmt(f.enganche25 / 1000000, 1)}M</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 700, color: f.alcanza ? "#22c55e" : "#cc0000" }}>
                      {f.alcanza ? "✅ Alcanza" : "❌ Falta"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>
          C.F.I. = Costo Financiero Total / Capital · Las tasas son orientativas. Consultá con cada banco para condiciones actualizadas.
        </div>
      </div>
    </div>
  );
}
