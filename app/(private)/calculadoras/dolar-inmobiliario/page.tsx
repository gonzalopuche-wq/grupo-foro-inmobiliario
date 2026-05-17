"use client";

import { useState, useMemo, useEffect, useCallback } from "react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TipoCambio {
  id: string;
  nombre: string;
  descripcion: string;
  compra: number;
  venta: number;
  variacionDia: number;
  fuente: string;
  relevancia: "alta" | "media" | "baja";
  usoInmobiliario: string;
}

interface HistoricoItem {
  fecha: string;
  valor: number;
}

type Tab = "monitor" | "conversor" | "tendencia";
type Direccion = "USD_ARS" | "ARS_USD";

// ── Datos hardcoded ───────────────────────────────────────────────────────────

const TIPOS_CAMBIO_BASE: TipoCambio[] = [
  {
    id: "oficial",
    nombre: "Dólar Oficial",
    descripcion: "Tipo de cambio oficial BCRA",
    compra: 1060,
    venta: 1100,
    variacionDia: 0.1,
    fuente: "BCRA",
    relevancia: "media",
    usoInmobiliario: "Base de cálculo declaraciones impositivas",
  },
  {
    id: "mep",
    nombre: "Dólar MEP / Bolsa",
    descripcion: "Compra a través del mercado de capitales",
    compra: 1280,
    venta: 1290,
    variacionDia: -0.3,
    fuente: "Bolsas",
    relevancia: "alta",
    usoInmobiliario: "Usado en operaciones inmobiliarias de alto valor",
  },
  {
    id: "ccl",
    nombre: "Dólar CCL",
    descripcion: "Contado con liquidación (dólar cable)",
    compra: 1295,
    venta: 1310,
    variacionDia: 0.5,
    fuente: "Mercados",
    relevancia: "alta",
    usoInmobiliario: "Referencia para operaciones con no residentes",
  },
  {
    id: "blue",
    nombre: "Dólar Blue",
    descripcion: "Mercado informal / paralelo",
    compra: 1270,
    venta: 1290,
    variacionDia: -0.8,
    fuente: "Mercado informal",
    relevancia: "alta",
    usoInmobiliario: "Referencia real en compraventas cash",
  },
  {
    id: "cripto",
    nombre: "Dólar Cripto (USDT)",
    descripcion: "Tether en exchanges argentinos",
    compra: 1285,
    venta: 1295,
    variacionDia: 0.2,
    fuente: "Exchanges",
    relevancia: "media",
    usoInmobiliario: "Alternativa de operatoria en transacciones",
  },
  {
    id: "tarjeta",
    nombre: "Dólar Tarjeta / Turista",
    descripcion: "Oficial + impuesto PAIS + percepciones",
    compra: 0,
    venta: 1430,
    variacionDia: 0.1,
    fuente: "AFIP",
    relevancia: "baja",
    usoInmobiliario: "No relevante para inmuebles",
  },
  {
    id: "exportador",
    nombre: "Dólar Exportador",
    descripcion: "Blend exportación (80/20)",
    compra: 0,
    venta: 1150,
    variacionDia: 0.1,
    fuente: "BCRA",
    relevancia: "baja",
    usoInmobiliario: "Referencia para desarrolladores con exportación",
  },
];

const HISTORICO_BLUE: HistoricoItem[] = [
  { fecha: "2026-05-10", valor: 1255 },
  { fecha: "2026-05-11", valor: 1260 },
  { fecha: "2026-05-12", valor: 1268 },
  { fecha: "2026-05-13", valor: 1275 },
  { fecha: "2026-05-14", valor: 1280 },
  { fecha: "2026-05-15", valor: 1285 },
  { fecha: "2026-05-16", valor: 1290 },
];

const HISTORICO_MEP: HistoricoItem[] = [
  { fecha: "2026-05-10", valor: 1265 },
  { fecha: "2026-05-11", valor: 1270 },
  { fecha: "2026-05-12", valor: 1278 },
  { fecha: "2026-05-13", valor: 1282 },
  { fecha: "2026-05-14", valor: 1285 },
  { fecha: "2026-05-15", valor: 1287 },
  { fecha: "2026-05-16", valor: 1290 },
];

const OFICIAL_HISTORICO: number[] = [1100, 1100, 1100, 1100, 1100, 1100, 1100];

const LS_KEY = "crm_tc_custom_v1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function relevanciaColor(r: TipoCambio["relevancia"]): string {
  if (r === "alta") return "#22c55e";
  if (r === "media") return "#eab308";
  return "#555";
}

function relevanciaLabel(r: TipoCambio["relevancia"]): string {
  if (r === "alta") return "Alta relevancia";
  if (r === "media") return "Media relevancia";
  return "Baja relevancia";
}

function brechaColor(pct: number): string {
  if (pct > 60) return "#cc0000";
  if (pct > 30) return "#eab308";
  return "#22c55e";
}

// ── SVG Chart ─────────────────────────────────────────────────────────────────

interface ChartProps {
  blueData: HistoricoItem[];
  mepData: HistoricoItem[];
  oficialData: number[];
}

function LineChart({ blueData, mepData, oficialData }: ChartProps) {
  const W = 860;
  const H = 200;
  const PAD = { top: 20, right: 20, bottom: 40, left: 70 };

  const allValues = [
    ...blueData.map((d) => d.valor),
    ...mepData.map((d) => d.valor),
    ...oficialData,
  ];
  const minVal = Math.min(...allValues) * 0.995;
  const maxVal = Math.max(...allValues) * 1.005;

  const n = blueData.length;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  function xPos(i: number): number {
    return PAD.left + (i / (n - 1)) * innerW;
  }

  function yPos(val: number): number {
    return PAD.top + innerH - ((val - minVal) / (maxVal - minVal)) * innerH;
  }

  function makePath(vals: number[]): string {
    return vals
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(1)} ${yPos(v).toFixed(1)}`)
      .join(" ");
  }

  const yTicks = 4;
  const yTickValues: number[] = Array.from({ length: yTicks + 1 }, (_, i) =>
    minVal + (i / yTicks) * (maxVal - minVal)
  );

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}
    >
      {/* Grid lines */}
      {yTickValues.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yPos(v)}
            y2={yPos(v)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={yPos(v) + 4}
            textAnchor="end"
            fontSize={10}
            fill="rgba(255,255,255,0.4)"
          >
            {fmt(v)}
          </text>
        </g>
      ))}

      {/* X axis labels */}
      {blueData.map((d, i) => (
        <text
          key={i}
          x={xPos(i)}
          y={H - 6}
          textAnchor="middle"
          fontSize={10}
          fill="rgba(255,255,255,0.4)"
        >
          {fmtDate(d.fecha)}
        </text>
      ))}

      {/* Oficial (dashed gray) */}
      <path
        d={makePath(oficialData)}
        fill="none"
        stroke="rgba(160,160,160,0.6)"
        strokeWidth={1.5}
        strokeDasharray="5,4"
      />

      {/* MEP (blue) */}
      <path
        d={makePath(mepData.map((d) => d.valor))}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
      />

      {/* Blue (red) */}
      <path
        d={makePath(blueData.map((d) => d.valor))}
        fill="none"
        stroke="#cc0000"
        strokeWidth={2}
      />

      {/* Dots — Blue */}
      {blueData.map((d, i) => (
        <circle
          key={i}
          cx={xPos(i)}
          cy={yPos(d.valor)}
          r={3}
          fill="#cc0000"
        />
      ))}

      {/* Dots — MEP */}
      {mepData.map((d, i) => (
        <circle
          key={i}
          cx={xPos(i)}
          cy={yPos(d.valor)}
          r={3}
          fill="#3b82f6"
        />
      ))}
    </svg>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DolarInmobiliarioPage() {
  const [activeTab, setActiveTab] = useState<Tab>("monitor");
  const [monto, setMonto] = useState<number>(100000);
  const [direccion, setDireccion] = useState<Direccion>("USD_ARS");
  const [propiedadUSD, setPropiedadUSD] = useState<number>(150000);
  const [customValues, setCustomValues] = useState<Record<string, { compra: number; venta: number }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCompra, setEditCompra] = useState<string>("");
  const [editVenta, setEditVenta] = useState<string>("");

  // Cargar desde localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const validated: Record<string, { compra: number; venta: number }> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (
              v &&
              typeof v === "object" &&
              !Array.isArray(v) &&
              "compra" in v &&
              "venta" in v &&
              typeof (v as Record<string, unknown>).compra === "number" &&
              typeof (v as Record<string, unknown>).venta === "number"
            ) {
              validated[k] = {
                compra: (v as { compra: number; venta: number }).compra,
                venta: (v as { compra: number; venta: number }).venta,
              };
            }
          }
          setCustomValues(validated);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const guardarCustom = useCallback(
    (id: string, compra: number, venta: number) => {
      const next = { ...customValues, [id]: { compra, venta } };
      setCustomValues(next);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [customValues]
  );

  const tiposCambio: TipoCambio[] = useMemo(() => {
    return TIPOS_CAMBIO_BASE.map((tc) => {
      const custom = customValues[tc.id];
      if (custom) {
        return {
          ...tc,
          compra: custom.compra > 0 ? custom.compra : tc.compra,
          venta: custom.venta > 0 ? custom.venta : tc.venta,
        };
      }
      return tc;
    });
  }, [customValues]);

  const tcById = useMemo(() => {
    const map: Record<string, TipoCambio> = {};
    for (const tc of tiposCambio) map[tc.id] = tc;
    return map;
  }, [tiposCambio]);

  const oficial = tcById["oficial"];
  const blue = tcById["blue"];
  const mep = tcById["mep"];
  const ccl = tcById["ccl"];

  const brechaBlue = useMemo(
    () => ((blue.venta - oficial.venta) / oficial.venta) * 100,
    [blue.venta, oficial.venta]
  );
  const brechaMEP = useMemo(
    () => ((mep.venta - oficial.venta) / oficial.venta) * 100,
    [mep.venta, oficial.venta]
  );
  const brechaCCL = useMemo(
    () => ((ccl.venta - oficial.venta) / oficial.venta) * 100,
    [ccl.venta, oficial.venta]
  );

  function startEdit(tc: TipoCambio) {
    setEditingId(tc.id);
    setEditCompra(tc.compra > 0 ? String(tc.compra) : "");
    setEditVenta(String(tc.venta));
  }

  function confirmEdit(id: string) {
    const compra = parseFloat(editCompra) || 0;
    const venta = parseFloat(editVenta) || 0;
    if (venta > 0) {
      guardarCustom(id, compra, venta);
    }
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function resetCustom(id: string) {
    const next = { ...customValues };
    delete next[id];
    setCustomValues(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    padding: "32px 24px",
    boxSizing: "border-box",
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: 32,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    paddingBottom: 24,
  };

  const h1Style: React.CSSProperties = {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: 28,
    color: "#fff",
    margin: 0,
    marginBottom: 8,
  };

  const subtitleStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    margin: 0,
  };

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    gap: 4,
    marginBottom: 32,
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  };

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: "10px 20px",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "Montserrat, sans-serif",
      fontWeight: active ? 700 : 400,
      fontSize: 14,
      color: active ? "#fff" : "rgba(255,255,255,0.4)",
      borderBottom: active ? "2px solid #cc0000" : "2px solid transparent",
      marginBottom: -1,
      transition: "all 0.15s",
    };
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 16,
    color: "#fff",
    marginBottom: 16,
    marginTop: 0,
  };

  const cardGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
    marginBottom: 40,
  };

  function cardStyle(tc: TipoCambio): React.CSSProperties {
    return {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderLeft: `4px solid ${relevanciaColor(tc.relevancia)}`,
      borderRadius: 10,
      padding: 20,
      position: "relative",
    };
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    color: "#fff",
    fontSize: 14,
    padding: "6px 10px",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "Inter, sans-serif",
  };

  const btnRedStyle: React.CSSProperties = {
    background: "#cc0000",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "Montserrat, sans-serif",
    padding: "6px 14px",
  };

  const btnGhostStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    border: "none",
    borderRadius: 6,
    color: "rgba(255,255,255,0.6)",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "Inter, sans-serif",
    padding: "5px 10px",
  };

  // ── Tab: Monitor ──────────────────────────────────────────────────────────

  const tabMonitor = (
    <div>
      {/* Timestamp */}
      <div
        style={{
          background: "rgba(255,200,0,0.06)",
          border: "1px solid rgba(255,200,0,0.2)",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 16 }}>🕐</span>
        <div>
          <span style={{ color: "rgba(255,200,0,0.9)", fontSize: 13, fontWeight: 600 }}>
            Datos de referencia — Mayo 2026
          </span>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginLeft: 12 }}>
            Actualizar manualmente si los valores cambiaron
          </span>
        </div>
      </div>

      {/* Grid de cards */}
      <p style={sectionTitleStyle}>Tipos de cambio</p>
      <div style={cardGridStyle}>
        {tiposCambio.map((tc) => {
          const isEditing = editingId === tc.id;
          const hasCustom = Boolean(customValues[tc.id]);
          return (
            <div key={tc.id} style={cardStyle(tc)}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <p
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#fff",
                      margin: 0,
                      marginBottom: 2,
                    }}
                  >
                    {tc.nombre}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 }}>
                    {tc.descripcion}
                  </p>
                </div>
                <span
                  style={{
                    background: `${relevanciaColor(tc.relevancia)}22`,
                    border: `1px solid ${relevanciaColor(tc.relevancia)}55`,
                    borderRadius: 4,
                    color: relevanciaColor(tc.relevancia),
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    whiteSpace: "nowrap",
                    marginLeft: 8,
                  }}
                >
                  {relevanciaLabel(tc.relevancia)}
                </span>
              </div>

              {/* Compra / Venta */}
              {!isEditing ? (
                <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, margin: 0, marginBottom: 2 }}>
                      COMPRA
                    </p>
                    <p
                      style={{
                        color: tc.compra > 0 ? "#fff" : "rgba(255,255,255,0.2)",
                        fontSize: 22,
                        fontWeight: 700,
                        fontFamily: "Montserrat, sans-serif",
                        margin: 0,
                      }}
                    >
                      {tc.compra > 0 ? `$${fmt(tc.compra)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, margin: 0, marginBottom: 2 }}>
                      VENTA
                    </p>
                    <p
                      style={{
                        color: "#fff",
                        fontSize: 22,
                        fontWeight: 700,
                        fontFamily: "Montserrat, sans-serif",
                        margin: 0,
                      }}
                    >
                      ${fmt(tc.venta)}
                    </p>
                  </div>
                  {/* Variación */}
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, margin: 0, marginBottom: 2 }}>
                      HOY
                    </p>
                    <p
                      style={{
                        color: tc.variacionDia > 0 ? "#22c55e" : tc.variacionDia < 0 ? "#cc0000" : "rgba(255,255,255,0.4)",
                        fontSize: 15,
                        fontWeight: 700,
                        margin: 0,
                        fontFamily: "Montserrat, sans-serif",
                      }}
                    >
                      {tc.variacionDia > 0 ? "↑" : tc.variacionDia < 0 ? "↓" : "─"}{" "}
                      {tc.variacionDia !== 0 ? `${Math.abs(tc.variacionDia).toFixed(1)}%` : "0%"}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, display: "block", marginBottom: 4 }}>
                        COMPRA
                      </label>
                      <input
                        type="number"
                        value={editCompra}
                        onChange={(e) => setEditCompra(e.target.value)}
                        style={inputStyle}
                        placeholder="0"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, display: "block", marginBottom: 4 }}>
                        VENTA
                      </label>
                      <input
                        type="number"
                        value={editVenta}
                        onChange={(e) => setEditVenta(e.target.value)}
                        style={inputStyle}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={btnRedStyle} onClick={() => confirmEdit(tc.id)}>
                      Guardar
                    </button>
                    <button style={btnGhostStyle} onClick={cancelEdit}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Uso inmobiliario */}
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: 0, marginBottom: 10 }}>
                🏠 {tc.usoInmobiliario}
              </p>

              {/* Fuente + acciones */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                  Fuente: {tc.fuente}
                </span>
                {!isEditing && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {hasCustom && (
                      <button style={btnGhostStyle} onClick={() => resetCustom(tc.id)}>
                        Resetear
                      </button>
                    )}
                    <button style={btnGhostStyle} onClick={() => startEdit(tc)}>
                      ✏️ Actualizar
                    </button>
                  </div>
                )}
              </div>

              {hasCustom && !isEditing && (
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "rgba(204,0,0,0.15)",
                    border: "1px solid rgba(204,0,0,0.4)",
                    borderRadius: 4,
                    color: "#cc0000",
                    fontSize: 9,
                    padding: "1px 5px",
                    fontWeight: 700,
                  }}
                >
                  EDITADO
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Brecha cambiaria */}
      <p style={sectionTitleStyle}>Brecha cambiaria vs. Oficial</p>
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          marginBottom: 32,
        }}
      >
        {[
          { label: "Blue vs Oficial", valor: brechaBlue, detalle: `$${fmt(blue.venta)} vs $${fmt(oficial.venta)}` },
          { label: "MEP vs Oficial", valor: brechaMEP, detalle: `$${fmt(mep.venta)} vs $${fmt(oficial.venta)}` },
          { label: "CCL vs Oficial", valor: brechaCCL, detalle: `$${fmt(ccl.venta)} vs $${fmt(oficial.venta)}` },
        ].map((b) => (
          <div key={b.label} style={{ flex: "1 1 200px" }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0, marginBottom: 6 }}>
              {b.label}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  background: `${brechaColor(b.valor)}22`,
                  border: `1px solid ${brechaColor(b.valor)}55`,
                  borderRadius: 6,
                  color: brechaColor(b.valor),
                  fontSize: 24,
                  fontWeight: 800,
                  fontFamily: "Montserrat, sans-serif",
                  padding: "4px 14px",
                }}
              >
                {b.valor.toFixed(1)}%
              </span>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: brechaColor(b.valor),
                  display: "inline-block",
                  boxShadow: `0 0 8px ${brechaColor(b.valor)}`,
                }}
              />
            </div>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, margin: 0 }}>
              {b.detalle}
            </p>
          </div>
        ))}

        <div style={{ flex: "0 0 100%", marginTop: 8 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { color: "#22c55e", label: "< 30% — Brecha baja" },
              { color: "#eab308", label: "30–60% — Brecha moderada" },
              { color: "#cc0000", label: "> 60% — Brecha alta" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: item.color,
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aviso legal */}
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
        ⚠️ Los valores son orientativos. Verificar en fuentes oficiales antes de asesorar.
      </p>
    </div>
  );

  // ── Tab: Conversor ────────────────────────────────────────────────────────

  const montoConvertido = useMemo(() => {
    return tiposCambio.map((tc) => {
      const tc_venta = tc.venta;
      const tc_compra = tc.compra > 0 ? tc.compra : tc.venta;
      let resultado: number;
      if (direccion === "USD_ARS") {
        resultado = monto * tc_venta;
      } else {
        resultado = monto / tc_venta;
      }
      return { tc, resultado, tc_venta, tc_compra };
    });
  }, [tiposCambio, monto, direccion]);

  const propiedadConvertida = useMemo(() => {
    return tiposCambio.map((tc) => ({
      tc,
      enARS: propiedadUSD * tc.venta,
    }));
  }, [tiposCambio, propiedadUSD]);

  const tabConversor = (
    <div>
      {/* Conversor principal */}
      <p style={sectionTitleStyle}>Conversor de moneda</p>
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: 24,
          marginBottom: 32,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, display: "block", marginBottom: 6 }}>
              Monto {direccion === "USD_ARS" ? "(USD)" : "(ARS)"}
            </label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
              style={{ ...inputStyle, fontSize: 22, fontWeight: 700, padding: "10px 14px" }}
            />
          </div>
          <div>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, display: "block", marginBottom: 6 }}>
              Dirección
            </label>
            <div style={{ display: "flex", gap: 0 }}>
              {(["USD_ARS", "ARS_USD"] as Direccion[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDireccion(d)}
                  style={{
                    background: direccion === d ? "#cc0000" : "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    padding: "10px 16px",
                    borderRadius: d === "USD_ARS" ? "6px 0 0 6px" : "0 6px 6px 0",
                  }}
                >
                  {d === "USD_ARS" ? "USD → ARS" : "ARS → USD"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla resultados */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Tipo de cambio", "Relevancia", "Cotización (venta)", "Resultado"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      color: "rgba(255,255,255,0.35)",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "8px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {montoConvertido.map(({ tc, resultado, tc_venta }) => {
                const isDestacado = tc.id === "blue" || tc.id === "mep";
                return (
                  <tr
                    key={tc.id}
                    style={{
                      background: isDestacado ? "rgba(204,0,0,0.06)" : "transparent",
                      borderLeft: isDestacado ? "3px solid #cc000066" : "3px solid transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 12px",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: isDestacado ? 700 : 400,
                        fontSize: 13,
                        color: isDestacado ? "#fff" : "rgba(255,255,255,0.7)",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      {tc.nombre}
                      {isDestacado && (
                        <span
                          style={{
                            marginLeft: 6,
                            background: "rgba(204,0,0,0.3)",
                            border: "1px solid rgba(204,0,0,0.5)",
                            borderRadius: 3,
                            color: "#ff6666",
                            fontSize: 9,
                            padding: "1px 5px",
                            fontWeight: 800,
                          }}
                        >
                          MÁS USADO
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "12px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <span
                        style={{
                          background: `${relevanciaColor(tc.relevancia)}22`,
                          border: `1px solid ${relevanciaColor(tc.relevancia)}44`,
                          borderRadius: 4,
                          color: relevanciaColor(tc.relevancia),
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                        }}
                      >
                        {tc.relevancia}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "12px 12px",
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 13,
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        fontFamily: "Montserrat, sans-serif",
                      }}
                    >
                      ${fmt(tc_venta)}
                    </td>
                    <td
                      style={{
                        padding: "12px 12px",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: isDestacado ? 17 : 14,
                        color: isDestacado ? "#fff" : "rgba(255,255,255,0.7)",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      {direccion === "USD_ARS"
                        ? `$${fmt(resultado)}`
                        : `USD ${fmt(resultado, 2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conversor de propiedad */}
      <p style={sectionTitleStyle}>Propiedad en USD → equivalencia en ARS</p>
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, display: "block", marginBottom: 6 }}>
            Valor de la propiedad (USD)
          </label>
          <input
            type="number"
            value={propiedadUSD}
            onChange={(e) => setPropiedadUSD(parseFloat(e.target.value) || 0)}
            style={{ ...inputStyle, fontSize: 22, fontWeight: 700, padding: "10px 14px", maxWidth: 280 }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Tipo de cambio", "Precio venta", "Equivalente ARS"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      color: "rgba(255,255,255,0.35)",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "8px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {propiedadConvertida.map(({ tc, enARS }) => {
                const isDestacado = tc.id === "blue" || tc.id === "mep";
                return (
                  <tr
                    key={tc.id}
                    style={{
                      background: isDestacado ? "rgba(204,0,0,0.06)" : "transparent",
                      borderLeft: isDestacado ? "3px solid #cc000066" : "3px solid transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 12px",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: isDestacado ? 700 : 400,
                        fontSize: 13,
                        color: isDestacado ? "#fff" : "rgba(255,255,255,0.7)",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      {tc.nombre}
                    </td>
                    <td
                      style={{
                        padding: "12px 12px",
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 13,
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        fontFamily: "Montserrat, sans-serif",
                      }}
                    >
                      ${fmt(tc.venta)}
                    </td>
                    <td
                      style={{
                        padding: "12px 12px",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: isDestacado ? 16 : 14,
                        color: isDestacado ? "#fff" : "rgba(255,255,255,0.7)",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      ${fmt(enARS)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 16 }}>
        ⚠️ Los valores son orientativos. Verificar en fuentes oficiales antes de asesorar.
      </p>
    </div>
  );

  // ── Tab: Tendencia ────────────────────────────────────────────────────────

  const tabTendencia = (
    <div>
      <p style={sectionTitleStyle}>Tendencia últimos 7 días (Blue y MEP)</p>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { color: "#cc0000", label: "Dólar Blue", strokeDasharray: undefined },
          { color: "#3b82f6", label: "Dólar MEP", strokeDasharray: undefined },
          { color: "rgba(160,160,160,0.7)", label: "Oficial (referencia)", strokeDasharray: "5,4" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width={24} height={10}>
              <line
                x1={0}
                y1={5}
                x2={24}
                y2={5}
                stroke={item.color}
                strokeWidth={2}
                strokeDasharray={item.strokeDasharray}
              />
            </svg>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ marginBottom: 32 }}>
        <LineChart
          blueData={HISTORICO_BLUE}
          mepData={HISTORICO_MEP}
          oficialData={OFICIAL_HISTORICO}
        />
      </div>

      {/* Tabla histórica */}
      <p style={sectionTitleStyle}>Datos históricos</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Fecha", "Blue (cierre)", "MEP (cierre)", "Oficial (ref.)", "Var. Blue", "Var. MEP"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "8px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HISTORICO_BLUE.map((item, i) => {
              const prevBlue = i > 0 ? HISTORICO_BLUE[i - 1].valor : null;
              const prevMEP = i > 0 ? HISTORICO_MEP[i - 1].valor : null;
              const mepItem = HISTORICO_MEP[i];
              const varBlue = prevBlue != null ? ((item.valor - prevBlue) / prevBlue) * 100 : null;
              const varMEP = prevMEP != null ? ((mepItem.valor - prevMEP) / prevMEP) * 100 : null;

              return (
                <tr key={item.fecha}>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 13,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      fontFamily: "Montserrat, sans-serif",
                    }}
                  >
                    {fmtDate(item.fecha)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "#fff",
                      fontSize: 13,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      fontWeight: 700,
                      fontFamily: "Montserrat, sans-serif",
                    }}
                  >
                    ${fmt(item.valor)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "#fff",
                      fontSize: 13,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      fontWeight: 700,
                      fontFamily: "Montserrat, sans-serif",
                    }}
                  >
                    ${fmt(mepItem.valor)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 13,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      fontFamily: "Montserrat, sans-serif",
                    }}
                  >
                    ${fmt(OFICIAL_HISTORICO[i])}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color:
                        varBlue == null
                          ? "rgba(255,255,255,0.2)"
                          : varBlue > 0
                          ? "#22c55e"
                          : varBlue < 0
                          ? "#cc0000"
                          : "rgba(255,255,255,0.4)",
                      fontSize: 13,
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      fontFamily: "Montserrat, sans-serif",
                    }}
                  >
                    {varBlue == null
                      ? "—"
                      : `${varBlue > 0 ? "+" : ""}${varBlue.toFixed(2)}%`}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color:
                        varMEP == null
                          ? "rgba(255,255,255,0.2)"
                          : varMEP > 0
                          ? "#22c55e"
                          : varMEP < 0
                          ? "#cc0000"
                          : "rgba(255,255,255,0.4)",
                      fontSize: 13,
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      fontFamily: "Montserrat, sans-serif",
                    }}
                  >
                    {varMEP == null
                      ? "—"
                      : `${varMEP > 0 ? "+" : ""}${varMEP.toFixed(2)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 20 }}>
        ⚠️ Los valores son orientativos. Verificar en fuentes oficiales antes de asesorar.
      </p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={h1Style}>Monitor de Tipos de Cambio</h1>
        <p style={subtitleStyle}>
          Referencia cambiaria para el mercado inmobiliario argentino · Mayo 2026
        </p>
      </div>

      <div style={tabBarStyle}>
        {(
          [
            { id: "monitor", label: "Monitor" },
            { id: "conversor", label: "Conversor" },
            { id: "tendencia", label: "Tendencia 7 días" },
          ] as { id: Tab; label: string }[]
        ).map(({ id, label }) => (
          <button key={id} style={tabStyle(activeTab === id)} onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "monitor" && tabMonitor}
      {activeTab === "conversor" && tabConversor}
      {activeTab === "tendencia" && tabTendencia}
    </div>
  );
}
