"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface EscenarioNegociacion {
  id: string;
  nombre: string;
  precioAcuerdo: number;
  descripcion: string;
}

interface SimulacionNegociacion {
  id: string;
  titulo: string;
  created_at: string;
  precioPublicado: number;
  moneda: "USD" | "ARS";
  tipoCambio: number;
  ofertaInicial: number;
  ofertaFinal: number;
  posicionCompradorMin: number;
  precioMeta: number;
  disposicionBajar: number;
  posicionVendedorMax: number;
  honorariosComprador: number;
  honorariosVendedor: number;
  escenarios: EscenarioNegociacion[];
  notas: string;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "crm_simulaciones_v1";

function loadSimulaciones(): SimulacionNegociacion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SimulacionNegociacion[];
  } catch {
    return [];
  }
}

function saveSimulaciones(sims: SimulacionNegociacion[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sims));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}

function defaultEscenarios(sim: Omit<SimulacionNegociacion, "escenarios">): EscenarioNegociacion[] {
  const medio = Math.round((sim.ofertaFinal + sim.posicionVendedorMax) / 2);
  return [
    { id: uid(), nombre: "Escenario A — Oferta del comprador", precioAcuerdo: sim.ofertaFinal, descripcion: "Precio objetivo del comprador, sin concesiones adicionales." },
    { id: uid(), nombre: "Escenario B — Punto medio", precioAcuerdo: medio, descripcion: "Punto equidistante entre la posición final de cada parte." },
    { id: uid(), nombre: "Escenario C — Meta del vendedor", precioAcuerdo: sim.precioMeta, descripcion: "Precio que el vendedor espera obtener." },
  ];
}

// ── Cálculo por escenario ─────────────────────────────────────────────────────

interface ResultadoEscenario {
  precioARS: number;
  precioUSD: number;
  descuentoSobrePublicado: number;
  deltaVendedor: number;
  deltaComprador: number;
  honCompradorARS: number;
  honVendedorARS: number;
  totalHonorariosARS: number;
  costoTotalComprador: number;
  neteVendedor: number;
  enZona: boolean;
}

function calcularEscenario(sim: SimulacionNegociacion, precio: number): ResultadoEscenario {
  const precioARS = sim.moneda === "USD" ? precio * sim.tipoCambio : precio;
  const precioUSD = sim.moneda === "USD" ? precio : precio / sim.tipoCambio;

  const descuentoSobrePublicado =
    sim.precioPublicado === 0
      ? 0
      : ((sim.precioPublicado - precio) / sim.precioPublicado) * 100;

  const deltaVendedor =
    sim.posicionVendedorMax === 0
      ? 0
      : ((precio - sim.posicionVendedorMax) / sim.posicionVendedorMax) * 100;

  const deltaComprador =
    sim.ofertaFinal === 0
      ? 0
      : ((sim.ofertaFinal - precio) / sim.ofertaFinal) * 100;

  const honCompradorARS = precioARS * (sim.honorariosComprador / 100);
  const honVendedorARS = precioARS * (sim.honorariosVendedor / 100);
  const totalHonorariosARS = honCompradorARS + honVendedorARS;

  const costoTotalComprador = precioARS + honCompradorARS;
  const neteVendedor = precioARS - honVendedorARS;

  const enZona = precio >= sim.posicionVendedorMax && precio <= sim.posicionCompradorMin;

  return {
    precioARS,
    precioUSD,
    descuentoSobrePublicado,
    deltaVendedor,
    deltaComprador,
    honCompradorARS,
    honVendedorARS,
    totalHonorariosARS,
    costoTotalComprador,
    neteVendedor,
    enZona,
  };
}

// ── Simulación vacía ──────────────────────────────────────────────────────────

function nuevaSimulacion(): SimulacionNegociacion {
  const base: Omit<SimulacionNegociacion, "escenarios"> = {
    id: uid(),
    titulo: "",
    created_at: new Date().toISOString(),
    precioPublicado: 200000,
    moneda: "USD",
    tipoCambio: 1300,
    ofertaInicial: 160000,
    ofertaFinal: 175000,
    posicionCompradorMin: 185000,
    precioMeta: 190000,
    disposicionBajar: 5,
    posicionVendedorMax: 180000,
    honorariosComprador: 3,
    honorariosVendedor: 3,
    notas: "",
  };
  return { ...base, escenarios: defaultEscenarios(base) };
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  padding: "8px 11px",
  fontFamily: "'Inter', sans-serif",
  fontSize: 13,
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 9,
  color: "rgba(255,255,255,0.38)",
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  marginBottom: 5,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 14px 0",
  fontSize: 10,
  color: "rgba(255,255,255,0.28)",
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: 20,
};

// ── SVG Zona de Negociación ───────────────────────────────────────────────────

function ZonaNegociacion({ sim }: { sim: SimulacionNegociacion }) {
  const W = 700;
  const H = 120;
  const PAD_L = 14;
  const PAD_R = 14;
  const trackW = W - PAD_L - PAD_R;
  const trackY = 60;
  const trackH = 14;

  // Puntos clave
  const minVal = Math.min(sim.ofertaInicial, sim.posicionVendedorMax) * 0.97;
  const maxVal = Math.max(sim.precioPublicado, sim.posicionCompradorMin) * 1.01;
  const range = maxVal - minVal;

  function toX(val: number): number {
    if (range === 0) return PAD_L + trackW / 2;
    return PAD_L + ((val - minVal) / range) * trackW;
  }

  const xOfertaInicial = toX(sim.ofertaInicial);
  const xOfertaFinal = toX(sim.ofertaFinal);
  const xCompradorMin = toX(sim.posicionCompradorMin);
  const xVendedorMax = toX(sim.posicionVendedorMax);
  const xPublicado = toX(sim.precioPublicado);

  const hasOverlap = sim.posicionCompradorMin >= sim.posicionVendedorMax;
  const overlapLeft = hasOverlap ? Math.min(xCompradorMin, xVendedorMax) : 0;
  const overlapRight = hasOverlap ? Math.max(xCompradorMin, xVendedorMax) : 0;

  const SCENARIO_COLORS = ["#a78bfa", "#38bdf8", "#fb923c", "#34d399", "#f472b6"];

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block", minWidth: W }}>
        {/* Track fondo */}
        <rect x={PAD_L} y={trackY - trackH / 2} width={trackW} height={trackH} rx={6} fill="rgba(255,255,255,0.04)" />

        {/* Zona overlap (verde) */}
        {hasOverlap && overlapRight > overlapLeft && (
          <rect
            x={overlapLeft}
            y={trackY - trackH / 2}
            width={overlapRight - overlapLeft}
            height={trackH}
            rx={3}
            fill="rgba(34,197,94,0.22)"
          />
        )}

        {/* Línea de track */}
        <line x1={PAD_L} y1={trackY} x2={PAD_L + trackW} y2={trackY} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

        {/* Punto oferta inicial (comprador) */}
        <circle cx={xOfertaInicial} cy={trackY} r={7} fill="#3b82f6" stroke="#0a0a0a" strokeWidth={2} />
        <text x={xOfertaInicial} y={trackY - 14} textAnchor="middle" fill="#3b82f6" fontSize={8} fontFamily="Inter, sans-serif">
          Of. inicial
        </text>
        <text x={xOfertaInicial} y={H - 4} textAnchor="middle" fill="rgba(59,130,246,0.7)" fontSize={7} fontFamily="Inter, sans-serif">
          {(sim.ofertaInicial / 1000).toFixed(0)}k
        </text>

        {/* Punto posición comprador max */}
        <rect x={xCompradorMin - 2} y={trackY - trackH / 2 - 4} width={4} height={trackH + 8} rx={2} fill="#60a5fa" />
        <text x={xCompradorMin} y={trackY - 22} textAnchor="middle" fill="#60a5fa" fontSize={8} fontFamily="Inter, sans-serif">
          Comp. máx
        </text>
        <text x={xCompradorMin} y={H - 4} textAnchor="middle" fill="rgba(96,165,250,0.7)" fontSize={7} fontFamily="Inter, sans-serif">
          {(sim.posicionCompradorMin / 1000).toFixed(0)}k
        </text>

        {/* Punto posición vendedor min */}
        <rect x={xVendedorMax - 2} y={trackY - trackH / 2 - 4} width={4} height={trackH + 8} rx={2} fill="#f97316" />
        <text x={xVendedorMax} y={trackY - 22} textAnchor="middle" fill="#f97316" fontSize={8} fontFamily="Inter, sans-serif">
          Vend. mín
        </text>
        <text x={xVendedorMax} y={H - 4} textAnchor="middle" fill="rgba(249,115,22,0.7)" fontSize={7} fontFamily="Inter, sans-serif">
          {(sim.posicionVendedorMax / 1000).toFixed(0)}k
        </text>

        {/* Punto oferta final comprador */}
        <circle cx={xOfertaFinal} cy={trackY} r={5} fill="rgba(59,130,246,0.5)" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="2,2" />

        {/* Precio publicado */}
        <circle cx={xPublicado} cy={trackY} r={7} fill="#cc0000" stroke="#0a0a0a" strokeWidth={2} />
        <text x={xPublicado} y={trackY - 14} textAnchor="middle" fill="#cc0000" fontSize={8} fontFamily="Inter, sans-serif">
          Publicado
        </text>
        <text x={xPublicado} y={H - 4} textAnchor="middle" fill="rgba(204,0,0,0.7)" fontSize={7} fontFamily="Inter, sans-serif">
          {(sim.precioPublicado / 1000).toFixed(0)}k
        </text>

        {/* Marcas de escenarios */}
        {sim.escenarios.map((esc, i) => {
          const x = toX(esc.precioAcuerdo);
          const col = SCENARIO_COLORS[i % SCENARIO_COLORS.length];
          return (
            <g key={esc.id}>
              <line x1={x} y1={trackY - trackH / 2 - 6} x2={x} y2={trackY + trackH / 2 + 6} stroke={col} strokeWidth={1.5} strokeDasharray="3,2" />
              <text x={x} y={trackY - trackH / 2 - 10} textAnchor="middle" fill={col} fontSize={7} fontFamily="Montserrat, sans-serif" fontWeight={700}>
                {esc.nombre.split("—")[0].trim()}
              </text>
            </g>
          );
        })}

        {/* Sin overlap */}
        {!hasOverlap && (
          <text x={W / 2} y={H - 6} textAnchor="middle" fill="rgba(204,0,0,0.6)" fontSize={9} fontFamily="Inter, sans-serif">
            No hay zona de acuerdo visible entre las posiciones
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Formulario de simulación ──────────────────────────────────────────────────

interface FormularioProps {
  sim: SimulacionNegociacion;
  onChange: (sim: SimulacionNegociacion) => void;
  onGuardar: () => void;
  onAnalizar: () => void;
}

function FormularioSimulacion({ sim, onChange, onGuardar, onAnalizar }: FormularioProps) {
  function set<K extends keyof SimulacionNegociacion>(key: K, value: SimulacionNegociacion[K]) {
    onChange({ ...sim, [key]: value });
  }

  function setNum(key: keyof SimulacionNegociacion, value: string) {
    const n = parseFloat(value);
    if (!isNaN(n)) set(key, n as SimulacionNegociacion[typeof key]);
  }

  function recalcEscenarios(updated: SimulacionNegociacion): SimulacionNegociacion {
    const defaults = defaultEscenarios(updated);
    // Only update the 3 auto-calculated ones (indices 0, 1, 2) if they match the default names
    const AUTO_NAMES = [
      "Escenario A — Oferta del comprador",
      "Escenario B — Punto medio",
      "Escenario C — Meta del vendedor",
    ];
    const newEscenarios = updated.escenarios.map((esc, i) => {
      if (i < 3 && AUTO_NAMES.includes(esc.nombre)) {
        return { ...esc, precioAcuerdo: defaults[i].precioAcuerdo };
      }
      return esc;
    });
    return { ...updated, escenarios: newEscenarios };
  }

  function handleNumericChange(key: keyof SimulacionNegociacion, value: string) {
    const n = parseFloat(value);
    if (isNaN(n)) return;
    const updated = { ...sim, [key]: n };
    onChange(recalcEscenarios(updated));
  }

  function addEscenario() {
    const esc: EscenarioNegociacion = {
      id: uid(),
      nombre: `Escenario personalizado ${sim.escenarios.length + 1}`,
      precioAcuerdo: sim.posicionVendedorMax,
      descripcion: "",
    };
    set("escenarios", [...sim.escenarios, esc]);
  }

  function updateEscenario(id: string, key: keyof EscenarioNegociacion, value: string | number) {
    set(
      "escenarios",
      sim.escenarios.map((e) => (e.id === id ? { ...e, [key]: value } : e))
    );
  }

  function removeEscenario(id: string) {
    set("escenarios", sim.escenarios.filter((e) => e.id !== id));
  }

  const btnPrimary: React.CSSProperties = {
    padding: "9px 22px",
    borderRadius: 8,
    background: "#cc0000",
    border: "none",
    color: "#fff",
    fontSize: 12,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.04em",
  };

  const btnSecondary: React.CSSProperties = {
    padding: "9px 22px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Datos generales */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Datos generales</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Título de la operación</label>
            <input
              type="text"
              value={sim.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Ej: Depto. Pellegrini 123"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Precio publicado (USD)</label>
            <input
              type="number"
              step={1000}
              value={sim.precioPublicado}
              onChange={(e) => handleNumericChange("precioPublicado", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Moneda</label>
            <select
              value={sim.moneda}
              onChange={(e) => set("moneda", e.target.value as "USD" | "ARS")}
              style={inputStyle}
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tipo de cambio (ARS/USD)</label>
            <input
              type="number"
              step={10}
              value={sim.tipoCambio}
              onChange={(e) => setNum("tipoCambio", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Posición del comprador */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Posición del comprador</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Oferta inicial (USD)</label>
            <input
              type="number"
              step={1000}
              value={sim.ofertaInicial}
              onChange={(e) => handleNumericChange("ofertaInicial", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Oferta final objetivo (USD)</label>
            <input
              type="number"
              step={1000}
              value={sim.ofertaFinal}
              onChange={(e) => handleNumericChange("ofertaFinal", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Máximo que pagaría (USD)</label>
            <input
              type="number"
              step={1000}
              value={sim.posicionCompradorMin}
              onChange={(e) => handleNumericChange("posicionCompradorMin", e.target.value)}
              style={inputStyle}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Inter', sans-serif" }}>
              Límite real: no pagaría más que este valor
            </p>
          </div>
        </div>
      </div>

      {/* Posición del vendedor */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Posición del vendedor</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Precio meta (USD)</label>
            <input
              type="number"
              step={1000}
              value={sim.precioMeta}
              onChange={(e) => handleNumericChange("precioMeta", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Disposición a bajar (%)</label>
            <input
              type="number"
              step={0.5}
              value={sim.disposicionBajar}
              onChange={(e) => setNum("disposicionBajar", e.target.value)}
              style={inputStyle}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Inter', sans-serif" }}>
              Estimado: % máx que cedería el vendedor
            </p>
          </div>
          <div>
            <label style={labelStyle}>Mínimo que aceptaría (USD)</label>
            <input
              type="number"
              step={1000}
              value={sim.posicionVendedorMax}
              onChange={(e) => handleNumericChange("posicionVendedorMax", e.target.value)}
              style={inputStyle}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'Inter', sans-serif" }}>
              Piso real: no aceptaría menos que este valor
            </p>
          </div>
        </div>
      </div>

      {/* Comisiones */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Comisiones</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Honorarios comprador (%)</label>
            <input
              type="number"
              step={0.5}
              value={sim.honorariosComprador}
              onChange={(e) => setNum("honorariosComprador", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Honorarios vendedor (%)</label>
            <input
              type="number"
              step={0.5}
              value={sim.honorariosVendedor}
              onChange={(e) => setNum("honorariosVendedor", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Escenarios */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Escenarios de negociación</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sim.escenarios.map((esc, i) => {
            const COLORS = ["#a78bfa", "#38bdf8", "#fb923c", "#34d399", "#f472b6"];
            const col = COLORS[i % COLORS.length];
            return (
              <div
                key={esc.id}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${col}22`,
                  borderRadius: 10,
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label style={{ ...labelStyle, color: col }}>Nombre del escenario</label>
                    <input
                      type="text"
                      value={esc.nombre}
                      onChange={(e) => updateEscenario(esc.id, "nombre", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Descripción</label>
                    <input
                      type="text"
                      value={esc.descripcion}
                      onChange={(e) => updateEscenario(esc.id, "descripcion", e.target.value)}
                      placeholder="Comentario libre"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ minWidth: 140 }}>
                  <label style={labelStyle}>Precio de acuerdo (USD)</label>
                  <input
                    type="number"
                    step={1000}
                    value={esc.precioAcuerdo}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (!isNaN(n)) updateEscenario(esc.id, "precioAcuerdo", n);
                    }}
                    style={{ ...inputStyle, width: 140 }}
                  />
                </div>
                <button
                  onClick={() => removeEscenario(esc.id)}
                  style={{ marginTop: 18, padding: "7px 10px", borderRadius: 8, background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.2)", color: "rgba(204,0,0,0.6)", fontSize: 11, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={addEscenario}
          style={{ marginTop: 12, padding: "7px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, cursor: "pointer" }}
        >
          + Agregar escenario personalizado
        </button>
      </div>

      {/* Notas */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Notas libres</p>
        <textarea
          value={sim.notas}
          onChange={(e) => set("notas", e.target.value)}
          placeholder="Contexto de la negociación, observaciones del corredor..."
          rows={4}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
        />
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={onGuardar} style={btnSecondary}>Guardar</button>
        <button onClick={onAnalizar} style={btnPrimary}>Analizar escenarios →</button>
      </div>
    </div>
  );
}

// ── Panel de análisis ─────────────────────────────────────────────────────────

function PanelAnalisis({ sim }: { sim: SimulacionNegociacion }) {
  const resultados = useMemo(
    () => sim.escenarios.map((esc) => ({ esc, res: calcularEscenario(sim, esc.precioAcuerdo) })),
    [sim]
  );

  const COLORS = ["#a78bfa", "#38bdf8", "#fb923c", "#34d399", "#f472b6"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Zona de negociación SVG */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Zona de negociación</p>
        <ZonaNegociacion sim={sim} />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
          {[
            { dot: "#3b82f6", label: "Oferta inicial comprador" },
            { dot: "#60a5fa", label: "Posición máx. comprador" },
            { dot: "#f97316", label: "Posición mín. vendedor" },
            { dot: "#cc0000", label: "Precio publicado" },
            { dot: "rgba(34,197,94,0.5)", label: "Zona de acuerdo", rect: true },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {item.rect ? (
                <div style={{ width: 14, height: 10, background: item.dot, borderRadius: 2 }} />
              ) : (
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.dot }} />
              )}
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Inter', sans-serif" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cards por escenario */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {resultados.map(({ esc, res }, i) => {
          const col = COLORS[i % COLORS.length];
          return (
            <div
              key={esc.id}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${col}30`,
                borderRadius: 14,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Header */}
              <div>
                <p style={{ margin: "0 0 4px 0", fontSize: 11, color: col, fontFamily: "'Montserrat', sans-serif", fontWeight: 800, letterSpacing: "0.04em" }}>
                  {esc.nombre}
                </p>
                {esc.descripcion && (
                  <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>
                    {esc.descripcion}
                  </p>
                )}
              </div>

              {/* Precio principal */}
              <div style={{ padding: "12px 0", borderTop: `1px solid ${col}18`, borderBottom: `1px solid ${col}18` }}>
                <p style={{ margin: "0 0 2px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Precio de acuerdo</p>
                <p style={{ margin: 0, fontSize: 24, fontFamily: "'Montserrat', sans-serif", fontWeight: 800, color: "#fff" }}>
                  USD {fmt(res.precioUSD)}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Inter', sans-serif" }}>
                  ARS {fmt(res.precioARS)}
                </p>
              </div>

              {/* KPIs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Descuento s/publicado", val: fmtPct(res.descuentoSobrePublicado), highlight: res.descuentoSobrePublicado > 5 },
                  { label: "Costo total comprador", val: `ARS ${fmt(res.costoTotalComprador)}`, sub: `(incluye hon. ${fmtPct(sim.honorariosComprador)})` },
                  { label: "Neto vendedor", val: `ARS ${fmt(res.neteVendedor)}`, sub: `(neto de hon. ${fmtPct(sim.honorariosVendedor)})` },
                  { label: "Honorarios totales", val: `ARS ${fmt(res.totalHonorariosARS)}` },
                  { label: "Delta vendedor vs piso", val: `${res.deltaVendedor >= 0 ? "+" : ""}${fmtPct(res.deltaVendedor)}`, color: res.deltaVendedor >= 0 ? "#22c55e" : "#cc0000" },
                  { label: "Delta comprador vs meta", val: `${res.deltaComprador >= 0 ? "+" : ""}${fmtPct(res.deltaComprador)}`, color: res.deltaComprador >= 0 ? "#22c55e" : "#cc0000" },
                ].map((kpi) => (
                  <div key={kpi.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", fontFamily: "'Inter', sans-serif" }}>{kpi.label}</span>
                      {kpi.sub && <p style={{ margin: 0, fontSize: 8, color: "rgba(255,255,255,0.22)", fontFamily: "'Inter', sans-serif" }}>{kpi.sub}</p>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", color: kpi.color ?? "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>
                      {kpi.val}
                    </span>
                  </div>
                ))}
              </div>

              {/* Badge zona */}
              <div>
                {res.enZona ? (
                  <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontSize: 10, fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
                    Zona de acuerdo posible
                  </span>
                ) : (
                  <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, background: "rgba(204,0,0,0.1)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 10, fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
                    Fuera de zona
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla comparativa */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Tabla comparativa</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Inter', sans-serif", fontSize: 11 }}>
            <thead>
              <tr>
                {["Escenario", "Precio USD", "Desc. s/pub.", "Costo comp. ARS", "Neto vend. ARS", "Hon. totales ARS", "Zona"].map((h) => (
                  <th
                    key={h}
                    style={{ textAlign: "left", padding: "8px 12px", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.38)", fontSize: 9, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultados.map(({ esc, res }, i) => {
                const col = COLORS[i % COLORS.length];
                return (
                  <tr key={esc.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px 12px", color: col, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", fontSize: 11, whiteSpace: "nowrap" }}>
                      {esc.nombre.split("—")[0].trim()}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#fff", fontWeight: 700 }}>
                      {fmt(res.precioUSD)}
                    </td>
                    <td style={{ padding: "10px 12px", color: res.descuentoSobrePublicado > 5 ? "#22c55e" : "rgba(255,255,255,0.6)" }}>
                      {fmtPct(res.descuentoSobrePublicado)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.7)" }}>
                      {fmt(res.costoTotalComprador)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.7)" }}>
                      {fmt(res.neteVendedor)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#a78bfa" }}>
                      {fmt(res.totalHonorariosARS)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {res.enZona ? (
                        <span style={{ color: "#22c55e", fontWeight: 700 }}>SI</span>
                      ) : (
                        <span style={{ color: "#cc0000", fontWeight: 700 }}>NO</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type Tab = "lista" | "form" | "analisis";

export default function SimuladorNegociacion() {
  const [tab, setTab] = useState<Tab>("lista");
  const [simulaciones, setSimulaciones] = useState<SimulacionNegociacion[]>([]);
  const [simActual, setSimActual] = useState<SimulacionNegociacion>(nuevaSimulacion);

  useEffect(() => {
    setSimulaciones(loadSimulaciones());
  }, []);

  const guardar = useCallback(() => {
    setSimulaciones((prev) => {
      const existe = prev.findIndex((s) => s.id === simActual.id);
      const updated = existe >= 0
        ? prev.map((s) => (s.id === simActual.id ? simActual : s))
        : [simActual, ...prev];
      saveSimulaciones(updated);
      return updated;
    });
  }, [simActual]);

  function abrirSim(sim: SimulacionNegociacion) {
    setSimActual(sim);
    setTab("form");
  }

  function abrirNueva() {
    setSimActual(nuevaSimulacion());
    setTab("form");
  }

  function eliminarSim(id: string) {
    setSimulaciones((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSimulaciones(updated);
      return updated;
    });
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "9px 20px",
    borderRadius: 8,
    border: active ? "1px solid rgba(204,0,0,0.4)" : "1px solid rgba(255,255,255,0.07)",
    background: active ? "rgba(204,0,0,0.1)" : "transparent",
    color: active ? "#cc0000" : "rgba(255,255,255,0.38)",
    fontSize: 11,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.05em",
    transition: "all 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.015)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 28px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
          ← CRM
        </Link>
        <h1 style={{ margin: 0, fontSize: 20, fontFamily: "'Montserrat', sans-serif", fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>
          Simulador de Negociación
        </h1>
        {tab !== "lista" && simActual.titulo && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'Inter', sans-serif" }}>
            — {simActual.titulo}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: "16px 28px 0", display: "flex", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button onClick={() => setTab("lista")} style={tabStyle(tab === "lista")}>
          Simulaciones guardadas ({simulaciones.length})
        </button>
        <button onClick={() => setTab("form")} style={tabStyle(tab === "form")}>
          Configurar negociación
        </button>
        <button onClick={() => setTab("analisis")} style={tabStyle(tab === "analisis")}>
          Análisis de escenarios
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "28px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Tab 1 — Lista */}
        {tab === "lista" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'Inter', sans-serif" }}>
                {simulaciones.length === 0 ? "No hay simulaciones guardadas aún." : `${simulaciones.length} simulación${simulaciones.length !== 1 ? "es" : ""} guardada${simulaciones.length !== 1 ? "s" : ""}`}
              </p>
              <button
                onClick={abrirNueva}
                style={{ padding: "9px 20px", borderRadius: 8, background: "#cc0000", border: "none", color: "#fff", fontSize: 12, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, cursor: "pointer" }}
              >
                + Nueva simulación
              </button>
            </div>

            {simulaciones.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: "center", padding: 60 }}>
                <p style={{ margin: "0 0 10px 0", fontSize: 32 }}>📊</p>
                <p style={{ margin: "0 0 6px 0", fontSize: 16, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
                  Ninguna simulación todavía
                </p>
                <p style={{ margin: "0 0 20px 0", fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "'Inter', sans-serif" }}>
                  Creá una nueva simulación para modelar escenarios de negociación
                </p>
                <button
                  onClick={abrirNueva}
                  style={{ padding: "10px 24px", borderRadius: 8, background: "#cc0000", border: "none", color: "#fff", fontSize: 12, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, cursor: "pointer" }}
                >
                  + Nueva simulación
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {simulaciones.map((sim) => {
                  const fecha = new Date(sim.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
                  const escConZona = sim.escenarios.filter((e) => {
                    const r = calcularEscenario(sim, e.precioAcuerdo);
                    return r.enZona;
                  }).length;
                  return (
                    <div
                      key={sim.id}
                      onClick={() => abrirSim(sim)}
                      style={{ ...cardStyle, cursor: "pointer", transition: "border-color 0.15s" }}
                      onMouseEnter={(ev) => { (ev.currentTarget as HTMLDivElement).style.borderColor = "rgba(204,0,0,0.3)"; }}
                      onMouseLeave={(ev) => { (ev.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: "0 0 4px 0", fontSize: 14, fontFamily: "'Montserrat', sans-serif", fontWeight: 800, color: "#fff" }}>
                            {sim.titulo || "Sin título"}
                          </p>
                          <p style={{ margin: "0 0 10px 0", fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Inter', sans-serif" }}>{fecha}</p>
                        </div>
                        <button
                          onClick={(ev) => { ev.stopPropagation(); eliminarSim(sim.id); }}
                          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 14, padding: "0 0 0 8px", lineHeight: 1 }}
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter', sans-serif" }}>Precio publicado</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#cc0000", fontFamily: "'Montserrat', sans-serif" }}>
                            {sim.moneda} {fmt(sim.precioPublicado)}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter', sans-serif" }}>Escenarios</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
                            {sim.escenarios.length} total · {escConZona} en zona
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter', sans-serif" }}>Brecha</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
                            {fmtPct(((sim.precioPublicado - sim.ofertaFinal) / sim.precioPublicado) * 100)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2 — Formulario */}
        {tab === "form" && (
          <FormularioSimulacion
            sim={simActual}
            onChange={setSimActual}
            onGuardar={guardar}
            onAnalizar={() => { guardar(); setTab("analisis"); }}
          />
        )}

        {/* Tab 3 — Análisis */}
        {tab === "analisis" && <PanelAnalisis sim={simActual} />}
      </div>
    </div>
  );
}
