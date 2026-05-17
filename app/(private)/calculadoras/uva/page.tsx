"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Constantes ───────────────────────────────────────────────────────────────

// Valor UVA histórico aproximado (BCRA). Actualizado mayo 2026.
const UVA_HISTORICO: Record<string, number> = {
  "2016-04": 14.05, "2016-06": 14.56, "2016-12": 16.82,
  "2017-03": 18.46, "2017-06": 20.19, "2017-12": 22.89,
  "2018-03": 25.80, "2018-06": 31.44, "2018-12": 37.97,
  "2019-03": 41.05, "2019-06": 45.23, "2019-12": 50.52,
  "2020-03": 56.60, "2020-06": 63.90, "2020-12": 74.26,
  "2021-03": 82.14, "2021-06": 91.57, "2021-12": 105.34,
  "2022-03": 126.48,"2022-06": 158.47,"2022-12": 199.66,
  "2023-03": 244.17,"2023-06": 318.26,"2023-12": 479.73,
  "2024-01": 544.26,"2024-03": 695.00,"2024-06": 870.00,
  "2024-09": 960.00,"2024-12": 1040.00,
  "2025-03": 1120.00,"2025-06": 1180.00,"2025-09": 1230.00,"2025-12": 1280.00,
  "2026-01": 1310.00,"2026-02": 1335.00,"2026-03": 1360.00,"2026-04": 1388.00,"2026-05": 1412.00,
};

const PLAZOS = [60, 120, 180, 240, 300, 360];

const fmt = (n: number, dec = 0) => n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtARS = (n: number) => `$${fmt(n, 0)}`;
const fmtUVA = (n: number) => `${fmt(n, 2)} UVA`;

interface CuotaRow {
  mes: number;
  fecha: string;
  uvaValor: number;
  cuotaUVA: number;
  cuotaARS: number;
  capitalUVA: number;
  interesUVA: number;
  saldoUVA: number;
}

export default function CalculadoraUVA() {
  const [montoARS, setMontoARS] = useState<string>("30000000");
  const [tna, setTna] = useState<string>("8.5");
  const [plazo, setPlazo] = useState<number>(240);
  const [uvaInicio, setUvaInicio] = useState<string>("1360");
  const [uvaActual, setUvaActual] = useState<string>("1412");
  const [cerMensual, setCerMensual] = useState<string>("2.5");
  const [mesInicio, setMesInicio] = useState<string>("2026-03");
  const [verTabla, setVerTabla] = useState(false);

  const calc = useMemo(() => {
    const capital = parseFloat(montoARS) || 0;
    const uvIni = parseFloat(uvaInicio) || 1;
    const uvAct = parseFloat(uvaActual) || 1;
    const tnaDec = (parseFloat(tna) || 0) / 100;
    const tmaDec = tnaDec / 12;
    const cerMens = (parseFloat(cerMensual) || 0) / 100;

    // Capital inicial en UVAs
    const capitalUVA = capital / uvIni;

    // Cuota en UVAs (sistema francés sobre UVAs)
    // cuotaUVA = capitalUVA * tma / (1 - (1+tma)^-n)
    const cuotaUVA =
      tmaDec === 0
        ? capitalUVA / plazo
        : (capitalUVA * tmaDec) / (1 - Math.pow(1 + tmaDec, -plazo));

    // Cuota en ARS al inicio
    const cuotaInicialARS = cuotaUVA * uvIni;
    // Cuota actual (con UVA hoy)
    const cuotaActualARS = cuotaUVA * uvAct;

    // Variación UVA desde inicio
    const varUVA = ((uvAct - uvIni) / uvIni) * 100;

    // Calcular mes actual dentro del préstamo
    const [anoIni, mesIni] = mesInicio.split("-").map(Number);
    const anoAct = 2026, mesActN = 5;
    const mesesTranscurridos = Math.max(0, (anoAct - anoIni) * 12 + (mesActN - mesIni));
    const mesesRestantes = Math.max(0, plazo - mesesTranscurridos);

    // Saldo restante en UVAs (amortización francés)
    let saldoUVA = capitalUVA;
    for (let i = 0; i < Math.min(mesesTranscurridos, plazo); i++) {
      const intereses = saldoUVA * tmaDec;
      const amortizacion = cuotaUVA - intereses;
      saldoUVA = Math.max(0, saldoUVA - amortizacion);
    }

    const saldoARS = saldoUVA * uvAct;
    const pctAmortizado = capitalUVA > 0 ? ((capitalUVA - saldoUVA) / capitalUVA) * 100 : 0;

    // Proyección de cuotas futuras en ARS (últimas 12 o todas si son pocas)
    const proyeccion: CuotaRow[] = [];
    let saldo = saldoUVA;
    let uvValor = uvAct;
    const mesesMostrar = Math.min(mesesRestantes, 60);
    const [anoA, mesA] = [anoAct, mesActN];
    for (let i = 0; i < mesesMostrar && saldo > 0.01; i++) {
      const intereses = saldo * tmaDec;
      const amortizacion = Math.min(cuotaUVA - intereses, saldo);
      saldo = Math.max(0, saldo - amortizacion);
      uvValor = uvValor * (1 + cerMens);
      const fecha = new Date(anoA, mesA - 1 + i + 1, 1);
      proyeccion.push({
        mes: mesesTranscurridos + i + 1,
        fecha: fecha.toLocaleDateString("es-AR", { month: "short", year: "numeric" }),
        uvaValor: uvValor,
        cuotaUVA: cuotaUVA,
        cuotaARS: cuotaUVA * uvValor,
        capitalUVA: amortizacion,
        interesUVA: intereses,
        saldoUVA: saldo,
      });
    }

    // Cuota estimada en 12 meses
    const uvEn12 = uvAct * Math.pow(1 + cerMens, 12);
    const cuotaEn12 = cuotaUVA * uvEn12;
    const varEn12 = ((cuotaEn12 - cuotaActualARS) / cuotaActualARS) * 100;

    return {
      capitalUVA, cuotaUVA, cuotaInicialARS, cuotaActualARS,
      varUVA, mesesTranscurridos, mesesRestantes, saldoUVA, saldoARS,
      pctAmortizado, proyeccion, cuotaEn12, varEn12,
      uvIni, uvAct,
    };
  }, [montoARS, tna, plazo, uvaInicio, uvaActual, cerMensual, mesInicio]);

  const inputStyle: React.CSSProperties = {
    background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 14, padding: "8px 12px", width: "100%",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 5, display: "block",
  };
  const cardStyle: React.CSSProperties = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 22px",
  };

  const maxCuota = Math.max(...calc.proyeccion.map(r => r.cuotaARS), calc.cuotaActualARS, 1);

  const MESES_NOMBRES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Calculadora UVA</h1>
        <span style={{ background: "#3b82f6", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>HIPOTECAS</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        {/* Panel izquierdo */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>Préstamo original</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Monto solicitado (ARS)</label>
              <input style={inputStyle} type="number" value={montoARS} onChange={e => setMontoARS(e.target.value)} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                = {fmtUVA(parseFloat(montoARS) / (parseFloat(uvaInicio) || 1))} al inicio
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>TNA sobre UVA (%)</label>
              <input style={inputStyle} type="number" step="0.1" value={tna} onChange={e => setTna(e.target.value)} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Tasa nominal anual sobre saldo en UVAs</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Plazo (meses)</label>
              <select style={inputStyle} value={plazo} onChange={e => setPlazo(Number(e.target.value))}>
                {PLAZOS.map(p => <option key={p} value={p}>{p} meses ({p/12} años)</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 0 }}>
              <label style={labelStyle}>Mes de inicio del préstamo</label>
              <select style={inputStyle} value={mesInicio} onChange={e => setMesInicio(e.target.value)}>
                {Object.keys(UVA_HISTORICO).sort().map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>Valores UVA</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>UVA al inicio del préstamo</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, width: "60%" }} type="number" value={uvaInicio} onChange={e => setUvaInicio(e.target.value)} />
                <select style={{ ...inputStyle, width: "40%", fontSize: 11 }}
                  onChange={e => { if (e.target.value) setUvaInicio(e.target.value); }}>
                  <option value="">Histórico</option>
                  {Object.entries(UVA_HISTORICO).sort().map(([k,v]) => (
                    <option key={k} value={v}>{k}: ${v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 0 }}>
              <label style={labelStyle}>UVA hoy</label>
              <input style={inputStyle} type="number" value={uvaActual} onChange={e => setUvaActual(e.target.value)} />
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>Proyección futura</h3>
            <div>
              <label style={labelStyle}>CER mensual esperado (%)</label>
              <input style={inputStyle} type="number" step="0.1" value={cerMensual} onChange={e => setCerMensual(e.target.value)} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Se aplica para proyectar UVA futura. Inflación mensual esperada.</div>
            </div>
          </div>

          {/* Nota */}
          <div style={{ background: "#0d0d0d", border: "1px solid rgba(255,165,0,0.2)", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", marginBottom: 4 }}>MECANISMO UVA</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              El préstamo se expresa en UVAs. La cuota en pesos sube con la inflación (CER). Si la cuota supera el 10% del ingreso por 3 meses seguidos, se puede solicitar extensión del plazo hasta 25% (BCRA Com. A 6197).
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPIs principales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {[
              { label: "Cuota inicial", val: fmtARS(calc.cuotaInicialARS), sub: fmtUVA(calc.cuotaUVA), color: "#a78bfa" },
              { label: "Cuota hoy", val: fmtARS(calc.cuotaActualARS), sub: `+${calc.varUVA.toFixed(1)}% vs inicio`, color: calc.varUVA > 100 ? "#ef4444" : "#f59e0b" },
              { label: "Saldo restante", val: fmtARS(calc.saldoARS), sub: fmtUVA(calc.saldoUVA), color: "#cc0000" },
              { label: "Amortizado", val: `${calc.pctAmortizado.toFixed(1)}%`, sub: `${calc.mesesTranscurridos}/${plazo} meses`, color: "#22c55e" },
            ].map((k, i) => (
              <div key={i} style={{ ...cardStyle, textAlign: "center", padding: "16px 12px" }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: k.color, lineHeight: 1.2 }}>{k.val}</div>
                <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{k.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Barra de progreso del préstamo */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Progreso del préstamo</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{calc.mesesTranscurridos} de {plazo} meses</span>
            </div>
            <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${Math.min(calc.pctAmortizado, 100)}%`, background: "linear-gradient(90deg,#22c55e,#3b82f6)", borderRadius: 6 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              <span>Capital amortizado: {fmtUVA(calc.capitalUVA - calc.saldoUVA)}</span>
              <span>Restan {calc.mesesRestantes} meses</span>
            </div>
          </div>

          {/* Evolución UVA */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                Proyección cuota ARS próximos {Math.min(calc.proyeccion.length, 12)} meses
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>CER {cerMensual}%/mes · cuota en 12m: {fmtARS(calc.cuotaEn12)} (+{calc.varEn12.toFixed(0)}%)</span>
            </div>

            {calc.proyeccion.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "20px 0" }}>Préstamo ya cancelado</div>
            ) : (
              <svg width="100%" height={140} style={{ overflow: "visible" }}>
                {calc.proyeccion.slice(0, 12).map((r, i, arr) => {
                  const total = arr.length;
                  const barW = Math.floor(100 / total);
                  const x = `${i * (100 / total) + 0.5}%`;
                  const h = (r.cuotaARS / maxCuota) * 120;
                  return (
                    <g key={i}>
                      <rect x={x} y={140 - h} width={`${barW - 1}%`} height={h} rx={2} fill="#3b82f6" opacity={0.8} />
                      {i % 3 === 0 && (
                        <text x={`${i * (100 / total) + barW / 2}%`} y={138} fontSize={8} fill="rgba(255,255,255,0.3)" textAnchor="middle">{r.fecha}</text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Tabla de amortización */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Tabla de cuotas futuras</span>
              <button onClick={() => setVerTabla(v => !v)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "rgba(255,255,255,0.5)", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>
                {verTabla ? "Ocultar" : "Ver tabla"}
              </button>
            </div>

            {verTabla && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      {["N°","Fecha","UVA","Cuota ARS","Capital UVA","Interés UVA","Saldo UVA"].map(h => (
                        <th key={h} style={{ textAlign: "right", padding: "6px 8px", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calc.proyeccion.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.4)", textAlign: "right" }}>{r.mes}</td>
                        <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.6)", textAlign: "right" }}>{r.fecha}</td>
                        <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.5)", textAlign: "right" }}>${fmt(r.uvaValor, 0)}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#3b82f6", textAlign: "right" }}>{fmtARS(r.cuotaARS)}</td>
                        <td style={{ padding: "5px 8px", color: "#22c55e", textAlign: "right" }}>{fmt(r.capitalUVA, 2)}</td>
                        <td style={{ padding: "5px 8px", color: "#f59e0b", textAlign: "right" }}>{fmt(r.interesUVA, 2)}</td>
                        <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.6)", textAlign: "right" }}>{fmt(r.saldoUVA, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!verTabla && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Cuota UVA (fija)", val: fmtUVA(calc.cuotaUVA), color: "#a78bfa" },
                  { label: "Capital mensual prom.", val: fmtUVA(calc.saldoUVA / Math.max(calc.mesesRestantes, 1)), color: "#22c55e" },
                  { label: "Cuota en 12 meses", val: fmtARS(calc.cuotaEn12), color: "#f59e0b" },
                ].map((k, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: k.color }}>{k.val}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Montserrat,sans-serif" }}>{k.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comparación cuota inicial vs actual */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Impacto de la inflación en la cuota</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: `Cuota al inicio (UVA $${calc.uvIni.toFixed(0)})`, val: fmtARS(calc.cuotaInicialARS), color: "#a78bfa" },
                { label: `Cuota hoy (UVA $${calc.uvAct.toFixed(0)})`, val: fmtARS(calc.cuotaActualARS), color: calc.varUVA > 100 ? "#ef4444" : "#f59e0b" },
              ].map((k, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "100%", background: "#a78bfa", borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>inicio</span>
            </div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (calc.cuotaActualARS / (calc.cuotaInicialARS || 1)) * 100)}%`, background: calc.varUVA > 100 ? "#ef4444" : "#f59e0b", borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>hoy ×{(calc.uvAct / calc.uvIni).toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
