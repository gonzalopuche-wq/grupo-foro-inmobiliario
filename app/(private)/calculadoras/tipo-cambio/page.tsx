"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const TIPOS_CAMBIO = [
  { id: "oficial", label: "Oficial / minorista", color: "#3b82f6", descripcion: "Tipo de cambio oficial BNA" },
  { id: "mep", label: "Dólar MEP / Bolsa", color: "#22c55e", descripcion: "Operado en mercado de capitales (AL30)" },
  { id: "ccl", label: "Contado con Liqui (CCL)", color: "#a855f7", descripcion: "Para envíos al exterior (GD30)" },
  { id: "blue", label: "Dólar Blue (informal)", color: "#f97316", descripcion: "Mercado paralelo informal" },
  { id: "cripto", label: "Dólar Cripto/USDT", color: "#eab308", descripcion: "Vía stablecoins (P2P)" },
];

interface Escenario {
  id: string;
  label: string;
  tcMultiplier: number; // multiplicador sobre el oficial
  descripcion: string;
  color: string;
}

const ESCENARIOS_DEVALUA: Escenario[] = [
  { id: "actual", label: "Actual", tcMultiplier: 1, descripcion: "Sin cambios en el TC oficial", color: "#22c55e" },
  { id: "5pct", label: "+5%", tcMultiplier: 1.05, descripcion: "Devaluación leve del oficial", color: "#eab308" },
  { id: "15pct", label: "+15%", tcMultiplier: 1.15, descripcion: "Devaluación moderada", color: "#f97316" },
  { id: "30pct", label: "+30%", tcMultiplier: 1.30, descripcion: "Devaluación significativa (crawling peg acelerado)", color: "#ef4444" },
  { id: "50pct", label: "+50%", tcMultiplier: 1.50, descripcion: "Devaluación brusca / salto cambiario", color: "#cc0000" },
  { id: "100pct", label: "+100%", tcMultiplier: 2.00, descripcion: "Devaluación extrema (dolarización)", color: "#7c3aed" },
];

export default function TipoCambioPage() {
  // Precios de propiedad
  const [precioUSD, setPrecioUSD] = useState(150000);
  const [m2, setM2] = useState(60);
  const [presupuestoARS, setPresupuestoARS] = useState(150000000);

  // Tipos de cambio actuales
  const [tcOficial, setTcOficial] = useState(1150);
  const [tcMEP, setTcMEP] = useState(1280);
  const [tcCCL, setTcCCL] = useState(1300);
  const [tcBlue, setTcBlue] = useState(1350);
  const [tcCripto, setTcCripto] = useState(1330);

  const tcs: Record<string, number> = { oficial: tcOficial, mep: tcMEP, ccl: tcCCL, blue: tcBlue, cripto: tcCripto };

  // Alquiler
  const [alquilerUSD, setAlquilerUSD] = useState(800);

  const calcPorTC = useMemo(() => {
    return TIPOS_CAMBIO.map(tipo => {
      const tc = tcs[tipo.id];
      return {
        ...tipo,
        tc,
        precioARS: precioUSD * tc,
        precioM2ARS: m2 > 0 ? (precioUSD * tc) / m2 : 0,
        precioM2USD: m2 > 0 ? precioUSD / m2 : 0,
        alquilerARS: alquilerUSD * tc,
        poderesARS: presupuestoARS > 0 ? presupuestoARS / tc : 0, // cuántos USD compro con el presupuesto ARS
      };
    });
  }, [precioUSD, m2, presupuestoARS, alquilerUSD, tcOficial, tcMEP, tcCCL, tcBlue, tcCripto]);

  const escenarios = useMemo(() => {
    return ESCENARIOS_DEVALUA.map(e => {
      const tcEsc = tcOficial * e.tcMultiplier;
      return {
        ...e,
        tc: tcEsc,
        precioARS: precioUSD * tcEsc,
        poderesARS: presupuestoARS > 0 ? presupuestoARS / tcEsc : 0,
        alquilerARS: alquilerUSD * tcEsc,
      };
    });
  }, [precioUSD, presupuestoARS, alquilerUSD, tcOficial]);

  // Brecha cambiaria
  const brechaBlue = tcOficial > 0 ? ((tcBlue - tcOficial) / tcOficial) * 100 : 0;
  const brechaMEP = tcOficial > 0 ? ((tcMEP - tcOficial) / tcOficial) * 100 : 0;
  const brechaCCL = tcOficial > 0 ? ((tcCCL - tcOficial) / tcOficial) * 100 : 0;

  // TC de accesibilidad: cuánto puede subir el TC oficial antes de que el presupuesto ARS no alcance
  const tcAccesibilidad = presupuestoARS > 0 ? presupuestoARS / precioUSD : 0;
  const margenAccesibilidad = tcAccesibilidad > 0 && tcOficial > 0 ? ((tcAccesibilidad - tcOficial) / tcOficial) * 100 : 0;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>💱 Tipo de Cambio & Precios</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Precio de propiedades en ARS según distintos tipos de cambio y escenarios</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          {/* Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Propiedad</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Precio (USD)", value: precioUSD, set: setPrecioUSD, step: 5000 },
                  { label: "Superficie (m²)", value: m2, set: setM2, step: 5 },
                  { label: "Alquiler mensual (USD)", value: alquilerUSD, set: setAlquilerUSD, step: 50 },
                  { label: "Presupuesto del comprador (ARS)", value: presupuestoARS, set: setPresupuestoARS, step: 5000000 },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>{f.label}</label>
                    <input type="number" value={f.value} step={f.step} onChange={e => f.set(parseFloat(e.target.value)||0)}
                      style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Tipos de cambio (ARS/USD)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Oficial / minorista", value: tcOficial, set: setTcOficial },
                  { label: "MEP / Bolsa", value: tcMEP, set: setTcMEP },
                  { label: "CCL", value: tcCCL, set: setTcCCL },
                  { label: "Blue", value: tcBlue, set: setTcBlue },
                  { label: "Cripto / USDT", value: tcCripto, set: setTcCripto },
                ].map(f => (
                  <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", flex: 1 }}>{f.label}</label>
                    <input type="number" value={f.value} step={10} onChange={e => f.set(parseFloat(e.target.value)||1)}
                      style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "4px 8px", fontSize: 13, width: 90, textAlign: "right" }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Brechas cambiarias</div>
              {[
                { label: "Brecha MEP vs Oficial", val: brechaMEP, color: "#22c55e" },
                { label: "Brecha CCL vs Oficial", val: brechaCCL, color: "#a855f7" },
                { label: "Brecha Blue vs Oficial", val: brechaBlue, color: "#f97316" },
              ].map(b => (
                <div key={b.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: "#6b7280" }}>{b.label}</span>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: b.color }}>+{b.val.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resultados */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Precio por TC */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 14, textTransform: "uppercase" }}>Precio según tipo de cambio</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {calcPorTC.map(c => (
                  <div key={c.id} style={{ background: "#0a0a0a", border: `1px solid ${c.color}33`, borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: c.color }}>{c.label}</div>
                        <div style={{ fontSize: 10, color: "#4b5563" }}>{c.descripcion}</div>
                      </div>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#fff" }}>${fmt(c.tc)}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#6b7280" }}>Precio total</span>
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>ARS {fmt(Math.round(c.precioARS / 1000))}k</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#6b7280" }}>Por m²</span>
                        <span style={{ color: "#9ca3af" }}>ARS {fmt(Math.round(c.precioM2ARS / 1000))}k / m²</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#6b7280" }}>Alquiler</span>
                        <span style={{ color: "#9ca3af" }}>ARS {fmt(Math.round(c.alquilerARS / 1000))}k/mes</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#6b7280" }}>Con ARS {fmt(Math.round(presupuestoARS / 1000000))}M compra</span>
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: c.poderesARS >= precioUSD ? "#22c55e" : "#cc0000" }}>USD {fmt(Math.round(c.poderesARS))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accesibilidad del comprador */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 14, textTransform: "uppercase" }}>Accesibilidad del comprador (ARS {fmt(Math.round(presupuestoARS / 1000000))}M)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "TC de accesibilidad", value: `$${fmt(Math.round(tcAccesibilidad))}`, sub: "TC al que el presupuesto alcanza exactamente", color: tcAccesibilidad > tcBlue ? "#22c55e" : tcAccesibilidad > tcOficial ? "#f97316" : "#cc0000" },
                  { label: "Margen de TC", value: margenAccesibilidad >= 0 ? `+${margenAccesibilidad.toFixed(0)}%` : `${margenAccesibilidad.toFixed(0)}%`, sub: "Cuánto puede subir el TC antes que no alcance", color: margenAccesibilidad >= 20 ? "#22c55e" : margenAccesibilidad >= 0 ? "#f97316" : "#cc0000" },
                  { label: "Alcanza con Blue", value: presupuestoARS / tcBlue >= precioUSD ? "✅ Sí" : "❌ No", sub: `Faltan USD ${fmt(Math.max(0, Math.round(precioUSD - presupuestoARS / tcBlue)))}`, color: presupuestoARS / tcBlue >= precioUSD ? "#22c55e" : "#cc0000" },
                ].map(k => (
                  <div key={k.label} style={{ background: "#0a0a0a", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 20, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 10, color: "#4b5563", marginTop: 3 }}>{k.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Escenarios de devaluación */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 14, textTransform: "uppercase" }}>Escenarios de devaluación del oficial</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Escenario", "TC oficial", "Precio en ARS", "Con ARS presup.", "Alquiler ARS"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", textAlign: h === "Escenario" ? "left" : "right", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #1f2937", fontFamily: "Montserrat, sans-serif" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {escenarios.map(e => (
                      <tr key={e.id} style={{ borderBottom: "1px solid #111", background: e.id === "actual" ? "rgba(34,197,94,0.04)" : undefined }}>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: e.color }}>{e.label}</div>
                          <div style={{ fontSize: 10, color: "#4b5563" }}>{e.descripcion}</div>
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: e.color }}>${fmt(Math.round(e.tc))}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#9ca3af" }}>ARS {fmt(Math.round(e.precioARS / 1000000), 1)}M</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: e.poderesARS >= precioUSD ? "#22c55e" : "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
                          USD {fmt(Math.round(e.poderesARS))} {e.poderesARS >= precioUSD ? "✅" : "❌"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280" }}>ARS {fmt(Math.round(e.alquilerARS / 1000))}k</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#4b5563" }}>
              💡 Los tipos de cambio son referenciales. Actualizá los valores según las cotizaciones del día en ambito.com, dolarito.ar o Rava Bursátil.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
