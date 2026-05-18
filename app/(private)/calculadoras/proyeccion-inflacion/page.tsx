"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TabId = "propiedad" | "alquileres" | "poder-adquisitivo";
type TipoAjuste = "icl" | "ipc" | "libre";
type FrecuenciaAjuste = "cuatrimestral" | "semestral" | "anual";

interface PropiedadInputs {
  precioUSD: number;
  tcActual: number;
  inflacionARS: number;
  inflacionUSD: number;
  horizonte: number;
  revalorizacion: number;
}

interface AlquilerInputs {
  alquilerARS: number;
  tipoAjuste: TipoAjuste;
  inflacionLibre: number;
  plazoMeses: number;
  frecuencia: FrecuenciaAjuste;
}

interface PoderAdquisitivoInputs {
  salarioARS: number;
  precioObjetivoUSD: number;
  inflacionSalarial: number;
  inflacionIPC: number;
  horizonte: number;
}

interface PropiedadRow {
  anio: number;
  precioUSD: number;
  precioARS: number;
  ipcAcumulado: number;
  poderAdquisitivoReal: number;
}

interface AlquilerPeriodo {
  periodo: number;
  mesDesde: number;
  alquiler: number;
  variacionPct: number;
  acumuladoPct: number;
}

interface PoderAdquisitivoRow {
  anio: number;
  salarioMensualARS: number;
  precioUSD: number;
  precioARS: number;
  mesesEquivalentes: number;
  pti: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtARS = (v: number): string =>
  "$ " + Math.round(v).toLocaleString("es-AR");

const fmtUSD = (v: number): string =>
  "USD " + v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v: number, dec = 1): string => v.toFixed(dec) + "%";

const fmtNum = (v: number): string => Math.round(v).toLocaleString("es-AR");

function tasaAnualToFactor(pct: number, anios: number): number {
  return Math.pow(1 + pct / 100, anios);
}

function frecuenciaMeses(f: FrecuenciaAjuste): number {
  if (f === "cuatrimestral") return 4;
  if (f === "semestral") return 6;
  return 12;
}

function tasaAjustePorTipo(tipo: TipoAjuste, libre: number): number {
  if (tipo === "icl") return 120;
  if (tipo === "ipc") return 85;
  return libre;
}

// ── Estilos comunes ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#e0e0e0",
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "Inter, sans-serif",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
  display: "block",
};

const cardStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #222222",
  borderRadius: 10,
  padding: "16px 20px",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 12,
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 800,
  color: "#e0e0e0",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

// ── Sub-componente: Tab Propiedad ─────────────────────────────────────────────

function TabPropiedad() {
  const [inputs, setInputs] = useState<PropiedadInputs>({
    precioUSD: 100000,
    tcActual: 1150,
    inflacionARS: 85,
    inflacionUSD: 3,
    horizonte: 10,
    revalorizacion: 2,
  });

  const set = (k: keyof PropiedadInputs, v: number) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const rows = useMemo<PropiedadRow[]>(() => {
    const result: PropiedadRow[] = [];
    for (let a = 1; a <= 10; a++) {
      const precioUSD =
        inputs.precioUSD * tasaAnualToFactor(inputs.revalorizacion, a);
      const tcProyectado =
        inputs.tcActual *
        (tasaAnualToFactor(inputs.inflacionARS, a) /
          tasaAnualToFactor(inputs.inflacionUSD, a));
      const precioARS = precioUSD * tcProyectado;
      const ipcAcumulado =
        (tasaAnualToFactor(inputs.inflacionARS, a) - 1) * 100;
      const poderAdquisitivoReal =
        (inputs.precioUSD / tasaAnualToFactor(inputs.inflacionUSD, a)) *
        100 /
        inputs.precioUSD;
      result.push({ anio: a, precioUSD, precioARS, ipcAcumulado, poderAdquisitivoReal });
    }
    return result;
  }, [inputs]);

  // Datos para gráfico
  const svgW = 720;
  const svgH = 280;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  // Puntos: año 0 incluido
  const allYears = [0, ...rows.map((r) => r.anio)];

  // Precio USD (línea roja) — incluye revalorización real
  const usdValues = [
    inputs.precioUSD,
    ...rows.map((r) => r.precioUSD),
  ];

  // Precio ARS / TC proyectado (línea naranja) — precio real en USD
  const arsEnUsdValues = [
    inputs.precioUSD,
    ...rows.map((r) => {
      const tcProyectado =
        inputs.tcActual *
        (tasaAnualToFactor(inputs.inflacionARS, r.anio) /
          tasaAnualToFactor(inputs.inflacionUSD, r.anio));
      return r.precioARS / tcProyectado;
    }),
  ];

  // Solo inflación USD (línea gris punteada)
  const soloInflacionUsdValues = [
    inputs.precioUSD,
    ...rows.map((r) => inputs.precioUSD * tasaAnualToFactor(inputs.inflacionUSD, r.anio)),
  ];

  const maxVal = Math.max(...usdValues, ...arsEnUsdValues, ...soloInflacionUsdValues);
  const minVal = 0;

  function toX(year: number): number {
    return padL + (year / 10) * chartW;
  }
  function toY(val: number): number {
    return padT + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
  }
  function makePath(vals: number[]): string {
    return vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${toX(allYears[i]).toFixed(1)},${toY(v).toFixed(1)}`)
      .join(" ");
  }

  const row5 = rows[4];
  const row10 = rows[9];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Inputs */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          <div>
            <label style={labelStyle}>Precio actual (USD)</label>
            <input
              type="number"
              value={inputs.precioUSD}
              onChange={(e) => set("precioUSD", +e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>TC USD/ARS actual</label>
            <input
              type="number"
              value={inputs.tcActual}
              onChange={(e) => set("tcActual", +e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Inflación ARS anual (%)</label>
            <input
              type="number"
              step={0.5}
              value={inputs.inflacionARS}
              onChange={(e) => set("inflacionARS", +e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Inflación USD anual (%)</label>
            <input
              type="number"
              step={0.1}
              value={inputs.inflacionUSD}
              onChange={(e) => set("inflacionUSD", +e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Revalorización real (%/año USD)</label>
            <input
              type="number"
              step={0.5}
              value={inputs.revalorizacion}
              onChange={(e) => set("revalorizacion", +e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Cards resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {[
          {
            label: "Precio en 5 años",
            val1: row5 ? fmtUSD(row5.precioUSD) : "—",
            val2: row5 ? fmtARS(row5.precioARS) : "—",
            color: "#cc0000",
          },
          {
            label: "Precio en 10 años",
            val1: row10 ? fmtUSD(row10.precioUSD) : "—",
            val2: row10 ? fmtARS(row10.precioARS) : "—",
            color: "#cc0000",
          },
          {
            label: "Inflación ARS acumulada (10a)",
            val1: row10 ? fmtPct(row10.ipcAcumulado, 0) : "—",
            val2: "",
            color: "#f97316",
          },
          {
            label: "Revalorización real (10a)",
            val1:
              row10
                ? fmtPct((tasaAnualToFactor(inputs.revalorizacion, 10) - 1) * 100, 1)
                : "—",
            val2: "",
            color: "#22c55e",
          },
        ].map((c) => (
          <div key={c.label} style={{ ...cardStyle, borderLeft: `3px solid ${c.color}` }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 8, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
              {c.label}
            </div>
            <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: c.color }}>
              {c.val1}
            </div>
            {c.val2 && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{c.val2}</div>}
          </div>
        ))}
      </div>

      {/* Gráfico SVG */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Evolución del precio (USD)</h2>
        <div style={{ overflowX: "auto" }}>
          <svg
            width={svgW}
            height={svgH}
            style={{ display: "block", maxWidth: "100%" }}
            viewBox={`0 0 ${svgW} ${svgH}`}
          >
            {/* Fondo */}
            <rect x={padL} y={padT} width={chartW} height={chartH} fill="#0d0d0d" rx={4} />
            {/* Grillas horizontales */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = padT + f * chartH;
              const val = maxVal * (1 - f);
              return (
                <g key={f}>
                  <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#1a1a1a" strokeWidth={1} />
                  <text x={padL - 6} y={y + 4} fill="#555" fontSize={10} textAnchor="end">
                    {(val / 1000).toFixed(0)}k
                  </text>
                </g>
              );
            })}
            {/* Grillas verticales y etiquetas año */}
            {allYears.map((y) => {
              const x = toX(y);
              return (
                <g key={y}>
                  <line x1={x} y1={padT} x2={x} y2={padT + chartH} stroke="#1a1a1a" strokeWidth={1} />
                  <text x={x} y={padT + chartH + 16} fill="#555" fontSize={10} textAnchor="middle">
                    {y}
                  </text>
                </g>
              );
            })}
            {/* Línea gris punteada: solo inflación USD */}
            <path
              d={makePath(soloInflacionUsdValues)}
              fill="none"
              stroke="#555"
              strokeWidth={1.5}
              strokeDasharray="6,4"
            />
            {/* Línea naranja: ARS / TC en USD reales */}
            <path
              d={makePath(arsEnUsdValues)}
              fill="none"
              stroke="#f97316"
              strokeWidth={2}
            />
            {/* Línea roja: precio USD con revalorización */}
            <path
              d={makePath(usdValues)}
              fill="none"
              stroke="#cc0000"
              strokeWidth={2.5}
            />
            {/* Eje X label */}
            <text x={padL + chartW / 2} y={svgH - 4} fill="#555" fontSize={10} textAnchor="middle">
              Años
            </text>
            {/* Eje Y label */}
            <text
              x={10}
              y={padT + chartH / 2}
              fill="#555"
              fontSize={10}
              textAnchor="middle"
              transform={`rotate(-90, 10, ${padT + chartH / 2})`}
            >
              USD
            </text>
          </svg>
        </div>
        {/* Leyenda */}
        <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
          {[
            { color: "#cc0000", label: "Precio USD (con revalorización real)", dash: false },
            { color: "#f97316", label: "Precio ARS / TC proyectado (USD reales)", dash: false },
            { color: "#555", label: "Solo inflación USD", dash: true },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width={24} height={12}>
                <line
                  x1={0}
                  y1={6}
                  x2={24}
                  y2={6}
                  stroke={l.color}
                  strokeWidth={2}
                  strokeDasharray={l.dash ? "5,3" : undefined}
                />
              </svg>
              <span style={{ fontSize: 11, color: "#888" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla año a año */}
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #222222" }}>
          <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Tabla año a año</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead style={{ background: "#0d0d0d" }}>
              <tr>
                {["Año", "Precio USD", "Precio ARS", "IPC acumulado", "Poder adquisitivo real"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        textAlign: "right",
                        fontSize: 11,
                        color: "#666",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.anio}
                  style={{
                    borderBottom: "1px solid #0d0d0d",
                    background: i % 2 === 0 ? "#0d0d0d" : "transparent",
                  }}
                >
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#666" }}>
                    {r.anio}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#cc0000", fontWeight: 600 }}>
                    {fmtUSD(r.precioUSD)}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#e0e0e0" }}>
                    {fmtARS(r.precioARS)}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#f97316" }}>
                    {fmtPct(r.ipcAcumulado, 0)}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: r.poderAdquisitivoReal >= 100 ? "#22c55e" : "#ef4444" }}>
                    {fmtPct(r.poderAdquisitivoReal, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componente: Tab Alquileres ────────────────────────────────────────────

function TabAlquileres() {
  const [inputs, setInputs] = useState<AlquilerInputs>({
    alquilerARS: 500000,
    tipoAjuste: "icl",
    inflacionLibre: 85,
    plazoMeses: 24,
    frecuencia: "semestral",
  });
  const [tcActual, setTcActual] = useState(1150);
  const [inflacionTC, setInflacionTC] = useState(80);

  const set = <K extends keyof AlquilerInputs>(k: K, v: AlquilerInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const intervaloMeses = useMemo(
    () => frecuenciaMeses(inputs.frecuencia),
    [inputs.frecuencia]
  );

  const tasaAnual = useMemo(
    () => tasaAjustePorTipo(inputs.tipoAjuste, inputs.inflacionLibre),
    [inputs.tipoAjuste, inputs.inflacionLibre]
  );

  const periodos = useMemo<AlquilerPeriodo[]>(() => {
    const result: AlquilerPeriodo[] = [];
    let alquiler = inputs.alquilerARS;
    const cantPeriodos = Math.ceil(inputs.plazoMeses / intervaloMeses);
    for (let p = 1; p <= cantPeriodos; p++) {
      const mesDesde = (p - 1) * intervaloMeses + 1;
      if (mesDesde > inputs.plazoMeses) break;
      const variacionPct =
        p === 1 ? 0 : (Math.pow(1 + tasaAnual / 100, intervaloMeses / 12) - 1) * 100;
      if (p > 1) {
        alquiler = alquiler * (1 + variacionPct / 100);
      }
      const acumuladoPct =
        ((alquiler / inputs.alquilerARS) - 1) * 100;
      result.push({ periodo: p, mesDesde, alquiler, variacionPct, acumuladoPct });
    }
    return result;
  }, [inputs.alquilerARS, inputs.plazoMeses, intervaloMeses, tasaAnual]);

  // Total pagado
  const totalPagado = useMemo(() => {
    let total = 0;
    for (let p = 0; p < periodos.length; p++) {
      const desde = periodos[p].mesDesde;
      const hasta =
        p + 1 < periodos.length
          ? Math.min(periodos[p + 1].mesDesde - 1, inputs.plazoMeses)
          : inputs.plazoMeses;
      const mesesEnPeriodo = hasta - desde + 1;
      total += periodos[p].alquiler * mesesEnPeriodo;
    }
    return total;
  }, [periodos, inputs.plazoMeses]);

  // Equivalente en USD al TC proyectado al final del contrato
  const tcFinal = useMemo(
    () => tcActual * tasaAnualToFactor(inflacionTC, inputs.plazoMeses / 12),
    [tcActual, inflacionTC, inputs.plazoMeses]
  );
  const totalUSD = totalPagado / tcFinal;

  // Comparativa IPC vs ICL
  const tasaIPC = tasaAjustePorTipo("ipc", 85);
  const tasaICL = tasaAjustePorTipo("icl", 0);
  const totalIPC = useMemo(() => {
    let total = 0;
    let alq = inputs.alquilerARS;
    const cant = Math.ceil(inputs.plazoMeses / intervaloMeses);
    for (let p = 1; p <= cant; p++) {
      const desde = (p - 1) * intervaloMeses + 1;
      if (desde > inputs.plazoMeses) break;
      const hasta =
        p < cant
          ? Math.min(p * intervaloMeses, inputs.plazoMeses)
          : inputs.plazoMeses;
      if (p > 1) {
        alq = alq * Math.pow(1 + tasaIPC / 100, intervaloMeses / 12);
      }
      total += alq * (hasta - desde + 1);
    }
    return total;
  }, [inputs.alquilerARS, inputs.plazoMeses, intervaloMeses, tasaIPC]);

  const totalICL = useMemo(() => {
    let total = 0;
    let alq = inputs.alquilerARS;
    const cant = Math.ceil(inputs.plazoMeses / intervaloMeses);
    for (let p = 1; p <= cant; p++) {
      const desde = (p - 1) * intervaloMeses + 1;
      if (desde > inputs.plazoMeses) break;
      const hasta =
        p < cant
          ? Math.min(p * intervaloMeses, inputs.plazoMeses)
          : inputs.plazoMeses;
      if (p > 1) {
        alq = alq * Math.pow(1 + tasaICL / 100, intervaloMeses / 12);
      }
      total += alq * (hasta - desde + 1);
    }
    return total;
  }, [inputs.alquilerARS, inputs.plazoMeses, intervaloMeses, tasaICL]);

  // Gráfico de escalera
  const svgW = 720;
  const svgH = 260;
  const padL = 70;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const maxAlq = periodos.length > 0 ? Math.max(...periodos.map((p) => p.alquiler)) : inputs.alquilerARS;

  function toX(mes: number): number {
    return padL + ((mes - 1) / (inputs.plazoMeses - 1)) * chartW;
  }
  function toY(val: number): number {
    return padT + chartH - (val / maxAlq) * chartH;
  }

  // Step chart path
  const stepPath = useMemo(() => {
    if (periodos.length === 0) return "";
    let d = "";
    for (let p = 0; p < periodos.length; p++) {
      const desde = periodos[p].mesDesde;
      const hasta =
        p + 1 < periodos.length
          ? periodos[p + 1].mesDesde - 1
          : inputs.plazoMeses;
      const alq = periodos[p].alquiler;
      const x1 = toX(desde);
      const x2 = toX(hasta);
      const y = toY(alq);
      if (p === 0) {
        d += `M${x1.toFixed(1)},${y.toFixed(1)}`;
      } else {
        d += `L${x1.toFixed(1)},${y.toFixed(1)}`;
      }
      d += `L${x2.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  }, [periodos, inputs.plazoMeses]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = toX; // used in stepPath closure

  const AJUSTE_LABELS: Record<TipoAjuste, string> = {
    icl: "ICL (Índice Casa Propia)",
    ipc: "IPC (INDEC)",
    libre: "Inflación libre (custom)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Inputs */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          <div>
            <label style={labelStyle}>Alquiler mensual actual (ARS)</label>
            <input
              type="number"
              value={inputs.alquilerARS}
              onChange={(e) => set("alquilerARS", +e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Tipo de ajuste</label>
            <select
              value={inputs.tipoAjuste}
              onChange={(e) => set("tipoAjuste", e.target.value as TipoAjuste)}
              style={inputStyle}
            >
              {(["icl", "ipc", "libre"] as TipoAjuste[]).map((t) => (
                <option key={t} value={t}>
                  {AJUSTE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {inputs.tipoAjuste === "libre" && (
            <div>
              <label style={labelStyle}>Inflación anual custom (%)</label>
              <input
                type="number"
                step={0.5}
                value={inputs.inflacionLibre}
                onChange={(e) => set("inflacionLibre", +e.target.value)}
                style={inputStyle}
              />
            </div>
          )}
          <div>
            <label style={labelStyle}>Plazo del contrato</label>
            <select
              value={inputs.plazoMeses}
              onChange={(e) => set("plazoMeses", +e.target.value)}
              style={inputStyle}
            >
              <option value={24}>24 meses</option>
              <option value={36}>36 meses</option>
              <option value={48}>48 meses</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Frecuencia de ajuste</label>
            <select
              value={inputs.frecuencia}
              onChange={(e) => set("frecuencia", e.target.value as FrecuenciaAjuste)}
              style={inputStyle}
            >
              <option value="cuatrimestral">Cuatrimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>TC USD/ARS actual</label>
            <input
              type="number"
              value={tcActual}
              onChange={(e) => setTcActual(+e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Inflación TC anual (%)</label>
            <input
              type="number"
              step={0.5}
              value={inflacionTC}
              onChange={(e) => setInflacionTC(+e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Cards resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        <div style={{ ...cardStyle, borderLeft: "3px solid #cc0000" }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
            Total pagado (contrato)
          </div>
          <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000" }}>
            {fmtARS(totalPagado)}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            ≈ {fmtUSD(totalUSD)} (TC proyectado)
          </div>
        </div>
        <div style={{ ...cardStyle, borderLeft: "3px solid #f97316" }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
            Alquiler final del período
          </div>
          <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#f97316" }}>
            {periodos.length > 0 ? fmtARS(periodos[periodos.length - 1].alquiler) : "—"}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            vs. {fmtARS(inputs.alquilerARS)} inicial
          </div>
        </div>
        <div style={{ ...cardStyle, borderLeft: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
            Comparativa IPC total
          </div>
          <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#3b82f6" }}>
            {fmtARS(totalIPC)}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            ICL: {fmtARS(totalICL)}
          </div>
        </div>
      </div>

      {/* Gráfico escalera */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Evolución del alquiler (escalera de ajuste)</h2>
        <div style={{ overflowX: "auto" }}>
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: "block", maxWidth: "100%" }}
          >
            <rect x={padL} y={padT} width={chartW} height={chartH} fill="#0d0d0d" rx={4} />
            {/* Grillas */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = padT + f * chartH;
              const val = maxAlq * (1 - f);
              return (
                <g key={f}>
                  <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#1a1a1a" strokeWidth={1} />
                  <text x={padL - 6} y={y + 4} fill="#555" fontSize={10} textAnchor="end">
                    {(val / 1000).toFixed(0)}k
                  </text>
                </g>
              );
            })}
            {/* Marcas período */}
            {periodos.map((p) => (
              <line
                key={p.periodo}
                x1={toX(p.mesDesde)}
                y1={padT}
                x2={toX(p.mesDesde)}
                y2={padT + chartH}
                stroke="#1a1a1a"
                strokeWidth={1}
              />
            ))}
            {/* Step path */}
            {stepPath && (
              <path d={stepPath} fill="none" stroke="#cc0000" strokeWidth={2.5} />
            )}
            {/* Área bajo la curva */}
            {stepPath && periodos.length > 0 && (
              <path
                d={`${stepPath} L${(padL + chartW).toFixed(1)},${(padT + chartH).toFixed(1)} L${padL.toFixed(1)},${(padT + chartH).toFixed(1)} Z`}
                fill="#cc000015"
              />
            )}
            {/* Eje X meses */}
            {periodos.map((p) => (
              <text
                key={p.periodo}
                x={toX(p.mesDesde)}
                y={padT + chartH + 16}
                fill="#555"
                fontSize={9}
                textAnchor="middle"
              >
                M{p.mesDesde}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Tabla períodos */}
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #222222" }}>
          <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Tabla por período de ajuste</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
            <thead style={{ background: "#0d0d0d" }}>
              <tr>
                {["Período", "Mes inicio", "Alquiler", "Variación", "Acumulado"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "right",
                      fontSize: 11,
                      color: "#666",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodos.map((p, i) => (
                <tr
                  key={p.periodo}
                  style={{
                    borderBottom: "1px solid #0d0d0d",
                    background: i % 2 === 0 ? "#0d0d0d" : "transparent",
                  }}
                >
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#666" }}>
                    {p.periodo}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#888" }}>
                    Mes {p.mesDesde}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#cc0000", fontWeight: 600 }}>
                    {fmtARS(p.alquiler)}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: p.variacionPct > 0 ? "#f97316" : "#888" }}>
                    {p.variacionPct > 0 ? `+${fmtPct(p.variacionPct)}` : "—"}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#f97316" }}>
                    {p.acumuladoPct > 0 ? `+${fmtPct(p.acumuladoPct, 0)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componente: Tab Poder Adquisitivo ─────────────────────────────────────

function TabPoderAdquisitivo() {
  const [inputs, setInputs] = useState<PoderAdquisitivoInputs>({
    salarioARS: 800000,
    precioObjetivoUSD: 80000,
    inflacionSalarial: 70,
    inflacionIPC: 85,
    horizonte: 10,
  });
  const [tcActual, setTcActual] = useState(1150);
  const [tasaHipoteca, setTasaHipoteca] = useState(8);
  const [plazoHipotecaAnios, setPlazoHipotecaAnios] = useState(20);

  const set = (k: keyof PoderAdquisitivoInputs, v: number) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const rows = useMemo<PoderAdquisitivoRow[]>(() => {
    const result: PoderAdquisitivoRow[] = [];
    for (let a = 0; a <= 10; a++) {
      const salarioMensualARS =
        inputs.salarioARS * tasaAnualToFactor(inputs.inflacionSalarial, a);
      const tcProyectado =
        tcActual *
        (tasaAnualToFactor(inputs.inflacionIPC, a) /
          tasaAnualToFactor(3, a)); // 3% inflación USD de referencia
      const precioUSD =
        inputs.precioObjetivoUSD; // precio en USD constante (sin revalorización para este análisis)
      const precioARS = precioUSD * tcProyectado;
      const mesesEquivalentes = precioARS / salarioMensualARS;

      // PTI teórico: cuota hipotecaria / salario mensual
      // Cuota francesa: C = P * r*(1+r)^n / ((1+r)^n - 1)
      const r = tasaHipoteca / 100 / 12;
      const n = plazoHipotecaAnios * 12;
      const cuotaHipotecaARS =
        r === 0
          ? precioARS / n
          : precioARS * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      const pti = (cuotaHipotecaARS / salarioMensualARS) * 100;

      result.push({
        anio: a,
        salarioMensualARS,
        precioUSD,
        precioARS,
        mesesEquivalentes,
        pti,
      });
    }
    return result;
  }, [inputs, tcActual, tasaHipoteca, plazoHipotecaAnios]);

  // Gráfico doble eje
  const svgW = 720;
  const svgH = 260;
  const padL = 65;
  const padR = 55;
  const padT = 20;
  const padB = 40;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const maxMeses = Math.max(...rows.map((r) => r.mesesEquivalentes));
  const maxPTI = Math.max(...rows.map((r) => r.pti), 50);

  function toX(anio: number): number {
    return padL + (anio / 10) * chartW;
  }
  function toYMeses(val: number): number {
    return padT + chartH - (val / maxMeses) * chartH;
  }
  function toYPTI(val: number): number {
    return padT + chartH - (val / maxPTI) * chartH;
  }

  const pathMeses = rows
    .map((r, i) => `${i === 0 ? "M" : "L"}${toX(r.anio).toFixed(1)},${toYMeses(r.mesesEquivalentes).toFixed(1)}`)
    .join(" ");

  const pathPTI = rows
    .map((r, i) => `${i === 0 ? "M" : "L"}${toX(r.anio).toFixed(1)},${toYPTI(r.pti).toFixed(1)}`)
    .join(" ");

  // Banda PTI > 30%
  const y30 = toYPTI(30);
  const y0PTI = toYPTI(0);

  const row0 = rows[0];
  const row5 = rows[5];
  const row10 = rows[10];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Inputs */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          <div>
            <label style={labelStyle}>Salario mensual neto (ARS)</label>
            <input
              type="number"
              value={inputs.salarioARS}
              onChange={(e) => set("salarioARS", +e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Precio objetivo (USD)</label>
            <input
              type="number"
              value={inputs.precioObjetivoUSD}
              onChange={(e) => set("precioObjetivoUSD", +e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>TC USD/ARS actual</label>
            <input
              type="number"
              value={tcActual}
              onChange={(e) => setTcActual(+e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Inflación salarial anual (%)</label>
            <input
              type="number"
              step={0.5}
              value={inputs.inflacionSalarial}
              onChange={(e) => set("inflacionSalarial", +e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Inflación IPC anual (%)</label>
            <input
              type="number"
              step={0.5}
              value={inputs.inflacionIPC}
              onChange={(e) => set("inflacionIPC", +e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>TNA hipoteca (%)</label>
            <input
              type="number"
              step={0.5}
              value={tasaHipoteca}
              onChange={(e) => setTasaHipoteca(+e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Plazo hipoteca (años)</label>
            <input
              type="number"
              min={5}
              max={30}
              value={plazoHipotecaAnios}
              onChange={(e) => setPlazoHipotecaAnios(+e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Cards resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        <div style={{ ...cardStyle, borderLeft: "3px solid #cc0000" }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
            Meses de salario hoy
          </div>
          <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000" }}>
            {row0 ? fmtNum(row0.mesesEquivalentes) : "—"} meses
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            = {row0 ? (row0.mesesEquivalentes / 12).toFixed(1) : "—"} años de salario
          </div>
        </div>
        <div style={{ ...cardStyle, borderLeft: "3px solid #f97316" }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
            Meses de salario en 5 años
          </div>
          <div
            style={{
              fontSize: 18,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              color:
                row5 && row0
                  ? row5.mesesEquivalentes < row0.mesesEquivalentes
                    ? "#22c55e"
                    : "#cc0000"
                  : "#f97316",
            }}
          >
            {row5 ? fmtNum(row5.mesesEquivalentes) : "—"} meses
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            {row5 && row0
              ? row5.mesesEquivalentes < row0.mesesEquivalentes
                ? "Mejora el acceso"
                : "Empeora el acceso"
              : ""}
          </div>
        </div>
        <div style={{ ...cardStyle, borderLeft: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
            PTI hipoteca hoy
          </div>
          <div
            style={{
              fontSize: 18,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              color: row0 && row0.pti > 30 ? "#cc0000" : "#22c55e",
            }}
          >
            {row0 ? fmtPct(row0.pti) : "—"}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            {row0 && row0.pti > 30 ? "Supera umbral recomendado (30%)" : "Dentro del umbral (≤ 30%)"}
          </div>
        </div>
        <div style={{ ...cardStyle, borderLeft: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
            Brecha de acceso (10 años)
          </div>
          <div
            style={{
              fontSize: 18,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              color:
                row10 && row0
                  ? row10.mesesEquivalentes < row0.mesesEquivalentes
                    ? "#22c55e"
                    : "#cc0000"
                  : "#8b5cf6",
            }}
          >
            {row10 && row0
              ? fmtPct(((row10.mesesEquivalentes - row0.mesesEquivalentes) / row0.mesesEquivalentes) * 100)
              : "—"}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            respecto a hoy
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Acceso a la vivienda en el tiempo</h2>
        <div style={{ overflowX: "auto" }}>
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: "block", maxWidth: "100%" }}
          >
            <rect x={padL} y={padT} width={chartW} height={chartH} fill="#0d0d0d" rx={4} />
            {/* Banda roja PTI > 30% */}
            {y30 < y0PTI && (
              <rect
                x={padL}
                y={padT}
                width={chartW}
                height={Math.max(0, y30 - padT)}
                fill="#cc000020"
              />
            )}
            {/* Línea de referencia PTI 30% */}
            {y30 >= padT && y30 <= padT + chartH && (
              <>
                <line
                  x1={padL}
                  y1={y30}
                  x2={padL + chartW}
                  y2={y30}
                  stroke="#cc0000"
                  strokeWidth={1}
                  strokeDasharray="4,3"
                />
                <text x={padL + chartW + 4} y={y30 + 4} fill="#cc0000" fontSize={10}>
                  30%
                </text>
              </>
            )}
            {/* Grillas */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = padT + f * chartH;
              const mesesVal = maxMeses * (1 - f);
              const ptiVal = maxPTI * (1 - f);
              return (
                <g key={f}>
                  <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#1a1a1a" strokeWidth={1} />
                  <text x={padL - 6} y={y + 4} fill="#555" fontSize={9} textAnchor="end">
                    {Math.round(mesesVal)}m
                  </text>
                  <text x={padL + chartW + 4} y={y + 4} fill="#555" fontSize={9}>
                    {ptiVal.toFixed(0)}%
                  </text>
                </g>
              );
            })}
            {/* Grillas verticales */}
            {rows.map((r) => (
              <g key={r.anio}>
                <line
                  x1={toX(r.anio)}
                  y1={padT}
                  x2={toX(r.anio)}
                  y2={padT + chartH}
                  stroke="#1a1a1a"
                  strokeWidth={1}
                />
                <text x={toX(r.anio)} y={padT + chartH + 16} fill="#555" fontSize={10} textAnchor="middle">
                  {r.anio}
                </text>
              </g>
            ))}
            {/* Línea naranja: PTI */}
            <path d={pathPTI} fill="none" stroke="#f97316" strokeWidth={2} />
            {/* Línea roja: meses equivalentes */}
            <path d={pathMeses} fill="none" stroke="#cc0000" strokeWidth={2.5} />
            {/* Labels eje */}
            <text x={padL - 45} y={padT + chartH / 2} fill="#555" fontSize={9} textAnchor="middle">
              Meses
            </text>
            <text x={padL + chartW + 30} y={padT + chartH / 2} fill="#555" fontSize={9} textAnchor="middle">
              PTI %
            </text>
          </svg>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
          {[
            { color: "#cc0000", label: "Salarios mensuales para comprar propiedad" },
            { color: "#f97316", label: "PTI hipoteca teórica (%)" },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 20, height: 3, background: l.color, borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: "#888" }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 20, height: 10, background: "#cc000030", border: "1px solid #cc0000", borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: "#888" }}>Zona PTI &gt; 30% (esfuerzo excesivo)</span>
          </div>
        </div>
      </div>

      {/* Tabla año a año */}
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #222222" }}>
          <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Tabla año a año</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
            <thead style={{ background: "#0d0d0d" }}>
              <tr>
                {["Año", "Salario mensual", "Precio (ARS)", "Meses equiv.", "Años equiv.", "PTI hipoteca"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "right",
                      fontSize: 11,
                      color: "#666",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.anio}
                  style={{
                    borderBottom: "1px solid #0d0d0d",
                    background: i % 2 === 0 ? "#0d0d0d" : "transparent",
                  }}
                >
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#666" }}>
                    {r.anio}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#e0e0e0" }}>
                    {fmtARS(r.salarioMensualARS)}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#e0e0e0" }}>
                    {fmtARS(r.precioARS)}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#cc0000", fontWeight: 600 }}>
                    {fmtNum(r.mesesEquivalentes)}
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 12, color: "#f97316" }}>
                    {(r.mesesEquivalentes / 12).toFixed(1)}
                  </td>
                  <td
                    style={{
                      padding: "9px 16px",
                      textAlign: "right",
                      fontSize: 12,
                      color: r.pti > 30 ? "#cc0000" : "#22c55e",
                      fontWeight: 600,
                    }}
                  >
                    {fmtPct(r.pti)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────

export default function ProyeccionInflacionPage() {
  const [tabActiva, setTabActiva] = useState<TabId>("propiedad");

  const TABS: { id: TabId; label: string }[] = [
    { id: "propiedad", label: "Precio de Propiedad" },
    { id: "alquileres", label: "Alquileres" },
    { id: "poder-adquisitivo", label: "Poder Adquisitivo" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e0e0e0",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#111111",
          borderBottom: "1px solid #222222",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link href="/calculadoras" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>
          ← Calculadoras
        </Link>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              color: "#e0e0e0",
            }}
          >
            Proyector de Inflación Inmobiliaria
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            Impacto de la inflación en propiedades, alquileres y poder adquisitivo — Argentina
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          background: "#111111",
          borderBottom: "1px solid #222222",
          padding: "0 24px",
          display: "flex",
          gap: 0,
          overflowX: "auto",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTabActiva(t.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tabActiva === t.id ? "2px solid #cc0000" : "2px solid transparent",
              color: tabActiva === t.id ? "#e0e0e0" : "#666",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "14px 20px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {tabActiva === "propiedad" && <TabPropiedad />}
        {tabActiva === "alquileres" && <TabAlquileres />}
        {tabActiva === "poder-adquisitivo" && <TabPoderAdquisitivo />}
      </div>
    </div>
  );
}
