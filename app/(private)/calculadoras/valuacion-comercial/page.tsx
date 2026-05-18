"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtARS(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Tipos ────────────────────────────────────────────────────────────────────

type PropTipo = "departamento" | "casa" | "local" | "oficina" | "ph";
type PropEstado = "excelente" | "bueno" | "regular" | "a_refaccionar";
type RentaMoneda = "ARS" | "USD";

interface Comparable {
  id: number;
  m2: number;
  precioUSD: number;
  vendido: boolean; // true = vendido, false = en oferta
  ajusteManual: number; // -10 a +10
}

interface PropSujeto {
  tipo: PropTipo;
  m2Totales: number;
  m2Cubiertos: number;
  antiguedad: number;
  piso: number;
  pisoAplica: boolean;
  amenityCochera: boolean;
  amenityPileta: boolean;
  amenitySeguridad: boolean;
  amenityGym: boolean;
  amenityLaundry: boolean;
  estado: PropEstado;
  zona: string;
}

interface MetodoComparativo {
  sujeto: PropSujeto;
  comparables: Comparable[];
  tc: number;
}

interface MetodoRenta {
  rentaMensual: number;
  rentaMoneda: RentaMoneda;
  tasaCap: number;
  vacancia: number;
  gastos: number;
  tc: number;
}

// ── Cálculos Método 1 ─────────────────────────────────────────────────────────

function calcAjustesProp(sujeto: PropSujeto): number {
  let aj = 0;
  // Antigüedad: cada 10 años -3%
  aj += Math.floor(sujeto.antiguedad / 10) * -3;
  // Piso alto
  if (sujeto.pisoAplica && sujeto.piso >= 5) aj += 5;
  // Amenities
  if (sujeto.amenityCochera) aj += 8;
  if (sujeto.amenityPileta) aj += 5;
  if (sujeto.amenitySeguridad) aj += 3;
  // Estado
  if (sujeto.estado === "a_refaccionar") aj -= 15;
  return aj;
}

interface ComparableResult {
  id: number;
  pxm2: number;
  pxm2Ajustado: number;
}

function calcComparables(comparables: Comparable[]): ComparableResult[] {
  return comparables
    .filter((c) => c.m2 > 0 && c.precioUSD > 0)
    .map((c) => {
      const pxm2 = c.precioUSD / c.m2;
      // Factor oferta vs vendido: si está en oferta aplicar -5% (propiedades vendidas son precio real)
      const factorEstado = c.vendido ? 1 : 0.95;
      const factorManual = 1 + c.ajusteManual / 100;
      const pxm2Ajustado = pxm2 * factorEstado * factorManual;
      return { id: c.id, pxm2, pxm2Ajustado };
    });
}

interface ResComparativo {
  pxm2Promedio: number;
  pxm2Min: number;
  pxm2Max: number;
  valorBase: number;
  ajustePct: number;
  valorConAjustes: number;
  valorConAjustesARS: number;
  valid: boolean;
}

function calcResComparativo(state: MetodoComparativo): ResComparativo {
  const compResults = calcComparables(state.comparables);
  if (compResults.length === 0) {
    return { pxm2Promedio: 0, pxm2Min: 0, pxm2Max: 0, valorBase: 0, ajustePct: 0, valorConAjustes: 0, valorConAjustesARS: 0, valid: false };
  }
  const precios = compResults.map((c) => c.pxm2Ajustado);
  const pxm2Promedio = precios.reduce((a, b) => a + b, 0) / precios.length;
  const pxm2Min = Math.min(...precios);
  const pxm2Max = Math.max(...precios);
  const m2 = state.sujeto.m2Cubiertos > 0 ? state.sujeto.m2Cubiertos : state.sujeto.m2Totales;
  const valorBase = pxm2Promedio * m2;
  const ajustePct = calcAjustesProp(state.sujeto);
  const valorConAjustes = valorBase * (1 + ajustePct / 100);
  const valorConAjustesARS = valorConAjustes * state.tc;
  return { pxm2Promedio, pxm2Min, pxm2Max, valorBase, ajustePct, valorConAjustes, valorConAjustesARS, valid: true };
}

// ── Cálculos Método 2 ─────────────────────────────────────────────────────────

interface ResRenta {
  rentaBrutaAnual: number;
  rentaNetaAnual: number;
  valorMercado: number;
  valorMercadoARS: number;
  tasaRendimiento: number;
  valid: boolean;
}

function calcResRenta(state: MetodoRenta): ResRenta {
  const rentaMensualUSD = state.rentaMoneda === "USD"
    ? state.rentaMensual
    : state.rentaMensual / state.tc;

  if (rentaMensualUSD <= 0 || state.tasaCap <= 0) {
    return { rentaBrutaAnual: 0, rentaNetaAnual: 0, valorMercado: 0, valorMercadoARS: 0, tasaRendimiento: 0, valid: false };
  }

  const rentaBrutaAnual = rentaMensualUSD * 12;
  const factorVacancia = 1 - state.vacancia / 100;
  const factorGastos = 1 - state.gastos / 100;
  const rentaNetaAnual = rentaBrutaAnual * factorVacancia * factorGastos;
  const valorMercado = rentaNetaAnual / (state.tasaCap / 100);
  const valorMercadoARS = valorMercado * state.tc;
  const tasaRendimiento = valorMercado > 0 ? (rentaNetaAnual / valorMercado) * 100 : 0;

  return { rentaBrutaAnual, rentaNetaAnual, valorMercado, valorMercadoARS, tasaRendimiento, valid: true };
}

function calcSensibilidad(state: MetodoRenta): Array<{ tasa: number; valor: number }> {
  const tasas = [3, 4, 5, 6, 7];
  return tasas.map((tasa) => {
    const s = { ...state, tasaCap: tasa };
    const r = calcResRenta(s);
    return { tasa, valor: r.valorMercado };
  });
}

// ── Factores de ajuste ────────────────────────────────────────────────────────

const TABLA_FACTORES = [
  { concepto: "Antigüedad cada 10 años", ajuste: -3 },
  { concepto: "Piso alto (≥ 5to piso)", ajuste: +5 },
  { concepto: "Cochera", ajuste: +8 },
  { concepto: "Pileta / piscina", ajuste: +5 },
  { concepto: "Seguridad 24hs", ajuste: +3 },
  { concepto: "A refaccionar", ajuste: -15 },
];

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    background: "#0a0a0a",
    color: "#e0e0e0",
    minHeight: "100vh",
    fontFamily: "'Inter', sans-serif",
    padding: "24px 16px 80px",
  },
  maxW: {
    maxWidth: 960,
    margin: "0 auto",
  },
  title: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800,
    fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
    color: "#ffffff",
    marginBottom: 4,
    lineHeight: 1.2,
  },
  subtitle: {
    color: "#888888",
    fontSize: "0.9rem",
    marginBottom: 32,
  },
  tabs: {
    display: "flex",
    gap: 4,
    marginBottom: 28,
    borderBottom: "1px solid #222222",
    overflowX: "auto" as const,
    scrollbarWidth: "none" as const,
  },
  tabBtn: (active: boolean): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: "0.82rem",
    padding: "10px 18px",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid #cc0000" : "2px solid transparent",
    color: active ? "#ffffff" : "#666666",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "color 0.15s",
    marginBottom: -1,
  }),
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: "0.78rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#cc0000",
    marginBottom: 14,
  },
  card: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 8,
    padding: "20px 24px",
    marginBottom: 16,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
  },
  label: {
    display: "block",
    fontSize: "0.78rem",
    color: "#888888",
    marginBottom: 6,
    fontWeight: 500,
  },
  input: {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #333333",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#e0e0e0",
    fontSize: "0.9rem",
    boxSizing: "border-box" as const,
    outline: "none",
  },
  select: {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #333333",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#e0e0e0",
    fontSize: "0.9rem",
    boxSizing: "border-box" as const,
    outline: "none",
    cursor: "pointer",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    fontSize: "0.88rem",
    cursor: "pointer",
  },
  btn: {
    background: "#cc0000",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    padding: "9px 18px",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: "0.8rem",
    cursor: "pointer",
    letterSpacing: "0.04em",
  },
  btnDanger: {
    background: "#1a1a1a",
    color: "#cc0000",
    border: "1px solid #cc0000",
    borderRadius: 6,
    padding: "6px 12px",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: "0.75rem",
    cursor: "pointer",
  },
  resultCard: (highlight?: boolean): React.CSSProperties => ({
    background: highlight ? "#1a0000" : "#111111",
    border: `1px solid ${highlight ? "#cc0000" : "#222222"}`,
    borderRadius: 8,
    padding: "18px 20px",
    textAlign: "center",
  }),
  resultLabel: {
    fontSize: "0.75rem",
    color: "#888888",
    marginBottom: 6,
    fontWeight: 500,
  },
  resultValue: (highlight?: boolean): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800,
    fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
    color: highlight ? "#cc0000" : "#ffffff",
  }),
  resultSub: {
    fontSize: "0.78rem",
    color: "#666666",
    marginTop: 4,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.85rem",
  },
  th: {
    padding: "8px 12px",
    textAlign: "left" as const,
    color: "#888888",
    fontWeight: 600,
    borderBottom: "1px solid #222222",
    fontSize: "0.75rem",
    letterSpacing: "0.04em",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #1a1a1a",
    color: "#e0e0e0",
  },
  badge: (color: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    background: color + "22",
    color: color,
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
  }),
  disclaimer: {
    background: "#111111",
    border: "1px solid #333333",
    borderRadius: 8,
    padding: "14px 18px",
    fontSize: "0.8rem",
    color: "#666666",
    marginTop: 24,
    lineHeight: 1.5,
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "#666666",
    fontSize: "0.82rem",
    textDecoration: "none",
    marginBottom: 20,
  },
  divider: {
    borderTop: "1px solid #1a1a1a",
    margin: "16px 0",
  },
  ajBadge: (pct: number): React.CSSProperties => ({
    color: pct >= 0 ? "#22c55e" : "#cc0000",
    fontWeight: 700,
  }),
};

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SUJETO: PropSujeto = {
  tipo: "departamento",
  m2Totales: 60,
  m2Cubiertos: 55,
  antiguedad: 15,
  piso: 3,
  pisoAplica: true,
  amenityCochera: false,
  amenityPileta: false,
  amenitySeguridad: false,
  amenityGym: false,
  amenityLaundry: false,
  estado: "bueno",
  zona: "",
};

let _nextId = 1;
function nextCompId() { return _nextId++; }

function makeComp(): Comparable {
  return { id: nextCompId(), m2: 0, precioUSD: 0, vendido: false, ajusteManual: 0 };
}

const DEFAULT_COMP1: MetodoComparativo = {
  sujeto: DEFAULT_SUJETO,
  comparables: [makeComp(), makeComp()],
  tc: 1150,
};

const DEFAULT_RENTA: MetodoRenta = {
  rentaMensual: 0,
  rentaMoneda: "ARS",
  tasaCap: 5,
  vacancia: 8,
  gastos: 15,
  tc: 1150,
};

// ── Componentes auxiliares ────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      style={S.input}
      value={value === 0 ? "" : value}
      placeholder={placeholder ?? "0"}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}

// ── Tab 1: Método Comparativo ─────────────────────────────────────────────────

function TabComparativo({
  state,
  setState,
  resComp,
}: {
  state: MetodoComparativo;
  setState: React.Dispatch<React.SetStateAction<MetodoComparativo>>;
  resComp: ResComparativo;
}) {
  const compResults = calcComparables(state.comparables);

  function updateSujeto(partial: Partial<PropSujeto>) {
    setState((prev) => ({ ...prev, sujeto: { ...prev.sujeto, ...partial } }));
  }

  function updateComp(id: number, partial: Partial<Comparable>) {
    setState((prev) => ({
      ...prev,
      comparables: prev.comparables.map((c) => (c.id === id ? { ...c, ...partial } : c)),
    }));
  }

  function addComp() {
    if (state.comparables.length >= 5) return;
    setState((prev) => ({ ...prev, comparables: [...prev.comparables, makeComp()] }));
  }

  function removeComp(id: number) {
    setState((prev) => ({ ...prev, comparables: prev.comparables.filter((c) => c.id !== id) }));
  }

  const s = state.sujeto;
  const ajustePct = calcAjustesProp(s);

  return (
    <div>
      {/* Tipo de cambio */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Tipo de Cambio</div>
        <div style={S.card}>
          <div style={{ maxWidth: 220 }}>
            <FieldGroup label="USD / ARS">
              <NumberInput value={state.tc} onChange={(v) => setState((p) => ({ ...p, tc: v }))} min={1} placeholder="1150" />
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* Propiedad a valuar */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Propiedad a Valuar</div>
        <div style={S.card}>
          <div style={S.grid2}>
            <FieldGroup label="Tipo de propiedad">
              <select style={S.select} value={s.tipo} onChange={(e) => updateSujeto({ tipo: e.target.value as PropTipo })}>
                <option value="departamento">Departamento</option>
                <option value="casa">Casa</option>
                <option value="local">Local comercial</option>
                <option value="oficina">Oficina</option>
                <option value="ph">PH</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Zona / barrio">
              <input
                type="text"
                style={S.input}
                placeholder="Ej: Palermo, Rosario Centro…"
                value={s.zona}
                onChange={(e) => updateSujeto({ zona: e.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="m² totales">
              <NumberInput value={s.m2Totales} onChange={(v) => updateSujeto({ m2Totales: v })} min={1} />
            </FieldGroup>
            <FieldGroup label="m² cubiertos">
              <NumberInput value={s.m2Cubiertos} onChange={(v) => updateSujeto({ m2Cubiertos: v })} min={1} />
            </FieldGroup>
            <FieldGroup label="Antigüedad (años)">
              <NumberInput value={s.antiguedad} onChange={(v) => updateSujeto({ antiguedad: v })} min={0} />
            </FieldGroup>
            <FieldGroup label="Estado">
              <select style={S.select} value={s.estado} onChange={(e) => updateSujeto({ estado: e.target.value as PropEstado })}>
                <option value="excelente">Excelente</option>
                <option value="bueno">Bueno</option>
                <option value="regular">Regular</option>
                <option value="a_refaccionar">A refaccionar</option>
              </select>
            </FieldGroup>
          </div>

          <div style={S.divider} />

          {/* Piso */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const, marginBottom: 14 }}>
            <label style={{ ...S.checkRow }}>
              <input
                type="checkbox"
                checked={s.pisoAplica}
                onChange={(e) => updateSujeto({ pisoAplica: e.target.checked })}
                style={{ accentColor: "#cc0000" }}
              />
              Aplica piso
            </label>
            {s.pisoAplica && (
              <div style={{ width: 140 }}>
                <FieldGroup label="Piso N°">
                  <NumberInput value={s.piso} onChange={(v) => updateSujeto({ piso: v })} min={1} max={50} />
                </FieldGroup>
              </div>
            )}
          </div>

          {/* Amenities */}
          <div style={S.sectionTitle}>Amenities</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 4 }}>
            {(
              [
                ["amenityCochera", "Cochera"],
                ["amenityPileta", "Pileta / piscina"],
                ["amenitySeguridad", "Seguridad 24hs"],
                ["amenityGym", "Gimnasio"],
                ["amenityLaundry", "Laundry"],
              ] as [keyof PropSujeto, string][]
            ).map(([key, lbl]) => (
              <label key={key} style={S.checkRow}>
                <input
                  type="checkbox"
                  checked={s[key] as boolean}
                  onChange={(e) => updateSujeto({ [key]: e.target.checked })}
                  style={{ accentColor: "#cc0000" }}
                />
                {lbl}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Comparables */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Propiedades Comparables (hasta 5)</div>
        {state.comparables.map((comp, idx) => {
          const cr = compResults.find((r) => r.id === comp.id);
          return (
            <div key={comp.id} style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#888888" }}>
                  Comparable #{idx + 1}
                </span>
                {state.comparables.length > 1 && (
                  <button style={S.btnDanger} onClick={() => removeComp(comp.id)}>
                    Eliminar
                  </button>
                )}
              </div>
              <div style={S.grid2}>
                <FieldGroup label="m² (cubiertos)">
                  <NumberInput value={comp.m2} onChange={(v) => updateComp(comp.id, { m2: v })} min={1} />
                </FieldGroup>
                <FieldGroup label="Precio (USD)">
                  <NumberInput value={comp.precioUSD} onChange={(v) => updateComp(comp.id, { precioUSD: v })} min={0} />
                </FieldGroup>
                <FieldGroup label="Ajuste manual (−10% a +10%)">
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={1}
                    value={comp.ajusteManual}
                    onChange={(e) => updateComp(comp.id, { ajusteManual: parseInt(e.target.value) })}
                    style={{ width: "100%", accentColor: "#cc0000" }}
                  />
                  <div style={{ fontSize: "0.78rem", color: comp.ajusteManual >= 0 ? "#22c55e" : "#cc0000", marginTop: 4 }}>
                    {comp.ajusteManual >= 0 ? "+" : ""}{comp.ajusteManual}%
                  </div>
                </FieldGroup>
                <FieldGroup label="Estado de la operación">
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                    <label style={S.checkRow}>
                      <input
                        type="radio"
                        name={`vendido-${comp.id}`}
                        checked={comp.vendido}
                        onChange={() => updateComp(comp.id, { vendido: true })}
                        style={{ accentColor: "#cc0000" }}
                      />
                      Vendido
                    </label>
                    <label style={S.checkRow}>
                      <input
                        type="radio"
                        name={`vendido-${comp.id}`}
                        checked={!comp.vendido}
                        onChange={() => updateComp(comp.id, { vendido: false })}
                        style={{ accentColor: "#cc0000" }}
                      />
                      En oferta
                    </label>
                  </div>
                </FieldGroup>
              </div>
              {cr && comp.m2 > 0 && comp.precioUSD > 0 && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#0d0d0d", borderRadius: 6, display: "flex", gap: 24, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: "0.8rem", color: "#888888" }}>
                    Precio/m² base: <strong style={{ color: "#e0e0e0" }}>USD {fmtUSD(cr.pxm2)}</strong>
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#888888" }}>
                    Precio/m² ajustado: <strong style={{ color: "#cc0000" }}>USD {fmtUSD(cr.pxm2Ajustado)}</strong>
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {state.comparables.length < 5 && (
          <button style={S.btn} onClick={addComp}>
            + Agregar comparable
          </button>
        )}
      </div>

      {/* Tabla de factores */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Tabla de Ajustes Automáticos</div>
        <div style={S.card}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Factor</th>
                <th style={{ ...S.th, textAlign: "right" }}>Ajuste</th>
                <th style={{ ...S.th, textAlign: "right" }}>¿Aplica?</th>
              </tr>
            </thead>
            <tbody>
              {TABLA_FACTORES.map((f) => {
                let aplica = false;
                if (f.ajuste === -3) aplica = s.antiguedad >= 10;
                if (f.ajuste === 5 && f.concepto.includes("Piso")) aplica = s.pisoAplica && s.piso >= 5;
                if (f.concepto === "Cochera") aplica = s.amenityCochera;
                if (f.concepto.includes("Pileta")) aplica = s.amenityPileta;
                if (f.concepto.includes("Seguridad")) aplica = s.amenitySeguridad;
                if (f.concepto.includes("refaccionar")) aplica = s.estado === "a_refaccionar";

                let aplication = f.ajuste;
                if (f.ajuste === -3) aplication = Math.floor(s.antiguedad / 10) * -3;

                return (
                  <tr key={f.concepto} style={{ opacity: aplica ? 1 : 0.4 }}>
                    <td style={S.td}>{f.concepto}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      <span style={S.ajBadge(aplica ? aplication : f.ajuste)}>
                        {(aplica ? aplication : f.ajuste) >= 0 ? "+" : ""}{aplica ? aplication : f.ajuste}%
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      <span style={S.badge(aplica ? "#22c55e" : "#666666")}>
                        {aplica ? "Sí" : "No"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ ...S.td, fontWeight: 700, color: "#ffffff" }}>Total ajuste propiedad</td>
                <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>
                  <span style={S.ajBadge(ajustePct)}>
                    {ajustePct >= 0 ? "+" : ""}{fmtPct(ajustePct)}%
                  </span>
                </td>
                <td style={{ ...S.td, textAlign: "right" }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Resultados */}
      {resComp.valid && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Resultados — Método Comparativo</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <div style={S.resultCard()}>
              <div style={S.resultLabel}>Precio/m² promedio</div>
              <div style={S.resultValue()}>USD {fmtUSD(resComp.pxm2Promedio)}</div>
              <div style={S.resultSub}>precio/m² ajustado</div>
            </div>
            <div style={S.resultCard()}>
              <div style={S.resultLabel}>Rango precio/m²</div>
              <div style={{ ...S.resultValue(), fontSize: "1rem" }}>
                {fmtUSD(resComp.pxm2Min)} – {fmtUSD(resComp.pxm2Max)}
              </div>
              <div style={S.resultSub}>mín – máx (USD)</div>
            </div>
            <div style={S.resultCard()}>
              <div style={S.resultLabel}>Valor base (sin ajustes)</div>
              <div style={S.resultValue()}>USD {fmtUSD(resComp.valorBase)}</div>
              <div style={S.resultSub}>m² × precio/m² promedio</div>
            </div>
            <div style={S.resultCard(true)}>
              <div style={S.resultLabel}>Valuación estimada</div>
              <div style={S.resultValue(true)}>USD {fmtUSD(resComp.valorConAjustes)}</div>
              <div style={S.resultSub}>ARS {fmtARS(resComp.valorConAjustesARS)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Método de Renta ────────────────────────────────────────────────────

function TabRenta({
  state,
  setState,
  resRenta,
}: {
  state: MetodoRenta;
  setState: React.Dispatch<React.SetStateAction<MetodoRenta>>;
  resRenta: ResRenta;
}) {
  const sensibilidad = useMemo(() => calcSensibilidad(state), [state]);

  return (
    <div>
      {/* Tipo de cambio */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Tipo de Cambio</div>
        <div style={S.card}>
          <div style={{ maxWidth: 220 }}>
            <FieldGroup label="USD / ARS">
              <NumberInput value={state.tc} onChange={(v) => setState((p) => ({ ...p, tc: v }))} min={1} placeholder="1150" />
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Datos de la Renta</div>
        <div style={S.card}>
          <div style={S.grid2}>
            <FieldGroup label="Renta mensual">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  style={{ ...S.input, flex: 1 }}
                  value={state.rentaMensual === 0 ? "" : state.rentaMensual}
                  placeholder="0"
                  min={0}
                  onChange={(e) => setState((p) => ({ ...p, rentaMensual: parseFloat(e.target.value) || 0 }))}
                />
                <select
                  style={{ ...S.select, width: 90 }}
                  value={state.rentaMoneda}
                  onChange={(e) => setState((p) => ({ ...p, rentaMoneda: e.target.value as RentaMoneda }))}
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </FieldGroup>
            <FieldGroup label="Tasa de capitalización (%)">
              <NumberInput
                value={state.tasaCap}
                onChange={(v) => setState((p) => ({ ...p, tasaCap: v }))}
                min={0.1}
                max={30}
                step={0.1}
                placeholder="5"
              />
            </FieldGroup>
            <FieldGroup label="Vacancia estimada (%)">
              <NumberInput
                value={state.vacancia}
                onChange={(v) => setState((p) => ({ ...p, vacancia: v }))}
                min={0}
                max={50}
                step={0.5}
                placeholder="8"
              />
            </FieldGroup>
            <FieldGroup label="Gastos propietario (% renta bruta)">
              <NumberInput
                value={state.gastos}
                onChange={(v) => setState((p) => ({ ...p, gastos: v }))}
                min={0}
                max={50}
                step={0.5}
                placeholder="15"
              />
            </FieldGroup>
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#0d0d0d", borderRadius: 6, fontSize: "0.8rem", color: "#888888", lineHeight: 1.7 }}>
            <strong style={{ color: "#e0e0e0" }}>Referencia:</strong> tasa de cap 5% → el precio equivale a ~20 veces la renta anual neta. En Rosario y ciudades del interior el cap rate típico es 4–6%.
          </div>
        </div>
      </div>

      {/* Resultados */}
      {resRenta.valid && (
        <>
          <div style={S.section}>
            <div style={S.sectionTitle}>Resultados — Método de Renta</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <div style={S.resultCard()}>
                <div style={S.resultLabel}>Renta bruta anual</div>
                <div style={S.resultValue()}>USD {fmtUSD(resRenta.rentaBrutaAnual)}</div>
                <div style={S.resultSub}>renta mensual × 12</div>
              </div>
              <div style={S.resultCard()}>
                <div style={S.resultLabel}>Renta neta ajustada</div>
                <div style={S.resultValue()}>USD {fmtUSD(resRenta.rentaNetaAnual)}</div>
                <div style={S.resultSub}>descontando vacancia y gastos</div>
              </div>
              <div style={S.resultCard()}>
                <div style={S.resultLabel}>Rendimiento implícito</div>
                <div style={S.resultValue()}>{fmtPct(resRenta.tasaRendimiento)}%</div>
                <div style={S.resultSub}>renta neta / valor de mercado</div>
              </div>
              <div style={S.resultCard(true)}>
                <div style={S.resultLabel}>Valor de mercado</div>
                <div style={S.resultValue(true)}>USD {fmtUSD(resRenta.valorMercado)}</div>
                <div style={S.resultSub}>ARS {fmtARS(resRenta.valorMercadoARS)}</div>
              </div>
            </div>
          </div>

          {/* Tabla de sensibilidad */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Análisis de Sensibilidad — Tasa de Capitalización</div>
            <div style={S.card}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Tasa cap (%)</th>
                    <th style={{ ...S.th, textAlign: "right" }}>Valor estimado (USD)</th>
                    <th style={{ ...S.th, textAlign: "right" }}>Valor estimado (ARS)</th>
                  </tr>
                </thead>
                <tbody>
                  {sensibilidad.map((row) => (
                    <tr
                      key={row.tasa}
                      style={{ background: row.tasa === state.tasaCap ? "#1a0000" : "transparent" }}
                    >
                      <td style={S.td}>
                        {row.tasa}%
                        {row.tasa === state.tasaCap && (
                          <span style={{ marginLeft: 8, ...S.badge("#cc0000") }}>actual</span>
                        )}
                      </td>
                      <td style={{ ...S.td, textAlign: "right", fontWeight: row.tasa === state.tasaCap ? 700 : 400, color: row.tasa === state.tasaCap ? "#cc0000" : "#e0e0e0" }}>
                        USD {fmtUSD(row.valor)}
                      </td>
                      <td style={{ ...S.td, textAlign: "right", color: "#888888", fontSize: "0.82rem" }}>
                        ARS {fmtARS(row.valor * state.tc)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab 3: Consolidación ──────────────────────────────────────────────────────

function TabConsolidacion({
  resComp,
  resRenta,
  tc,
}: {
  resComp: ResComparativo;
  resRenta: ResRenta;
  tc: number;
}) {
  const [peso1, setPeso1] = useState(50); // peso comparativo
  const peso2 = 100 - peso1;

  const hasComp = resComp.valid;
  const hasRenta = resRenta.valid;
  const hasBoth = hasComp && hasRenta;

  const valorComp = resComp.valorConAjustes;
  const valorRenta = resRenta.valorMercado;

  const promedioPonderado = hasBoth
    ? (valorComp * peso1) / 100 + (valorRenta * peso2) / 100
    : hasComp
    ? valorComp
    : valorRenta;

  const valMin = hasBoth ? Math.min(valorComp, valorRenta) : promedioPonderado;
  const valMax = hasBoth ? Math.max(valorComp, valorRenta) : promedioPonderado;

  const precioSugerido = valMax * 0.95;
  const precioNegociacion = valMin * 1.125;

  function tiempoVenta(precio: number): string {
    if (precio <= valMax && precio >= valMin) return "3 – 6 meses";
    if (precio > valMax) return "> 12 meses";
    return "< 3 meses";
  }

  if (!hasComp && !hasRenta) {
    return (
      <div style={S.card}>
        <p style={{ color: "#666666", textAlign: "center", padding: "32px 0" }}>
          Completá al menos uno de los métodos anteriores para ver el resumen consolidado.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Tabla comparativa */}
      {hasBoth && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Tabla Comparativa de Métodos</div>
          <div style={S.card}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Método</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Valor estimado (USD)</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Valor estimado (ARS)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={S.td}>
                    <span style={S.badge("#3b82f6")}>Comparativo de mercado</span>
                  </td>
                  <td style={{ ...S.td, textAlign: "right" }}>USD {fmtUSD(valorComp)}</td>
                  <td style={{ ...S.td, textAlign: "right", color: "#888888" }}>ARS {fmtARS(valorComp * tc)}</td>
                </tr>
                <tr>
                  <td style={S.td}>
                    <span style={S.badge("#f97316")}>Renta capitalizada</span>
                  </td>
                  <td style={{ ...S.td, textAlign: "right" }}>USD {fmtUSD(valorRenta)}</td>
                  <td style={{ ...S.td, textAlign: "right", color: "#888888" }}>ARS {fmtARS(valorRenta * tc)}</td>
                </tr>
                <tr style={{ background: "#1a0000" }}>
                  <td style={{ ...S.td, fontWeight: 700, color: "#cc0000" }}>
                    Promedio ponderado ({peso1}/{peso2})
                  </td>
                  <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: "#cc0000" }}>
                    USD {fmtUSD(promedioPonderado)}
                  </td>
                  <td style={{ ...S.td, textAlign: "right", color: "#888888" }}>
                    ARS {fmtARS(promedioPonderado * tc)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Slider ponderación */}
            <div style={{ marginTop: 20 }}>
              <label style={S.label}>
                Ponderación: Comparativo {peso1}% — Renta {peso2}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={peso1}
                onChange={(e) => setPeso1(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "#cc0000" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#666666", marginTop: 4 }}>
                <span>100% Renta</span>
                <span>50/50</span>
                <span>100% Comparativo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rango de mercado */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Rango de Valor de Mercado</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <div style={S.resultCard()}>
            <div style={S.resultLabel}>Valor mínimo</div>
            <div style={S.resultValue()}>USD {fmtUSD(valMin)}</div>
            <div style={S.resultSub}>ARS {fmtARS(valMin * tc)}</div>
          </div>
          <div style={S.resultCard(true)}>
            <div style={S.resultLabel}>Promedio ponderado</div>
            <div style={S.resultValue(true)}>USD {fmtUSD(promedioPonderado)}</div>
            <div style={S.resultSub}>ARS {fmtARS(promedioPonderado * tc)}</div>
          </div>
          <div style={S.resultCard()}>
            <div style={S.resultLabel}>Valor máximo</div>
            <div style={S.resultValue()}>USD {fmtUSD(valMax)}</div>
            <div style={S.resultSub}>ARS {fmtARS(valMax * tc)}</div>
          </div>
        </div>
      </div>

      {/* Cards de conclusión */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Recomendaciones Comerciales</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div style={{ ...S.card, borderColor: "#22c55e" }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "#22c55e", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
              Precio de venta sugerido
            </div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "1.4rem", color: "#ffffff" }}>
              USD {fmtUSD(precioSugerido)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#888888", marginTop: 4 }}>
              ARS {fmtARS(precioSugerido * tc)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#666666", marginTop: 8, lineHeight: 1.5 }}>
              Ligeramente por debajo del máximo para mayor velocidad de venta (−5%)
            </div>
            <div style={{ marginTop: 10, ...S.badge("#22c55e") }}>
              Tiempo est.: {tiempoVenta(precioSugerido)}
            </div>
          </div>

          <div style={{ ...S.card, borderColor: "#f97316" }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "#f97316", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
              Precio de entrada negociación
            </div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "1.4rem", color: "#ffffff" }}>
              USD {fmtUSD(precioNegociacion)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#888888", marginTop: 4 }}>
              ARS {fmtARS(precioNegociacion * tc)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#666666", marginTop: 8, lineHeight: 1.5 }}>
              12.5% sobre el valor mínimo — margen para negociación
            </div>
            <div style={{ marginTop: 10, ...S.badge("#f97316") }}>
              Tiempo est.: {tiempoVenta(precioNegociacion)}
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "#888888", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
              Guía de tiempo de venta
            </div>
            <div style={{ fontSize: "0.82rem", lineHeight: 1.8, color: "#e0e0e0" }}>
              <div>📍 Precio dentro del rango → <strong>3 – 6 meses</strong></div>
              <div>📍 Precio por encima del máx → <strong>&gt; 12 meses</strong></div>
              <div>📍 Precio por debajo del mín → <strong>&lt; 3 meses</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div style={S.disclaimer}>
        <strong>Aviso legal:</strong> Esta valuación es orientativa y tiene carácter informativo. Los valores obtenidos están basados en los datos ingresados y en modelos de estimación estándar. Para una tasación oficial con validez legal se recomienda contratar un tasador matriculado o corredor inmobiliario habilitado.
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ValuacionComercialPage() {
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  const [stateComp, setStateComp] = useState<MetodoComparativo>(DEFAULT_COMP1);
  const [stateRenta, setStateRenta] = useState<MetodoRenta>(DEFAULT_RENTA);

  const resComp = useMemo(() => calcResComparativo(stateComp), [stateComp]);
  const resRenta = useMemo(() => calcResRenta(stateRenta), [stateRenta]);

  // Tipo de cambio consolidado (tomar el del método con mayor TC, o el de comparativo)
  const tcConsolidado = stateComp.tc;

  const TABS = [
    "1. Comparativo de Mercado",
    "2. Renta Capitalizada",
    "3. Consolidación y Resumen",
  ];

  return (
    <div style={S.page}>
      <div style={S.maxW}>
        <Link href="/calculadoras" style={S.backLink}>
          ← Calculadoras
        </Link>

        <h1 style={S.title}>Valuación Comercial de Inmuebles</h1>
        <p style={S.subtitle}>
          Tres métodos profesionales: comparativo de mercado, capitalización de rentas y consolidación.
        </p>

        {/* Tabs */}
        <div style={S.tabs}>
          {TABS.map((t, i) => (
            <button
              key={t}
              style={S.tabBtn(tab === i)}
              onClick={() => setTab(i as 0 | 1 | 2)}
            >
              {t}
              {i === 0 && resComp.valid && (
                <span style={{ marginLeft: 6, ...S.badge("#22c55e") }}>✓</span>
              )}
              {i === 1 && resRenta.valid && (
                <span style={{ marginLeft: 6, ...S.badge("#22c55e") }}>✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {tab === 0 && (
          <TabComparativo state={stateComp} setState={setStateComp} resComp={resComp} />
        )}
        {tab === 1 && (
          <TabRenta state={stateRenta} setState={setStateRenta} resRenta={resRenta} />
        )}
        {tab === 2 && (
          <TabConsolidacion resComp={resComp} resRenta={resRenta} tc={tcConsolidado} />
        )}
      </div>
    </div>
  );
}
