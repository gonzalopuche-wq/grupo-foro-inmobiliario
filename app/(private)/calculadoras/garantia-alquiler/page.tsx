"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface Garantia {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  color: string;
  pros: string[];
  contras: string[];
  calcular: (params: CalcParams) => CalcResult;
}

interface CalcParams {
  alquilerMensual: number;
  plazoMeses: number;
  valorProp: number;
  ingresoInquilino: number;
  tc: number; // ARS/USD
}

interface CalcResult {
  costoInicial: number;
  costoMensual: number;
  costoTotal: number;
  costoUSD: number;
  descripcionCosto: string;
  viabilidad: "alta" | "media" | "baja";
  notaViabilidad: string;
}

const GARANTIAS: Garantia[] = [
  {
    id: "deposito",
    nombre: "Depósito en efectivo",
    descripcion: "El inquilino deposita 1–2 meses de alquiler al inicio del contrato.",
    icono: "💵",
    color: "#22c55e",
    pros: ["Sin costo para el inquilino (se devuelve al finalizar)", "Cobertura inmediata para el propietario", "Simple y sin burocracia"],
    contras: ["Desembolso inicial elevado para el inquilino", "No cubre daños mayores o mora extendida", "Inflación erosiona el valor en contratos largos"],
    calcular: ({ alquilerMensual, plazoMeses, tc }) => {
      const deposito = alquilerMensual * 2; // 2 meses
      const costoOportunidad = deposito * 0.04 * (plazoMeses / 12); // 4% anual costo oportunidad
      return {
        costoInicial: deposito,
        costoMensual: 0,
        costoTotal: costoOportunidad,
        costoUSD: costoOportunidad / tc,
        descripcionCosto: `Depósito ARS ${fmt(deposito)} (2 meses). Costo oportunidad estimado: ARS ${fmt(costoOportunidad)}`,
        viabilidad: "alta",
        notaViabilidad: "Sin barreras adicionales. Requiere liquidez inicial.",
      };
    },
  },
  {
    id: "seguro_caucion",
    nombre: "Seguro de caución",
    descripcion: "Póliza contratada por el inquilino que cubre al propietario ante incumplimiento.",
    icono: "🛡️",
    color: "#3b82f6",
    pros: ["Sin necesidad de garante propietario", "Cobertura hasta 6–12 meses de alquiler", "Proceso rápido y digital"],
    contras: ["Costo mensual para el inquilino (10–15% del alquiler anual)", "Requiere aprobación crediticia", "No cubre todos los siniestros"],
    calcular: ({ alquilerMensual, plazoMeses }) => {
      const primaPct = 0.12; // 12% del alquiler anual
      const primaTotal = alquilerMensual * 12 * primaPct;
      const costoPorContrato = primaTotal * (plazoMeses / 12);
      return {
        costoInicial: primaTotal,
        costoMensual: primaTotal / 12,
        costoTotal: costoPorContrato,
        costoUSD: 0,
        descripcionCosto: `Prima: ${(primaPct*100).toFixed(0)}% del alquiler anual = ARS ${fmt(primaTotal)}/año`,
        viabilidad: "alta",
        notaViabilidad: "Ampliamente aceptado. Requiere ingresos demostrables.",
      };
    },
  },
  {
    id: "garante_propietario",
    nombre: "Garante propietario",
    descripcion: "Tercero con inmueble propio avala el contrato. El propietario puede ejecutar si hay incumplimiento.",
    icono: "🏠",
    color: "#a855f7",
    pros: ["Sin costo directo para el inquilino", "Alta aceptación por propietarios", "Cubre deudas e impago"],
    contras: ["Difícil conseguir en muchos casos", "Proceso judicial lento si hay incumplimiento", "Relación personal comprometida"],
    calcular: ({ alquilerMensual, plazoMeses, valorProp, tc }) => {
      const honorariosGarantia = alquilerMensual * 1.5; // escribano + verificación
      return {
        costoInicial: honorariosGarantia,
        costoMensual: 0,
        costoTotal: honorariosGarantia,
        costoUSD: honorariosGarantia / tc,
        descripcionCosto: `Gastos de verificación y escrituración: ARS ${fmt(honorariosGarantia)} aprox.`,
        viabilidad: valorProp > 0 ? "alta" : "media",
        notaViabilidad: "Muy aceptada pero cada vez más difícil de conseguir.",
      };
    },
  },
  {
    id: "fianza_solidaria",
    nombre: "Fianza solidaria",
    descripcion: "Dos o más garantes sin bien inmueble, con recibos de sueldo suficientes.",
    icono: "🤝",
    color: "#f97316",
    pros: ["Accesible si hay sueldo en blanco", "Más fácil que el garante propietario", "Sin costo de póliza"],
    contras: ["Varios propietarios no la aceptan", "Difícil de ejecutar judicialmente", "Requiere 2–3 garantes con buen ingreso"],
    calcular: ({ alquilerMensual, ingresoInquilino }) => {
      const ratioIngreso = ingresoInquilino > 0 ? alquilerMensual / ingresoInquilino : 0;
      const viabilidad: "alta" | "media" | "baja" = ratioIngreso <= 0.3 ? "alta" : ratioIngreso <= 0.45 ? "media" : "baja";
      return {
        costoInicial: 0,
        costoMensual: 0,
        costoTotal: 0,
        costoUSD: 0,
        descripcionCosto: `Ratio alquiler/ingreso: ${(ratioIngreso * 100).toFixed(0)}%. ${ratioIngreso <= 0.3 ? "✅ Aceptable" : ratioIngreso <= 0.45 ? "⚠️ Justo" : "❌ Elevado"}`,
        viabilidad,
        notaViabilidad: ratioIngreso <= 0.3 ? "Buen ratio ingreso/alquiler." : "Ratio alto, algunos propietarios pueden rechazarlo.",
      };
    },
  },
  {
    id: "garantia_bancaria",
    nombre: "Garantía bancaria",
    descripcion: "El banco emite una carta de garantía respaldada por depósito o línea de crédito del inquilino.",
    icono: "🏦",
    color: "#eab308",
    pros: ["Alta confiabilidad para el propietario", "Cobertura garantizada por institución financiera", "Ejecución rápida en caso de incumplimiento"],
    contras: ["Costo anual del 2–4% del monto garantizado", "Requiere cuenta bancaria y historial crediticio", "Proceso burocrático y demorado"],
    calcular: ({ alquilerMensual, plazoMeses }) => {
      const montoGarantizado = alquilerMensual * 6;
      const costoPct = 0.03;
      const costoAnual = montoGarantizado * costoPct;
      const costoTotal = costoAnual * (plazoMeses / 12);
      return {
        costoInicial: costoAnual / 2,
        costoMensual: costoAnual / 12,
        costoTotal,
        costoUSD: 0,
        descripcionCosto: `Monto garantizado: ARS ${fmt(montoGarantizado)}. Costo: ${(costoPct*100)}%/año = ARS ${fmt(costoAnual)}/año`,
        viabilidad: "media",
        notaViabilidad: "Muy segura para el propietario. Requiere gestión bancaria.",
      };
    },
  },
  {
    id: "cobertura_alquiler",
    nombre: "Cobertura de impago (nueva modalidad)",
    descripcion: "Fintech/aseguradoras cubren el impago al propietario y gestionan el desalojo. El inquilino solo necesita ingresos.",
    icono: "📱",
    color: "#06b6d4",
    pros: ["Sin garante ni depósito para el inquilino", "Propietario cobra aunque haya mora", "Gestión de desalojo incluida"],
    contras: ["Costo más alto (12–20% del alquiler anual)", "Solo disponible en grandes ciudades", "Requiere aprobación de la aseguradora"],
    calcular: ({ alquilerMensual, plazoMeses }) => {
      const primaPct = 0.15;
      const primaAnual = alquilerMensual * 12 * primaPct;
      const costoTotal = primaAnual * (plazoMeses / 12);
      return {
        costoInicial: primaAnual / 2,
        costoMensual: primaAnual / 12,
        costoTotal,
        costoUSD: 0,
        descripcionCosto: `Prima: ${(primaPct*100).toFixed(0)}% del alquiler anual = ARS ${fmt(primaAnual)}/año`,
        viabilidad: "alta",
        notaViabilidad: "Sin barreras tradicionales. Más cara pero muy conveniente.",
      };
    },
  },
];

export default function GarantiaAlquilerPage() {
  const [alqMensual, setAlqMensual] = useState(300000);
  const [plazoMeses, setPlazoMeses] = useState(24);
  const [valorProp, setValorProp] = useState(0);
  const [ingresoInq, setIngresoInq] = useState(900000);
  const [tc, setTc] = useState(1300);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  const params: CalcParams = { alquilerMensual: alqMensual, plazoMeses, valorProp, ingresoInquilino: ingresoInq, tc };

  const resultados = useMemo(() => {
    return GARANTIAS.map(g => ({ ...g, resultado: g.calcular(params) }))
      .sort((a, b) => {
        const ord = { alta: 0, media: 1, baja: 2 };
        return ord[a.resultado.viabilidad] - ord[b.resultado.viabilidad];
      });
  }, [alqMensual, plazoMeses, valorProp, ingresoInq, tc]);

  const selData = seleccionada ? resultados.find(r => r.id === seleccionada) : null;
  const ratioAlqIng = ingresoInq > 0 ? (alqMensual / ingresoInq) * 100 : 0;

  const viabilidadColor = (v: string) => v === "alta" ? "#22c55e" : v === "media" ? "#f97316" : "#cc0000";
  const viabilidadLabel = (v: string) => v === "alta" ? "Alta viabilidad" : v === "media" ? "Viabilidad media" : "Baja viabilidad";

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>🔐 Comparador de Garantías</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Comparativa de opciones de garantía para contratos de alquiler</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          {/* Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Datos del alquiler</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Alquiler mensual (ARS)", value: alqMensual, set: setAlqMensual, step: 10000 },
                  { label: "Plazo del contrato (meses)", value: plazoMeses, set: setPlazoMeses, step: 6 },
                  { label: "Valor de la propiedad (ARS)", value: valorProp, set: setValorProp, step: 5000000 },
                  { label: "Ingreso mensual inquilino (ARS)", value: ingresoInq, set: setIngresoInq, step: 50000 },
                  { label: "TC ARS/USD", value: tc, set: setTc, step: 50 },
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

            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Indicadores clave</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Ratio alquiler/ingreso</span>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: ratioAlqIng <= 30 ? "#22c55e" : ratioAlqIng <= 45 ? "#f97316" : "#cc0000" }}>
                    {ratioAlqIng.toFixed(0)}% {ratioAlqIng <= 30 ? "✅" : ratioAlqIng <= 45 ? "⚠️" : "❌"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Ingreso recomendado</span>
                  <span style={{ color: "#9ca3af" }}>ARS {fmt(alqMensual / 0.3)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Alquiler en USD</span>
                  <span style={{ color: "#9ca3af" }}>USD {fmt(alqMensual / tc)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Total contrato</span>
                  <span style={{ color: "#9ca3af" }}>ARS {fmt(alqMensual * plazoMeses)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cards de garantías */}
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: selData ? 16 : 0 }}>
              {resultados.map(g => {
                const r = g.resultado;
                const isSelected = seleccionada === g.id;
                return (
                  <div key={g.id}
                    onClick={() => setSeleccionada(isSelected ? null : g.id)}
                    style={{ background: isSelected ? "#1a1a1a" : "#111", border: `1px solid ${isSelected ? g.color + "66" : "#1f2937"}`, borderRadius: 12, padding: 16, cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 22 }}>{g.icono}</span>
                        <div>
                          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#fff" }}>{g.nombre}</div>
                          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>{g.descripcion.slice(0, 55)}...</div>
                        </div>
                      </div>
                      <span style={{ background: `${viabilidadColor(r.viabilidad)}22`, color: viabilidadColor(r.viabilidad), padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: "Montserrat, sans-serif", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {r.viabilidad === "alta" ? "✅" : r.viabilidad === "media" ? "⚡" : "❌"} {viabilidadLabel(r.viabilidad)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>{r.descripcionCosto}</div>
                    {r.costoTotal > 0 && (
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ background: "#0a0a0a", borderRadius: 6, padding: "6px 10px", flex: 1 }}>
                          <div style={{ fontSize: 9, color: "#4b5563" }}>Costo total estimado</div>
                          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#cc0000" }}>ARS {fmt(r.costoTotal)}</div>
                        </div>
                        {r.costoMensual > 0 && (
                          <div style={{ background: "#0a0a0a", borderRadius: 6, padding: "6px 10px", flex: 1 }}>
                            <div style={{ fontSize: 9, color: "#4b5563" }}>Costo mensual</div>
                            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#f97316" }}>ARS {fmt(r.costoMensual)}</div>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: viabilidadColor(r.viabilidad), marginTop: 8 }}>{r.notaViabilidad}</div>
                  </div>
                );
              })}
            </div>

            {/* Detalle de garantía seleccionada */}
            {selData && (
              <div style={{ background: "#111", border: `1px solid ${selData.color}44`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#fff", marginBottom: 16 }}>
                  {selData.icono} {selData.nombre} — Detalle
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#22c55e", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>✅ Ventajas</div>
                    {selData.pros.map(p => (
                      <div key={p} style={{ fontSize: 12, color: "#9ca3af", marginBottom: 5, paddingLeft: 12, borderLeft: "2px solid #22c55e33" }}>{p}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#cc0000", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>❌ Desventajas</div>
                    {selData.contras.map(c => (
                      <div key={c} style={{ fontSize: 12, color: "#9ca3af", marginBottom: 5, paddingLeft: 12, borderLeft: "2px solid #cc000033" }}>{c}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", marginTop: 20, fontSize: 12, color: "#6b7280" }}>
          <strong style={{ color: "#9ca3af" }}>📌 Nota:</strong> Los costos son estimaciones basadas en valores de mercado promedio. Las condiciones específicas pueden variar según el banco, aseguradora o escribano.
        </div>
      </div>
    </div>
  );
}
