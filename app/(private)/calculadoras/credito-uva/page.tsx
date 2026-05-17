"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface EscenarioUVA {
  nombre: string;
  inflacionAnual: number; // %
  color: string;
}

const ESCENARIOS_UVA: EscenarioUVA[] = [
  { nombre: "Desinflación", inflacionAnual: 30, color: "#22c55e" },
  { nombre: "Moderado",    inflacionAnual: 60, color: "#3b82f6" },
  { nombre: "Base",        inflacionAnual: 80, color: "#f97316" },
  { nombre: "Pesimista",  inflacionAnual: 120, color: "#a855f7" },
  { nombre: "Hiper",      inflacionAnual: 200, color: "#cc0000" },
];

interface FilaAnual {
  anio: number;
  // UVA
  uvaCuotaARS: number;
  uvaCuotaUSD: number;
  uvaSaldoARS: number;
  // Tradicional
  tradCuotaARS: number;
  tradCuotaUSD: number;
  tradSaldoARS: number;
}

export default function CreditoUVAPage() {
  const [capitalARS, setCapitalARS] = useState(50000000);
  const [valorUVAHoy, setValorUVAHoy] = useState(1200);
  const [tnaUVA, setTnaUVA] = useState(7);       // tasa sobre UVA
  const [tnaTrad, setTnaTrad] = useState(70);    // crédito tradicional en ARS
  const [plazo, setPlazo] = useState(240);
  const [tcHoy, setTcHoy] = useState(1300);
  const [aprecUSD, setAprecUSD] = useState(50);  // apreciación anual del dólar %
  const [salarioActual, setSalarioActual] = useState(800000);
  const [incrementoSalario, setIncrementoSalario] = useState(60);

  const TEMAUVA = tnaUVA / 100 / 12;
  const TEMTRAD = tnaTrad / 100 / 12;

  // Cuota inicial UVA (en UVAs)
  const capitalUVA = capitalARS / valorUVAHoy;
  const cuotaUVA_uvas = capitalUVA > 0 && TEMAUVA > 0
    ? capitalUVA * TEMAUVA * Math.pow(1 + TEMAUVA, plazo) / (Math.pow(1 + TEMAUVA, plazo) - 1)
    : capitalUVA / plazo;

  // Cuota inicial tradicional (ARS fija)
  const cuotaTrad_ARS = capitalARS > 0 && TEMTRAD > 0
    ? capitalARS * TEMTRAD * Math.pow(1 + TEMTRAD, plazo) / (Math.pow(1 + TEMTRAD, plazo) - 1)
    : capitalARS / plazo;

  const cuotaUVA_ARS_ini = cuotaUVA_uvas * valorUVAHoy;
  const cuotaUVA_USD_ini = cuotaUVA_ARS_ini / tcHoy;
  const cuotaTrad_USD_ini = cuotaTrad_ARS / tcHoy;

  // Escenario base para proyección anual
  const escBase = ESCENARIOS_UVA[2];

  const proyeccion = useMemo((): FilaAnual[] => {
    const filas: FilaAnual[] = [];
    const añosTotal = Math.ceil(plazo / 12);
    let saldoUVA = capitalUVA;
    let saldoTrad = capitalARS;

    for (let a = 1; a <= añosTotal; a++) {
      const inflMensual = Math.pow(1 + escBase.inflacionAnual / 100, 1 / 12) - 1;
      const aprecMensual = Math.pow(1 + aprecUSD / 100, 1 / 12) - 1;
      const vuvaMes = valorUVAHoy * Math.pow(1 + inflMensual, (a - 1) * 12);
      const tcMes = tcHoy * Math.pow(1 + aprecMensual, (a - 1) * 12);

      // UVA: cuota en UVAs es fija, ARS sube con inflación
      const cuotaUVA_A = cuotaUVA_uvas * vuvaMes;
      const intUVA = saldoUVA * TEMAUVA;
      const capUVA = cuotaUVA_uvas - intUVA;
      saldoUVA = Math.max(0, saldoUVA - capUVA * 12);

      // Tradicional: cuota ARS fija
      const intTrad = saldoTrad * TEMTRAD;
      const capTrad = cuotaTrad_ARS - intTrad;
      saldoTrad = Math.max(0, saldoTrad - capTrad * 12);

      filas.push({
        anio: a,
        uvaCuotaARS: cuotaUVA_A,
        uvaCuotaUSD: cuotaUVA_A / tcMes,
        uvaSaldoARS: saldoUVA * vuvaMes,
        tradCuotaARS: cuotaTrad_ARS,
        tradCuotaUSD: cuotaTrad_ARS / tcMes,
        tradSaldoARS: saldoTrad,
      });
    }
    return filas;
  }, [capitalUVA, capitalARS, cuotaUVA_uvas, cuotaTrad_ARS, TEMAUVA, TEMTRAD, plazo, escBase, valorUVAHoy, tcHoy, aprecUSD]);

  // Tabla comparativa por escenario UVA en años clave: 1, 5, 10
  const tablaEscenarios = useMemo(() => {
    return ESCENARIOS_UVA.map(esc => {
      const inflMensual = Math.pow(1 + esc.inflacionAnual / 100, 1 / 12) - 1;
      const aprecMensual = Math.pow(1 + aprecUSD / 100, 1 / 12) - 1;
      const calc = (anios: number) => {
        const vuva = valorUVAHoy * Math.pow(1 + inflMensual, anios * 12);
        const tc = tcHoy * Math.pow(1 + aprecMensual, anios * 12);
        const cuotaARS = cuotaUVA_uvas * vuva;
        const cuotaUSD = cuotaARS / tc;
        const salario = salarioActual * Math.pow(1 + incrementoSalario / 100, anios);
        const pctSalario = salario > 0 ? (cuotaARS / salario) * 100 : 0;
        return { cuotaARS, cuotaUSD, pctSalario };
      };
      return { esc, anio1: calc(1), anio5: calc(5), anio10: calc(10) };
    });
  }, [cuotaUVA_uvas, valorUVAHoy, tcHoy, aprecUSD, salarioActual, incrementoSalario]);

  // Gráfico SVG proyección a 10 años
  const GWID = 560;
  const GHEI = 140;
  const años10 = proyeccion.slice(0, 10);
  const maxCuota = Math.max(...años10.map(f => Math.max(f.uvaCuotaARS, f.tradCuotaARS)), 1);

  const polyUVA = años10.map((f, i) => `${(i / 9) * GWID},${GHEI - (f.uvaCuotaARS / maxCuota) * GHEI}`).join(" ");
  const polyTrad = años10.map((f, i) => `${(i / 9) * GWID},${GHEI - (f.tradCuotaARS / maxCuota) * GHEI}`).join(" ");

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const filas = proyeccion.map(f => `<tr>
      <td>${f.anio}</td>
      <td>$ ${fmt(f.uvaCuotaARS)}</td><td>USD ${fmt(f.uvaCuotaUSD)}</td>
      <td>$ ${fmt(f.tradCuotaARS)}</td><td>USD ${fmt(f.tradCuotaUSD)}</td>
    </tr>`).join("");
    win.document.write(`<html><body style="font-family:sans-serif;padding:24px">
      <h2>Crédito UVA vs Tradicional</h2>
      <p>Capital: ARS ${fmt(capitalARS)} · UVA TNA: ${tnaUVA}% · Trad TNA: ${tnaTrad}% · Plazo: ${plazo} meses</p>
      <table border="1" cellpadding="4" style="width:100%;border-collapse:collapse">
        <thead><tr><th>Año</th><th>UVA cuota ARS</th><th>UVA cuota USD</th><th>Trad. cuota ARS</th><th>Trad. cuota USD</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const ratioInicialUSD = cuotaTrad_USD_ini > 0 ? cuotaUVA_USD_ini / cuotaTrad_USD_ini : 0;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              🏦 Crédito UVA vs Tradicional
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
              Compará cuotas, saldo y costo en distintos escenarios inflacionarios
            </p>
          </div>
          <Link href="/calculadoras" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        {/* Inputs */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 16 }}>
            {[
              { label: "Capital en ARS", val: capitalARS, set: setCapitalARS },
              { label: "Valor UVA hoy ($)", val: valorUVAHoy, set: setValorUVAHoy },
              { label: "TNA crédito UVA (%)", val: tnaUVA, set: setTnaUVA, step: 0.5 },
              { label: "TNA crédito tradicional (%)", val: tnaTrad, set: setTnaTrad, step: 1 },
              { label: "Plazo (meses)", val: plazo, set: setPlazo },
              { label: "TC USD/ARS hoy", val: tcHoy, set: setTcHoy },
              { label: "Apreciación USD (%/año)", val: aprecUSD, set: setAprecUSD, step: 5 },
              { label: "Salario actual (ARS)", val: salarioActual, set: setSalarioActual },
              { label: "Incremento salario (%/año)", val: incrementoSalario, set: setIncrementoSalario, step: 5 },
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

        {/* KPI comparativa inicial */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "#111", border: "1px solid #3b82f666", borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#3b82f6", marginBottom: 12 }}>🏠 Crédito UVA</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Capital en UVAs</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#e5e5e5", marginBottom: 8 }}>{fmt(capitalUVA, 0)} UVAs</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Cuota inicial (hoy)</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#3b82f6" }}>$ {fmt(cuotaUVA_ARS_ini)}</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>≈ USD {fmt(cuotaUVA_USD_ini)}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
              Cuota en UVAs: {fmt(cuotaUVA_uvas, 1)} UVAs / mes (fija)
            </div>
          </div>
          <div style={{ background: "#111", border: "1px solid #f9731666", borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#f97316", marginBottom: 12 }}>💵 Crédito Tradicional</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Cuota fija (ARS)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f97316", marginBottom: 4 }}>$ {fmt(cuotaTrad_ARS)}</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>≈ USD {fmt(cuotaTrad_USD_ini)}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 12 }}>
              Cuota UVA vs Trad: <span style={{ color: ratioInicialUSD < 1 ? "#22c55e" : "#cc0000", fontWeight: 700 }}>
                {(ratioInicialUSD * 100).toFixed(0)}%
              </span> del tradicional
            </div>
          </div>
        </div>

        {/* Tabla escenarios inflacionarios */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>
              Cuota UVA según escenario inflacionario
            </span>
            <button onClick={exportarPDF}
              style={{ background: "#cc000022", color: "#cc0000", border: "1px solid #cc000044", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>
              📄 PDF
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#161616" }}>
                  <th style={{ padding: "8px 14px", textAlign: "left", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>Escenario</th>
                  <th style={{ padding: "8px 14px", textAlign: "center", color: "#6b7280", borderBottom: "1px solid #1f2937" }}>Inflación/año</th>
                  {["Año 1", "Año 5", "Año 10"].map(h => (
                    <th key={h} colSpan={3} style={{ padding: "8px 14px", textAlign: "center", color: "#6b7280", borderBottom: "1px solid #1f2937", borderLeft: "1px solid #1f2937" }}>{h}</th>
                  ))}
                </tr>
                <tr style={{ background: "#0f0f0f" }}>
                  <th colSpan={2} style={{ borderBottom: "1px solid #1f2937" }} />
                  {[0, 1, 2].map(i => (
                    <>
                      <th key={`h-ars-${i}`} style={{ padding: "6px 10px", textAlign: "right", color: "#4b5563", fontSize: 11, borderBottom: "1px solid #1f2937", borderLeft: "1px solid #1f2937" }}>ARS</th>
                      <th key={`h-usd-${i}`} style={{ padding: "6px 10px", textAlign: "right", color: "#4b5563", fontSize: 11, borderBottom: "1px solid #1f2937" }}>USD</th>
                      <th key={`h-sal-${i}`} style={{ padding: "6px 10px", textAlign: "right", color: "#4b5563", fontSize: 11, borderBottom: "1px solid #1f2937" }}>% sal.</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tablaEscenarios.map((row, ri) => (
                  <tr key={row.esc.nombre} style={{ background: ri % 2 === 0 ? "#0f0f0f" : "#111", borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "8px 14px", fontWeight: 700, color: row.esc.color }}>{row.esc.nombre}</td>
                    <td style={{ padding: "8px 14px", textAlign: "center", color: "#9ca3af" }}>{row.esc.inflacionAnual}%</td>
                    {[row.anio1, row.anio5, row.anio10].map((d, i) => (
                      <>
                        <td key={`ars-${i}`} style={{ padding: "8px 10px", textAlign: "right", color: "#e5e5e5", borderLeft: "1px solid #1f2937" }}>$ {fmt(d.cuotaARS)}</td>
                        <td key={`usd-${i}`} style={{ padding: "8px 10px", textAlign: "right", color: row.esc.color }}>USD {fmt(d.cuotaUSD)}</td>
                        <td key={`sal-${i}`} style={{ padding: "8px 10px", textAlign: "right", color: d.pctSalario > 40 ? "#cc0000" : "#22c55e" }}>{d.pctSalario.toFixed(0)}%</td>
                      </>
                    ))}
                  </tr>
                ))}
                {/* Fila tradicional para referencia */}
                <tr style={{ background: "#1a1a1a", borderTop: "2px solid #374151" }}>
                  <td style={{ padding: "8px 14px", fontWeight: 700, color: "#f97316" }}>Tradicional</td>
                  <td style={{ padding: "8px 14px", textAlign: "center", color: "#9ca3af" }}>—</td>
                  {[1, 5, 10].map(a => {
                    const aprecM = Math.pow(1 + aprecUSD / 100, 1 / 12) - 1;
                    const tc = tcHoy * Math.pow(1 + aprecM, a * 12);
                    const salario = salarioActual * Math.pow(1 + incrementoSalario / 100, a);
                    const pct = salario > 0 ? (cuotaTrad_ARS / salario) * 100 : 0;
                    return (
                      <>
                        <td key={`t-ars-${a}`} style={{ padding: "8px 10px", textAlign: "right", color: "#e5e5e5", borderLeft: "1px solid #1f2937" }}>$ {fmt(cuotaTrad_ARS)}</td>
                        <td key={`t-usd-${a}`} style={{ padding: "8px 10px", textAlign: "right", color: "#f97316" }}>USD {fmt(cuotaTrad_ARS / tc)}</td>
                        <td key={`t-sal-${a}`} style={{ padding: "8px 10px", textAlign: "right", color: pct > 40 ? "#cc0000" : "#22c55e" }}>{pct.toFixed(0)}%</td>
                      </>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Gráfico evolución cuota ARS */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 16 }}>
            Evolución cuota ARS — primeros 10 años (escenario Base {escBase.inflacionAnual}% inflación)
          </div>
          <div style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${GWID} ${GHEI + 30}`} style={{ width: "100%", maxWidth: GWID, height: GHEI + 30 }}>
              <polyline points={polyUVA} fill="none" stroke="#3b82f6" strokeWidth={2} />
              <polyline points={polyTrad} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="6,3" />
              {años10.map((f, i) => (
                <text key={i} x={(i / 9) * GWID} y={GHEI + 16} fontSize={9} fill="#4b5563" textAnchor="middle">A{f.anio}</text>
              ))}
            </svg>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
              <div style={{ width: 20, height: 2, background: "#3b82f6" }} /> UVA
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
              <div style={{ width: 20, height: 2, background: "#f97316" }} /> Tradicional
            </div>
          </div>
        </div>

        {/* Aviso */}
        <div style={{ background: "#1c1107", border: "1px solid #f9731644", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#9ca3af" }}>
          <strong style={{ color: "#f97316" }}>⚠️ Riesgo UVA:</strong> La cuota UVA sube con la inflación. Si el salario no acompaña,
          el ratio cuota/salario puede volverse insostenible. El escenario pesimista (120%+) puede implicar cuotas 4× mayores al año 10.
          Considerar la cláusula de protección salarial según normativa vigente.
        </div>
      </div>
    </div>
  );
}
