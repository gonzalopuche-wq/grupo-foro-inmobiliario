"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Constantes ───────────────────────────────────────────────────────────────
// Relación cuota/ingreso que admiten los bancos argentinos (varía 20-30%)
const RATIO_CUOTA_INGRESO = 0.25; // 25% del ingreso neto
const PLAZO_DEFAULT = 20; // años

interface Banco {
  id: string;
  nombre: string;
  tna: number; // % anual
  ltvMax: number; // % del valor de la propiedad
  plazoMax: number; // años
  ingresoMin: number; // ARS mínimo para calificar
  tipo: "UVA" | "pesos" | "USD";
  color: string;
}

const BANCOS: Banco[] = [
  { id: "nacion",    nombre: "Banco Nación",       tna: 5.0,  ltvMax: 80, plazoMax: 30, ingresoMin: 400000,  tipo: "UVA",   color: "#3b82f6" },
  { id: "provincia", nombre: "Banco Provincia",    tna: 5.5,  ltvMax: 75, plazoMax: 25, ingresoMin: 450000,  tipo: "UVA",   color: "#a855f7" },
  { id: "hipotecario",nombre: "Banco Hipotecario", tna: 6.0,  ltvMax: 80, plazoMax: 20, ingresoMin: 500000,  tipo: "UVA",   color: "#f97316" },
  { id: "galicia",   nombre: "Galicia",             tna: 6.5,  ltvMax: 70, plazoMax: 20, ingresoMin: 600000,  tipo: "UVA",   color: "#eab308" },
  { id: "santander", nombre: "Santander",           tna: 6.5,  ltvMax: 70, plazoMax: 20, ingresoMin: 600000,  tipo: "UVA",   color: "#cc0000" },
  { id: "icbc",      nombre: "ICBC",                tna: 7.0,  ltvMax: 70, plazoMax: 20, ingresoMin: 700000,  tipo: "UVA",   color: "#22c55e" },
];

// Cuota mensual de préstamo UVA (tasa real anual → mensual, sobre capital)
function cuotaMensual(capital: number, tnaMensual: number, plazoMeses: number): number {
  if (tnaMensual === 0) return capital / plazoMeses;
  return capital * (tnaMensual * Math.pow(1 + tnaMensual, plazoMeses)) / (Math.pow(1 + tnaMensual, plazoMeses) - 1);
}

export default function CapacidadEndeudamientoPage() {
  const [ingresoNeto, setIngresoNeto] = useState(800000); // ARS
  const [otrasCuotas, setOtrasCuotas] = useState(0); // ARS cuotas actuales
  const [plazo, setPlazo] = useState(PLAZO_DEFAULT);
  const [tc, setTc] = useState(1300);
  const [uva, setUva] = useState(1600); // valor UVA actual (ARS)
  const [ahorro, setAhorro] = useState(30000); // USD disponibles como anticipo
  const [gastosScrip, setGastosScrip] = useState(8); // % del valor de compra en gastos escritura/impuestos

  const calcs = useMemo(() => {
    // Ingreso disponible para cuota hipotecaria
    const ingresoParaCuota = ingresoNeto * RATIO_CUOTA_INGRESO - otrasCuotas;

    // Por banco
    const porBanco = BANCOS.map(banco => {
      const tnaMensual = banco.tna / 100 / 12;
      const plazoMeses = Math.min(plazo, banco.plazoMax) * 12;

      // Capital máximo que puede tomar (cuota = ingresoParaCuota)
      // cuota = C * [tnaMensual * (1+tnaMensual)^n] / [(1+tnaMensual)^n - 1]
      const factor = tnaMensual > 0
        ? (tnaMensual * Math.pow(1 + tnaMensual, plazoMeses)) / (Math.pow(1 + tnaMensual, plazoMeses) - 1)
        : 1 / plazoMeses;
      const capitalMaxARS = ingresoParaCuota > 0 ? ingresoParaCuota / factor : 0;
      const capitalMaxUSD = capitalMaxARS / tc;

      // Valor máximo de propiedad según LTV
      const valorPropMaxUSD = capitalMaxUSD / (banco.ltvMax / 100);

      // Verificar anticipo disponible vs anticipo requerido
      const anticipoRequeridoUSD = valorPropMaxUSD * (1 - banco.ltvMax / 100);
      const anticipoDisponibleUSD = ahorro / (1 + gastosScrip / 100); // descontar gastos
      const califica = ingresoNeto >= banco.ingresoMin && anticipoDisponibleUSD >= anticipoRequeridoUSD * 0.9;

      const cuotaInicialARS = cuotaMensual(capitalMaxARS, tnaMensual, plazoMeses);

      // UVA: cuota inicial en UVA para referencia
      const capitalEnUVA = capitalMaxARS / uva;
      const cuotaEnUVA = cuotaMensual(capitalEnUVA, tnaMensual, plazoMeses);

      return {
        banco,
        capitalMaxARS, capitalMaxUSD,
        valorPropMaxUSD, anticipoRequeridoUSD,
        cuotaInicialARS, capitalEnUVA, cuotaEnUVA,
        califica,
      };
    });

    // Máximo global
    const maxValorUSD = Math.max(...porBanco.map(b => b.valorPropMaxUSD), 0);

    // Con ahorro propio limitando
    const porBancoConAhorro = porBanco.map(b => {
      const gastosUSD = ahorro * (gastosScrip / 100) / (1 + gastosScrip / 100);
      const ahorroDisponible = ahorro - gastosUSD;
      const porcentajeSobre = b.banco.ltvMax / 100;
      const valorPropConAhorro = ahorroDisponible / (1 - porcentajeSobre);
      const valorPropFinal = Math.min(b.valorPropMaxUSD, valorPropConAhorro);
      return { ...b, valorPropFinal };
    });

    return {
      ingresoParaCuota,
      porBanco: porBancoConAhorro,
      maxValorUSD,
    };
  }, [ingresoNeto, otrasCuotas, plazo, tc, uva, ahorro, gastosScrip]);

  const maxValorFinal = Math.max(...calcs.porBanco.map(b => b.valorPropFinal), 1);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>🏦 Capacidad de Endeudamiento</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>¿A qué propiedad podés acceder según tus ingresos y ahorros?</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
          {/* Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Perfil financiero</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Ingreso neto mensual (ARS)", value: ingresoNeto, set: setIngresoNeto, step: 50000 },
                  { label: "Otras cuotas actuales (ARS)", value: otrasCuotas, set: setOtrasCuotas, step: 10000 },
                  { label: "Ahorro disponible (USD)", value: ahorro, set: setAhorro, step: 1000 },
                  { label: "Plazo del crédito (años)", value: plazo, set: setPlazo, step: 5 },
                  { label: "TC ARS/USD", value: tc, set: setTc, step: 50 },
                  { label: "Valor UVA actual (ARS)", value: uva, set: setUva, step: 10 },
                  { label: "Gastos escritura / imp. (%)", value: gastosScrip, set: setGastosScrip, step: 0.5 },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>{f.label}</label>
                    <input type="number" value={f.value} step={f.step}
                      onChange={e => f.set(parseFloat(e.target.value) || 0)}
                      style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen capacidad */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Tu capacidad</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ background: "#0a0a0a", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Cuota disponible para hipoteca</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: calcs.ingresoParaCuota > 0 ? "#22c55e" : "#cc0000" }}>
                    ARS {fmt(Math.round(calcs.ingresoParaCuota / 1000))}k/mes
                  </div>
                  <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>25% de {fmt(Math.round(ingresoNeto / 1000))}k menos otras cuotas</div>
                </div>
                <div style={{ background: "#0a0a0a", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>Valor máx. de propiedad (mejor banco)</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: "#f97316" }}>
                    USD {fmt(Math.round(maxValorFinal))}
                  </div>
                  <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>ARS {fmt(Math.round(maxValorFinal * tc / 1000000), 1)}M</div>
                </div>
              </div>
            </div>

            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "#4b5563" }}>
              <strong style={{ color: "#6b7280" }}>Criterio:</strong> Cuota ≤ 25% del ingreso neto. LTV según banco. Ahorro cubre anticipo + {gastosScrip}% gastos.
            </div>
          </div>

          {/* Tabla bancos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                Comparativa de bancos — {plazo} años
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...calcs.porBanco].sort((a, b) => b.valorPropFinal - a.valorPropFinal).map((b, i) => (
                  <div key={b.banco.id}
                    style={{ background: "#0a0a0a", border: `1px solid ${b.califica ? b.banco.color + "44" : "#1f2937"}`, borderRadius: 8, padding: "12px 14px", opacity: b.califica ? 1 : 0.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {i === 0 && b.califica && <span style={{ fontSize: 10, background: "#22c55e22", color: "#22c55e", padding: "2px 6px", borderRadius: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>MEJOR</span>}
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: b.banco.color }}>{b.banco.nombre}</span>
                        <span style={{ fontSize: 10, color: "#4b5563" }}>TNA {b.banco.tna}% · LTV {b.banco.ltvMax}% · {b.banco.tipo}</span>
                      </div>
                      <span style={{ fontSize: 11, color: b.califica ? "#22c55e" : "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                        {b.califica ? "✓ Calificás" : "✗ No calificás"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
                      {[
                        { label: "Propiedad máx.", value: `USD ${fmt(Math.round(b.valorPropFinal))}`, color: b.banco.color },
                        { label: "Préstamo máx.", value: `USD ${fmt(Math.round(b.capitalMaxUSD))}`, color: "#e5e5e5" },
                        { label: "Anticipo requerido", value: `USD ${fmt(Math.round(b.anticipoRequeridoUSD))}`, color: "#f97316" },
                        { label: "Cuota inicial", value: `ARS ${fmt(Math.round(b.cuotaInicialARS / 1000))}k`, color: "#9ca3af" },
                      ].map(k => (
                        <div key={k.label} style={{ background: "#111", borderRadius: 6, padding: "7px 10px" }}>
                          <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 2 }}>{k.label}</div>
                          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: k.color }}>{k.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "#111", borderRadius: 3, height: 5, overflow: "hidden" }}>
                      <div style={{ width: `${maxValorFinal > 0 ? (b.valorPropFinal / maxValorFinal) * 100 : 0}%`, height: "100%", background: b.califica ? b.banco.color : "#374151", transition: "width 0.3s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plazo rápido */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Impacto del plazo</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[10, 15, 20, 25, 30].map(p => {
                  const tnaMensual = BANCOS[0].tna / 100 / 12;
                  const pm = p * 12;
                  const factor = tnaMensual > 0
                    ? (tnaMensual * Math.pow(1 + tnaMensual, pm)) / (Math.pow(1 + tnaMensual, pm) - 1)
                    : 1 / pm;
                  const capUSD = calcs.ingresoParaCuota > 0 ? calcs.ingresoParaCuota / factor / tc : 0;
                  const valorUSD = capUSD / (BANCOS[0].ltvMax / 100);
                  return (
                    <button key={p} onClick={() => setPlazo(p)}
                      style={{ flex: 1, background: plazo === p ? "#1f2937" : "#0d0d0d", border: `1px solid ${plazo === p ? "#374151" : "#1a1a1a"}`, borderRadius: 8, padding: "10px 6px", cursor: "pointer", textAlign: "center" }}>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 12, color: plazo === p ? "#e5e5e5" : "#6b7280" }}>{p} años</div>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#3b82f6", marginTop: 4 }}>
                        USD {fmt(Math.round(valorUSD))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
