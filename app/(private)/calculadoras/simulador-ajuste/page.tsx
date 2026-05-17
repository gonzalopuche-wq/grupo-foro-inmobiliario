"use client";

import { useState, useMemo } from "react";

// ── Tipos de ajuste disponibles en Argentina ──────────────────────────────────

type TipoAjuste = "icl" | "ipc" | "cer" | "cac" | "fijo" | "uva";

interface AjusteConf {
  tipo: TipoAjuste;
  label: string;
  descripcion: string;
  color: string;
  tasaAnualPct: number; // tasa anual estimada para simulación
}

const AJUSTES: AjusteConf[] = [
  { tipo: "icl", label: "ICL", descripcion: "Índice Contratos de Locación (Ley 27.551) — promedio UVA+IPC", color: "#cc0000", tasaAnualPct: 120 },
  { tipo: "ipc", label: "IPC", descripcion: "Inflación general INDEC", color: "#3b82f6", tasaAnualPct: 100 },
  { tipo: "cer", label: "CER", descripcion: "Coeficiente de Estabilización de Referencia (BCRA)", color: "#8b5cf6", tasaAnualPct: 110 },
  { tipo: "cac", label: "CAC", descripcion: "Cámara Argentina de la Construcción (obras)", color: "#f97316", tasaAnualPct: 130 },
  { tipo: "uva", label: "UVA", descripcion: "Unidad de Valor Adquisitivo (créditos hipotecarios)", color: "#06b6d4", tasaAnualPct: 90 },
  { tipo: "fijo", label: "% Fijo", descripcion: "Porcentaje de ajuste fijo pactado entre partes", color: "#22c55e", tasaAnualPct: 80 },
];

interface Periodo {
  numero: number;
  mesDesde: number; // mes 0 = inicio contrato
  mesesDuracion: number;
  tipoAjuste: TipoAjuste;
  tasaPct: number; // tasa del período
}

interface Config {
  alquilerInicialARS: number;
  duracionMeses: number; // duración total contrato
  periodoAjuste: number; // cada cuántos meses se ajusta
}

function tasaMensual(tasaAnualPct: number): number {
  return Math.pow(1 + tasaAnualPct / 100, 1 / 12) - 1;
}

function factorAcumulado(tasaAnualPct: number, meses: number): number {
  return Math.pow(1 + tasaAnualPct / 100, meses / 12);
}

const fmtARS = (v: number) => "$ " + Math.round(v).toLocaleString("es-AR");
const fmtPct = (v: number) => v.toFixed(1) + "%";

export default function SimuladorAjustePage() {
  const [cfg, setCfg] = useState<Config>({
    alquilerInicialARS: 500000,
    duracionMeses: 24,
    periodoAjuste: 6,
  });

  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoAjuste>("icl");
  const [tasaCustomPct, setTasaCustomPct] = useState(120);
  const [compararTipos, setCompararTipos] = useState<TipoAjuste[]>(["icl", "ipc"]);

  // Proyección para tipo seleccionado
  const proyeccion = useMemo(() => {
    const ajuste = AJUSTES.find((a) => a.tipo === tipoSeleccionado)!;
    const tasaAnual = tipoSeleccionado === "fijo" ? tasaCustomPct : ajuste.tasaAnualPct;
    const periodos: Array<{
      mes: number;
      alquiler: number;
      ajustePct: number;
      acumulado: number;
    }> = [];

    let alquiler = cfg.alquilerInicialARS;

    for (let m = 1; m <= cfg.duracionMeses; m++) {
      const esAjuste = m > 1 && (m - 1) % cfg.periodoAjuste === 0;
      let ajustePct = 0;

      if (esAjuste) {
        const factor = factorAcumulado(tasaAnual, cfg.periodoAjuste);
        ajustePct = (factor - 1) * 100;
        alquiler = alquiler * factor;
      }

      periodos.push({
        mes: m,
        alquiler,
        ajustePct,
        acumulado: ((alquiler / cfg.alquilerInicialARS) - 1) * 100,
      });
    }

    return periodos;
  }, [cfg, tipoSeleccionado, tasaCustomPct]);

  // Comparación multi-índice
  const comparacion = useMemo(() => {
    return compararTipos.map((tipo) => {
      const ajuste = AJUSTES.find((a) => a.tipo === tipo)!;
      const tasaAnual = tipo === "fijo" ? tasaCustomPct : ajuste.tasaAnualPct;

      let alquiler = cfg.alquilerInicialARS;
      const montos: number[] = [];

      for (let m = 1; m <= cfg.duracionMeses; m++) {
        const esAjuste = m > 1 && (m - 1) % cfg.periodoAjuste === 0;
        if (esAjuste) {
          alquiler = alquiler * factorAcumulado(tasaAnual, cfg.periodoAjuste);
        }
        montos.push(alquiler);
      }

      const alquilerFinal = montos[montos.length - 1];
      const totalPagado = montos.reduce((s, v) => s + v, 0);
      const variacion = ((alquilerFinal / cfg.alquilerInicialARS) - 1) * 100;

      return { tipo, ajuste, montos, alquilerFinal, totalPagado, variacion };
    });
  }, [compararTipos, cfg, tasaCustomPct]);

  // SVG chart de comparación
  const svgW = 640;
  const svgH = 200;
  const pad = { top: 16, bottom: 28, left: 60, right: 16 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;

  const allMontos = comparacion.flatMap((c) => c.montos);
  const maxVal = Math.max(...allMontos);
  const minVal = cfg.alquilerInicialARS;

  function xPos(mes: number): number {
    return pad.left + ((mes - 1) / (cfg.duracionMeses - 1)) * chartW;
  }
  function yPos(val: number): number {
    return pad.top + ((maxVal - val) / (maxVal - minVal)) * chartH;
  }

  const inp: React.CSSProperties = {
    background: "#111", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 14, fontFamily: "Inter, sans-serif",
  };

  const ajusteActual = AJUSTES.find((a) => a.tipo === tipoSeleccionado)!;
  const alquilerFinal = proyeccion[proyeccion.length - 1]?.alquiler ?? cfg.alquilerInicialARS;
  const totalPagado = proyeccion.reduce((s, p) => s + p.alquiler, 0);
  const cantAjustes = proyeccion.filter((p) => p.ajustePct > 0).length;

  function toggleComparar(tipo: TipoAjuste) {
    setCompararTipos((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  }

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>
            Simulador de Ajuste de Alquiler
          </h1>
          <p style={{ color: "#999", fontSize: 14, margin: "8px 0 0" }}>
            Proyectá la evolución del alquiler según el índice pactado en el contrato
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
          {/* Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#cc0000", marginBottom: 14, textTransform: "uppercase" }}>
                Contrato
              </div>
              {[
                { label: "Alquiler inicial (ARS/mes)", key: "alquilerInicialARS" as const, step: 10000 },
                { label: "Duración (meses)", key: "duracionMeses" as const, step: 6, min: 6, max: 60 },
                { label: "Ajuste cada (meses)", key: "periodoAjuste" as const, step: 3, min: 3, max: 24 },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{f.label}</div>
                  <input type="number" value={cfg[f.key]} step={f.step} min={f.min ?? 0} max={f.max} onChange={(e) => setCfg((c) => ({ ...c, [f.key]: parseFloat(e.target.value) || 0 }))} style={{ ...inp, width: "100%" }} />
                </div>
              ))}
            </div>

            {/* Tipo de ajuste */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#cc0000", marginBottom: 14, textTransform: "uppercase" }}>
                Índice de ajuste
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {AJUSTES.map((a) => (
                  <button
                    key={a.tipo}
                    onClick={() => setTipoSeleccionado(a.tipo)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: `1px solid ${tipoSeleccionado === a.tipo ? a.color : "#2a2a2a"}`,
                      background: tipoSeleccionado === a.tipo ? `${a.color}18` : "#161616",
                      color: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: tipoSeleccionado === a.tipo ? a.color : "#fff" }}>
                        {a.label}
                      </span>
                      <span style={{ fontSize: 11, color: "#888" }}>~{a.tasaAnualPct}% a/a</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{a.descripcion}</div>
                  </button>
                ))}
              </div>

              {tipoSeleccionado === "fijo" && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                    Porcentaje anual fijo
                  </div>
                  <input type="number" value={tasaCustomPct} step={5} min={0} max={300} onChange={(e) => setTasaCustomPct(parseFloat(e.target.value) || 0)} style={{ ...inp, width: "100%" }} />
                </div>
              )}
            </div>
          </div>

          {/* Resultados */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {[
                { label: "Alquiler inicial", value: fmtARS(cfg.alquilerInicialARS) },
                { label: "Alquiler final", value: fmtARS(Math.round(alquilerFinal)), color: "#cc0000" },
                { label: "Variación total", value: `+${fmtPct((alquilerFinal / cfg.alquilerInicialARS - 1) * 100)}` , color: "#f97316" },
                { label: "Total pagado", value: fmtARS(Math.round(totalPagado)).replace("$ ", "$ "), sub: `${cantAjustes} ajustes` },
              ].map((k) => (
                <div key={k.label} style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "16px 14px" }}>
                  <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: (k as { color?: string }).color ?? "#fff" }}>{k.value}</div>
                  {(k as { sub?: string }).sub && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{(k as { sub?: string }).sub}</div>}
                </div>
              ))}
            </div>

            {/* Tabla de períodos */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: "0 0 16px", color: "#fff" }}>
                Evolución del Alquiler — {ajusteActual.label}
                <span style={{ fontSize: 11, color: "#666", fontWeight: 400, marginLeft: 8 }}>
                  (tasa ~{tipoSeleccionado === "fijo" ? tasaCustomPct : ajusteActual.tasaAnualPct}% anual estimada)
                </span>
              </h3>
              <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead style={{ position: "sticky", top: 0, background: "#111", zIndex: 1 }}>
                    <tr>
                      {["Mes", "Alquiler", "Ajuste", "Variación acum."].map((h) => (
                        <th key={h} style={{ textAlign: "right", padding: "6px 12px", color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid #222" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proyeccion
                      .filter((p) => p.mes === 1 || p.ajustePct > 0 || p.mes === cfg.duracionMeses)
                      .map((p) => (
                        <tr key={p.mes} style={{ borderBottom: "1px solid #1a1a1a", background: p.ajustePct > 0 ? "rgba(204,0,0,0.05)" : "transparent" }}>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>Mes {p.mes}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff" }}>{fmtARS(Math.round(p.alquiler))}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: p.ajustePct > 0 ? "#cc0000" : "#444" }}>
                            {p.ajustePct > 0 ? `+${fmtPct(p.ajustePct)}` : "—"}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#f97316" }}>+{fmtPct(p.acumulado)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comparación multi-índice */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: 0, color: "#fff" }}>
                  Comparación de Índices
                </h3>
                <div style={{ display: "flex", gap: 6 }}>
                  {AJUSTES.map((a) => (
                    <button
                      key={a.tipo}
                      onClick={() => toggleComparar(a.tipo)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 12,
                        border: `1px solid ${compararTipos.includes(a.tipo) ? a.color : "#333"}`,
                        background: compararTipos.includes(a.tipo) ? `${a.color}22` : "transparent",
                        color: compararTipos.includes(a.tipo) ? a.color : "#666",
                        fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, cursor: "pointer",
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SVG Chart */}
              <div style={{ overflowX: "auto" }}>
                <svg width={svgW} height={svgH} style={{ overflow: "visible" }}>
                  {/* Y axis labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                    const val = minVal + f * (maxVal - minVal);
                    const y = pad.top + (1 - f) * chartH;
                    return (
                      <g key={f}>
                        <line x1={pad.left} y1={y} x2={svgW - pad.right} y2={y} stroke="#1a1a1a" strokeWidth={1} />
                        <text x={pad.left - 4} y={y + 4} textAnchor="end" fill="#555" fontSize={8} fontFamily="Montserrat,sans-serif">
                          {Math.round(val / 1000)}k
                        </text>
                      </g>
                    );
                  })}

                  {/* Lines */}
                  {comparacion.map((c) => {
                    if (c.montos.length < 2) return null;
                    const pts = c.montos.map((v, i) => `${xPos(i + 1)},${yPos(v)}`).join(" ");
                    return (
                      <polyline
                        key={c.tipo}
                        points={pts}
                        fill="none"
                        stroke={c.ajuste.color}
                        strokeWidth={2}
                        opacity={0.9}
                      />
                    );
                  })}

                  {/* X axis labels */}
                  {Array.from({ length: Math.min(7, cfg.duracionMeses) }, (_, i) => {
                    const mes = Math.round(1 + (i / 6) * (cfg.duracionMeses - 1));
                    return (
                      <text key={mes} x={xPos(mes)} y={svgH - 4} textAnchor="middle" fill="#555" fontSize={8} fontFamily="Montserrat,sans-serif">
                        M{mes}
                      </text>
                    );
                  })}
                </svg>
              </div>

              {/* Leyenda y tabla final */}
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: `repeat(${Math.min(comparacion.length, 3)}, 1fr)`, gap: 12 }}>
                {comparacion.map((c) => (
                  <div key={c.tipo} style={{ background: "#161616", border: `1px solid ${c.ajuste.color}33`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 20, height: 3, borderRadius: 1, background: c.ajuste.color }} />
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: c.ajuste.color }}>{c.ajuste.label}</span>
                      <span style={{ fontSize: 10, color: "#666" }}>~{c.tipo === "fijo" ? tasaCustomPct : c.ajuste.tasaAnualPct}%/año</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Alquiler final</div>
                    <div style={{ fontSize: 16, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                      {fmtARS(Math.round(c.alquilerFinal))}
                    </div>
                    <div style={{ fontSize: 11, color: c.ajuste.color }}>+{fmtPct(c.variacion)} acumulado</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
