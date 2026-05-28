"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── tipos ─────────────────────────────────────────────────────────────────────

interface ItemPresupuesto {
  id: string;
  nombre: string;
  categoria: string;
  monto_mensual: number;
  meses_activo: boolean[];
  es_variable: boolean;
  montos_por_mes: number[];
}

interface Presupuesto {
  anio: number;
  meta_honorarios_usd: number;
  tipo_cambio_ref: number;
  ingresos: ItemPresupuesto[];
  gastos: ItemPresupuesto[];
  updated_at: string;
}

// ── constantes ────────────────────────────────────────────────────────────────

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const CATS_GASTOS = ["Infraestructura","Marketing","Impuestos y aportes","Operativos","Capacitación","Otros"];
const CAT_COLORES: Record<string, string> = {
  "Infraestructura": "#3b82f6",
  "Marketing": "#a855f7",
  "Impuestos y aportes": "#f97316",
  "Operativos": "#eab308",
  "Capacitación": "#22c55e",
  "Otros": "#6b7280",
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}
function fmtUSD(n: number): string {
  return "USD " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * 100);
}
function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// monto efectivo de un item en un mes (0-based)
function montoItem(item: ItemPresupuesto, mes: number): number {
  if (!item.meses_activo[mes]) return 0;
  if (item.es_variable) return item.montos_por_mes[mes] ?? item.monto_mensual;
  return item.monto_mensual;
}

// ── presupuesto por defecto 2026 ──────────────────────────────────────────────

function defaultIngresos(): ItemPresupuesto[] {
  // Honorarios venta: 5 ops × $800.000, variable, estacionalidad
  const ventaMeses = [800000,800000,1600000,1600000,800000,800000,800000,1600000,1600000,2400000,2400000,1600000];
  const venta: ItemPresupuesto = {
    id: genId(),
    nombre: "Honorarios venta",
    categoria: "ingresos",
    monto_mensual: 800000,
    meses_activo: [true,true,true,true,true,true,true,true,true,true,true,true],
    es_variable: true,
    montos_por_mes: ventaMeses,
  };
  // Honorarios alquiler: 8 ops × $300.000, variable
  const alqMeses = [300000,300000,600000,300000,300000,300000,600000,300000,300000,600000,300000,600000];
  const alquiler: ItemPresupuesto = {
    id: genId(),
    nombre: "Honorarios alquiler",
    categoria: "ingresos",
    monto_mensual: 300000,
    meses_activo: [true,true,true,true,true,true,true,true,true,true,true,true],
    es_variable: true,
    montos_por_mes: alqMeses,
  };
  // Honorarios renovación: 3 ops × $150.000, fijo desde marzo
  const renov: ItemPresupuesto = {
    id: genId(),
    nombre: "Honorarios renovación",
    categoria: "ingresos",
    monto_mensual: 150000,
    meses_activo: [false,false,true,true,true,true,true,true,true,true,true,true],
    es_variable: false,
    montos_por_mes: Array(12).fill(150000) as number[],
  };
  return [venta, alquiler, renov];
}

function defaultGastos(): ItemPresupuesto[] {
  const mk = (nombre: string, cat: string, monto: number, meses: boolean[], variable = false): ItemPresupuesto => ({
    id: genId(),
    nombre,
    categoria: cat,
    monto_mensual: monto,
    meses_activo: meses,
    es_variable: variable,
    montos_por_mes: Array(12).fill(monto) as number[],
  });
  const todos: boolean[] = Array(12).fill(true) as boolean[];
  return [
    mk("Oficina / coworking",           "Infraestructura",     150000, todos),
    mk("Teléfono + internet",            "Infraestructura",      30000, todos),
    mk("Portales inmobiliarios",         "Marketing",            80000, todos),
    mk("Combustible / transporte",       "Operativos",           50000, todos, true),
    mk("Marketing digital",              "Marketing",           100000, todos),
    mk("Monotributo / aportes",          "Impuestos y aportes",  80000, todos),
    mk("Capacitación y libros",          "Capacitación",         20000, todos, true),
    mk("Seguro resp. civil",             "Infraestructura",      25000, todos),
    mk("Gastos de oficina (papelería)",  "Operativos",           15000, todos),
  ];
}

function presupuestoDefault(anio: number): Presupuesto {
  return {
    anio,
    meta_honorarios_usd: 30000,
    tipo_cambio_ref: 1200,
    ingresos: defaultIngresos(),
    gastos: defaultGastos(),
    updated_at: new Date().toISOString(),
  };
}

// ── estilos compartidos ───────────────────────────────────────────────────────

const S = {
  page: {
    background: "#0a0a0a",
    minHeight: "100vh",
    color: "#e0e0e0",
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: "24px",
  } as React.CSSProperties,
  card: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 10,
    padding: "20px",
    marginBottom: 16,
  } as React.CSSProperties,
  h1: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800,
    fontSize: 28,
    color: "#e0e0e0",
    margin: 0,
  } as React.CSSProperties,
  h2: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    color: "#e0e0e0",
    margin: "0 0 12px 0",
  } as React.CSSProperties,
  kpiLabel: {
    fontSize: 12,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  kpiValue: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800,
    fontSize: 24,
    color: "#e0e0e0",
  },
  input: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    padding: "7px 10px",
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  btn: {
    background: "#cc0000",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
  } as React.CSSProperties,
  btnSec: {
    background: "#1a1a1a",
    color: "#e0e0e0",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    border: "none",
    borderBottom: active ? "2px solid #cc0000" : "2px solid transparent",
    background: "transparent",
    color: active ? "#e0e0e0" : "#666",
    cursor: "pointer",
    fontWeight: active ? 700 : 400,
    fontSize: 14,
    fontFamily: "'Montserrat', sans-serif",
  }),
  checkbox: {
    accentColor: "#cc0000",
    width: 14,
    height: 14,
    cursor: "pointer",
  } as React.CSSProperties,
  tableHead: {
    background: "#161616",
    color: "#888",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalBox: {
    background: "#111111",
    border: "1px solid #333",
    borderRadius: 12,
    padding: 28,
    maxWidth: 480,
    width: "90%",
  } as React.CSSProperties,
};

// ── componente principal ──────────────────────────────────────────────────────

export default function PresupuestoAnualPage() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [pres, setPresRaw] = useState<Presupuesto>(presupuestoDefault(anioActual));
  const [tab, setTab] = useState<0 | 1 | 2>(0);
  const [modalImportar, setModalImportar] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [loadingPres, setLoadingPres] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      const { data: row } = await supabase
        .from("crm_presupuesto_anual")
        .select("data")
        .eq("perfil_id", data.user.id)
        .eq("anio", anio)
        .maybeSingle();
      if (row?.data) {
        setPresRaw(row.data as Presupuesto);
      } else {
        setPresRaw(presupuestoDefault(anio));
      }
      setLoadingPres(false);
    });
  }, [anio]);

  const setPres = useCallback((next: Presupuesto) => {
    setPresRaw(next);
  }, []);

  // Save to Supabase whenever pres changes
  useEffect(() => {
    if (!uid || loadingPres) return;
    supabase.from("crm_presupuesto_anual").upsert(
      { perfil_id: uid, anio: pres.anio, data: pres, updated_at: new Date().toISOString() },
      { onConflict: "perfil_id,anio" }
    ).then(() => {});
  }, [pres, uid, loadingPres]);

  const cambiarAnio = (delta: number) => {
    const nuevo = anio + delta;
    setAnio(nuevo);
    setLoadingPres(true);
  };

  // ── cálculos anuales ─────────────────────────────────────────────────────

  const ingresosPorMes = useMemo(() =>
    MESES.map((_, m) => pres.ingresos.reduce((s, i) => s + montoItem(i, m), 0)),
    [pres.ingresos]
  );
  const gastosPorMes = useMemo(() =>
    MESES.map((_, m) => pres.gastos.reduce((s, g) => s + montoItem(g, m), 0)),
    [pres.gastos]
  );
  const resultadoPorMes = useMemo(() =>
    MESES.map((_, m) => ingresosPorMes[m] - gastosPorMes[m]),
    [ingresosPorMes, gastosPorMes]
  );
  const acumuladoPorMes = useMemo(() => {
    let acc = 0;
    return resultadoPorMes.map(r => { acc += r; return acc; });
  }, [resultadoPorMes]);

  const totalIngresos = ingresosPorMes.reduce((s, v) => s + v, 0);
  const totalGastos   = gastosPorMes.reduce((s, v) => s + v, 0);
  const resultadoNeto = totalIngresos - totalGastos;
  const margen        = pct(resultadoNeto, totalIngresos);
  const ingresosUSD   = totalIngresos / pres.tipo_cambio_ref;
  const cumplimientoMeta = pct(ingresosUSD, pres.meta_honorarios_usd);

  if (loadingPres) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#888", fontSize: 14 }}>Cargando presupuesto...</span>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* header */}
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <h1 style={S.h1}>Presupuesto Anual</h1>
          <p style={{ color:"#666", margin:"4px 0 0", fontSize:13 }}>
            Planificación de ingresos y gastos profesionales del corredor
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button style={S.btnSec} onClick={() => cambiarAnio(-1)}>←</button>
          <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:22, minWidth:60, textAlign:"center" }}>
            {anio}
          </span>
          <button style={S.btnSec} onClick={() => cambiarAnio(1)}>→</button>
        </div>
      </div>

      {/* tabs */}
      <div style={{ borderBottom:"1px solid #222", marginBottom:24 }}>
        {(["Resumen anual","Ingresos","Gastos"] as const).map((label, i) => (
          <button key={i} style={S.tab(tab === i)} onClick={() => setTab(i as 0|1|2)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <TabResumen
          pres={pres}
          setPres={setPres}
          ingresosPorMes={ingresosPorMes}
          gastosPorMes={gastosPorMes}
          resultadoPorMes={resultadoPorMes}
          acumuladoPorMes={acumuladoPorMes}
          totalIngresos={totalIngresos}
          totalGastos={totalGastos}
          resultadoNeto={resultadoNeto}
          margen={margen}
          ingresosUSD={ingresosUSD}
          cumplimientoMeta={cumplimientoMeta}
        />
      )}
      {tab === 1 && (
        <TabIngresos
          pres={pres}
          setPres={setPres}
          ingresosPorMes={ingresosPorMes}
          totalIngresos={totalIngresos}
          ingresosUSD={ingresosUSD}
          cumplimientoMeta={cumplimientoMeta}
          onModalImportar={() => setModalImportar(true)}
        />
      )}
      {tab === 2 && (
        <TabGastos
          pres={pres}
          setPres={setPres}
          gastosPorMes={gastosPorMes}
          totalGastos={totalGastos}
        />
      )}

      {/* modal importar */}
      {modalImportar && (
        <div style={S.overlay} onClick={() => setModalImportar(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={S.h2}>Importar desde historial</h2>
            <p style={{ color:"#aaa", fontSize:13, lineHeight:1.6 }}>
              Esta función te permitirá conectar el presupuesto con tu historial de operaciones para
              pre-completar los ingresos proyectados en base a tu actividad real de los últimos 12 meses.
            </p>
            <p style={{ color:"#aaa", fontSize:13, lineHeight:1.6, marginTop:8 }}>
              Para activarla, asegurate de tener cargadas tus operaciones en el módulo{" "}
              <strong style={{ color:"#e0e0e0" }}>Historial de Operaciones</strong>. La integración
              estará disponible próximamente.
            </p>
            <div style={{ marginTop:20, textAlign:"right" }}>
              <button style={S.btn} onClick={() => setModalImportar(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 1: Resumen ────────────────────────────────────────────────────────────

interface TabResumenProps {
  pres: Presupuesto;
  setPres: (p: Presupuesto) => void;
  ingresosPorMes: number[];
  gastosPorMes: number[];
  resultadoPorMes: number[];
  acumuladoPorMes: number[];
  totalIngresos: number;
  totalGastos: number;
  resultadoNeto: number;
  margen: number;
  ingresosUSD: number;
  cumplimientoMeta: number;
}

function TabResumen({ pres, setPres, ingresosPorMes, gastosPorMes, resultadoPorMes, acumuladoPorMes, totalIngresos, totalGastos, resultadoNeto, margen, ingresosUSD, cumplimientoMeta }: TabResumenProps) {
  return (
    <div>
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
        <KpiCard label="Ingresos proyectados" value={fmtARS(totalIngresos)} sub={fmtUSD(ingresosUSD)} />
        <KpiCard label="Gastos proyectados" value={fmtARS(totalGastos)} color="#cc4444" />
        <KpiCard label="Resultado neto" value={fmtARS(resultadoNeto)} color={resultadoNeto >= 0 ? "#22c55e" : "#cc0000"} />
        <KpiCard label="Margen neto" value={margen + "%"} color={margen >= 40 ? "#22c55e" : margen >= 20 ? "#eab308" : "#cc0000"} />
        <KpiCard label="Cumplimiento meta USD" value={cumplimientoMeta + "%"} sub={`Meta: ${fmtUSD(pres.meta_honorarios_usd)}`} color={cumplimientoMeta >= 100 ? "#22c55e" : "#eab308"} />
      </div>

      {/* tipo de cambio */}
      <div style={{ ...S.card, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <span style={{ fontSize:13, color:"#888" }}>Tipo de cambio de referencia (ARS/USD):</span>
        <input
          type="number"
          style={{ ...S.input, width:120 }}
          value={pres.tipo_cambio_ref}
          onChange={e => setPres({ ...pres, tipo_cambio_ref: Number(e.target.value) || 1 })}
        />
      </div>

      {/* gráfico */}
      <div style={S.card}>
        <h2 style={S.h2}>Proyección mensual</h2>
        <GraficoBarras
          ingresosPorMes={ingresosPorMes}
          gastosPorMes={gastosPorMes}
          acumuladoPorMes={acumuladoPorMes}
        />
      </div>

      {/* tabla mensual */}
      <div style={S.card}>
        <h2 style={S.h2}>Tabla mensual</h2>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={S.tableHead}>
                {["Mes","Ingresos","Gastos","Resultado","Acumulado"].map(h => (
                  <th key={h} style={{ padding:"8px 12px", textAlign:"right", fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MESES_FULL.map((mes, m) => (
                <tr key={m} style={{ borderBottom:"1px solid #1a1a1a" }}>
                  <td style={{ padding:"7px 12px", color:"#aaa" }}>{mes}</td>
                  <td style={{ padding:"7px 12px", textAlign:"right", color:"#22c55e" }}>{fmtARS(ingresosPorMes[m])}</td>
                  <td style={{ padding:"7px 12px", textAlign:"right", color:"#cc4444" }}>{fmtARS(gastosPorMes[m])}</td>
                  <td style={{ padding:"7px 12px", textAlign:"right", color: resultadoPorMes[m] >= 0 ? "#22c55e" : "#cc0000" }}>
                    {fmtARS(resultadoPorMes[m])}
                  </td>
                  <td style={{ padding:"7px 12px", textAlign:"right", color: acumuladoPorMes[m] >= 0 ? "#4ade80" : "#f87171" }}>
                    {fmtARS(acumuladoPorMes[m])}
                  </td>
                </tr>
              ))}
              <tr style={{ background:"#161616", fontWeight:700 }}>
                <td style={{ padding:"7px 12px" }}>TOTAL</td>
                <td style={{ padding:"7px 12px", textAlign:"right", color:"#22c55e" }}>{fmtARS(totalIngresos)}</td>
                <td style={{ padding:"7px 12px", textAlign:"right", color:"#cc4444" }}>{fmtARS(totalGastos)}</td>
                <td style={{ padding:"7px 12px", textAlign:"right", color: resultadoNeto >= 0 ? "#22c55e" : "#cc0000" }}>{fmtARS(resultadoNeto)}</td>
                <td style={{ padding:"7px 12px", textAlign:"right" }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = "#e0e0e0" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={S.card}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={{ ...S.kpiValue, color }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// ── Gráfico barras agrupadas + línea acumulado ────────────────────────────────

function GraficoBarras({ ingresosPorMes, gastosPorMes, acumuladoPorMes }: {
  ingresosPorMes: number[];
  gastosPorMes: number[];
  acumuladoPorMes: number[];
}) {
  const W = 720, H = 280;
  const padL = 60, padR = 20, padT = 20, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const allVals = [...ingresosPorMes, ...gastosPorMes, ...acumuladoPorMes, 0];
  const maxVal = Math.max(...allVals);
  const minVal = Math.min(...allVals);
  const range = maxVal - minVal || 1;

  const scaleY = (v: number) => padT + innerH - ((v - minVal) / range) * innerH;

  const colW = innerW / 12;
  const barW = colW * 0.3;

  const pts = acumuladoPorMes.map((v, i) => {
    const x = padL + i * colW + colW / 2;
    const y = scaleY(v);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ overflowX:"auto" }}>
      <svg width={W} height={H} style={{ display:"block", maxWidth:"100%" }} viewBox={`0 0 ${W} ${H}`}>
        {/* grid lines */}
        {[0,0.25,0.5,0.75,1].map(f => {
          const yVal = minVal + f * range;
          const y = scaleY(yVal);
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#222" strokeWidth={1} />
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={10} fill="#555">
                {Math.round(yVal / 1000)}k
              </text>
            </g>
          );
        })}

        {/* barras */}
        {MESES.map((mes, i) => {
          const cx = padL + i * colW + colW / 2;
          const yIng = scaleY(ingresosPorMes[i]);
          const yGas = scaleY(gastosPorMes[i]);
          const y0   = scaleY(0);
          return (
            <g key={i}>
              {/* ingresos — verde */}
              <rect
                x={cx - barW - 1}
                y={Math.min(yIng, y0)}
                width={barW}
                height={Math.abs(yIng - y0)}
                fill="#22c55e"
                opacity={0.85}
                rx={2}
              />
              {/* gastos — rojo */}
              <rect
                x={cx + 1}
                y={Math.min(yGas, y0)}
                width={barW}
                height={Math.abs(yGas - y0)}
                fill="#cc0000"
                opacity={0.85}
                rx={2}
              />
              {/* etiqueta mes */}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill="#666">{mes}</text>
            </g>
          );
        })}

        {/* línea acumulado */}
        <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
        {acumuladoPorMes.map((v, i) => {
          const x = padL + i * colW + colW / 2;
          const y = scaleY(v);
          return <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" />;
        })}

        {/* eje 0 */}
        {minVal < 0 && (
          <line x1={padL} y1={scaleY(0)} x2={W - padR} y2={scaleY(0)} stroke="#444" strokeWidth={1} strokeDasharray="4,3" />
        )}

        {/* leyenda */}
        <rect x={padL} y={padT - 2} width={10} height={10} fill="#22c55e" rx={2} />
        <text x={padL + 14} y={padT + 8} fontSize={11} fill="#aaa">Ingresos</text>
        <rect x={padL + 80} y={padT - 2} width={10} height={10} fill="#cc0000" rx={2} />
        <text x={padL + 94} y={padT + 8} fontSize={11} fill="#aaa">Gastos</text>
        <circle cx={padL + 162} cy={padT + 3} r={5} fill="#3b82f6" />
        <text x={padL + 172} y={padT + 8} fontSize={11} fill="#aaa">Acumulado neto</text>
      </svg>
    </div>
  );
}

// ── Tab 2: Ingresos ───────────────────────────────────────────────────────────

interface TabIngresosProps {
  pres: Presupuesto;
  setPres: (p: Presupuesto) => void;
  ingresosPorMes: number[];
  totalIngresos: number;
  ingresosUSD: number;
  cumplimientoMeta: number;
  onModalImportar: () => void;
}

function TabIngresos({ pres, setPres, ingresosPorMes, totalIngresos, ingresosUSD, cumplimientoMeta, onModalImportar }: TabIngresosProps) {
  const [expandido, setExpandido] = useState<string | null>(null);

  const actualizarItem = (id: string, fn: (item: ItemPresupuesto) => ItemPresupuesto) => {
    setPres({ ...pres, ingresos: pres.ingresos.map(i => i.id === id ? fn(i) : i) });
  };

  const eliminar = (id: string) => {
    setPres({ ...pres, ingresos: pres.ingresos.filter(i => i.id !== id) });
  };

  const agregar = () => {
    const nuevo: ItemPresupuesto = {
      id: genId(),
      nombre: "Nuevo ingreso",
      categoria: "ingresos",
      monto_mensual: 100000,
      meses_activo: Array(12).fill(true) as boolean[],
      es_variable: false,
      montos_por_mes: Array(12).fill(100000) as number[],
    };
    setPres({ ...pres, ingresos: [...pres.ingresos, nuevo] });
    setExpandido(nuevo.id);
  };

  // meta indicador
  const opsNecesarias = Math.ceil(pres.meta_honorarios_usd / (pres.meta_honorarios_usd > 0 ? 800 : 1));
  const promHonorariosVenta = 800000 / pres.tipo_cambio_ref;
  const opsParaMeta = pres.meta_honorarios_usd / (promHonorariosVenta || 1);

  return (
    <div>
      {/* meta honorarios */}
      <div style={S.card}>
        <h2 style={S.h2}>Meta anual de honorarios (USD)</h2>
        <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap", marginBottom:16 }}>
          <div style={{ flex:1, minWidth:200 }}>
            <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4 }}>Meta en USD</label>
            <input
              type="number"
              style={{ ...S.input, width:180 }}
              value={pres.meta_honorarios_usd}
              onChange={e => setPres({ ...pres, meta_honorarios_usd: Number(e.target.value) || 0 })}
            />
          </div>
          <div style={{ flex:2, minWidth:240 }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>
              Necesitás aprox. <strong style={{ color:"#e0e0e0" }}>{Math.ceil(opsParaMeta)}</strong> operaciones de venta promedio para alcanzarla
            </div>
            <div style={{ fontSize:12, color:"#666", marginBottom:8 }}>
              (basado en honorario promedio de venta: {fmtUSD(promHonorariosVenta)})
            </div>
            <div style={{ background:"#1a1a1a", borderRadius:999, height:10, overflow:"hidden" }}>
              <div style={{ width: Math.min(100, cumplimientoMeta) + "%", height:"100%", background: cumplimientoMeta >= 100 ? "#22c55e" : "#cc0000", borderRadius:999, transition:"width .3s" }} />
            </div>
            <div style={{ fontSize:12, color:"#888", marginTop:4 }}>
              Proyección: {fmtUSD(ingresosUSD)} ({cumplimientoMeta}% de la meta)
            </div>
          </div>
        </div>
      </div>

      {/* acciones */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <button style={S.btn} onClick={agregar}>+ Agregar ingreso</button>
        <button style={S.btnSec} onClick={onModalImportar}>Importar desde historial</button>
      </div>

      {/* items */}
      {pres.ingresos.map(item => (
        <ItemEditor
          key={item.id}
          item={item}
          expandido={expandido === item.id}
          onToggle={() => setExpandido(expandido === item.id ? null : item.id)}
          onUpdate={fn => actualizarItem(item.id, fn)}
          onEliminar={() => eliminar(item.id)}
          categoriaOptions={["ingresos"]}
        />
      ))}

      {/* totales por mes */}
      <div style={S.card}>
        <h2 style={S.h2}>Totales por mes</h2>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={S.tableHead}>
                {MESES.map(m => (
                  <th key={m} style={{ padding:"6px 8px", textAlign:"right", fontWeight:600 }}>{m}</th>
                ))}
                <th style={{ padding:"6px 8px", textAlign:"right", fontWeight:600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {ingresosPorMes.map((v, i) => (
                  <td key={i} style={{ padding:"6px 8px", textAlign:"right", color:"#22c55e" }}>
                    {fmtARS(v)}
                  </td>
                ))}
                <td style={{ padding:"6px 8px", textAlign:"right", color:"#22c55e", fontWeight:700 }}>
                  {fmtARS(totalIngresos)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Gastos ─────────────────────────────────────────────────────────────

interface TabGastosProps {
  pres: Presupuesto;
  setPres: (p: Presupuesto) => void;
  gastosPorMes: number[];
  totalGastos: number;
}

function TabGastos({ pres, setPres, gastosPorMes, totalGastos }: TabGastosProps) {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [opsCerradas, setOpsCerradas] = useState(12);

  const actualizarItem = (id: string, fn: (item: ItemPresupuesto) => ItemPresupuesto) => {
    setPres({ ...pres, gastos: pres.gastos.map(g => g.id === id ? fn(g) : g) });
  };

  const eliminar = (id: string) => {
    setPres({ ...pres, gastos: pres.gastos.filter(g => g.id !== id) });
  };

  const agregar = () => {
    const nuevo: ItemPresupuesto = {
      id: genId(),
      nombre: "Nuevo gasto",
      categoria: "Operativos",
      monto_mensual: 10000,
      meses_activo: Array(12).fill(true) as boolean[],
      es_variable: false,
      montos_por_mes: Array(12).fill(10000) as number[],
    };
    setPres({ ...pres, gastos: [...pres.gastos, nuevo] });
    setExpandido(nuevo.id);
  };

  // por categoría
  const porCat = useMemo(() => {
    return CATS_GASTOS.map(cat => {
      const items = pres.gastos.filter(g => g.categoria === cat);
      const total = items.reduce((s, g) => s + MESES.reduce((ss, _, m) => ss + montoItem(g, m), 0), 0);
      return { cat, items, total };
    }).filter(c => c.items.length > 0 || false);
  }, [pres.gastos]);

  // top 3
  const top3 = useMemo(() => {
    return [...pres.gastos]
      .map(g => ({ g, total: MESES.reduce((s, _, m) => s + montoItem(g, m), 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [pres.gastos]);

  const gastoPorOp = opsCerradas > 0 ? totalGastos / opsCerradas : 0;
  const gastoMensualProm = totalGastos / 12;

  // donut datos
  const donutItems = CATS_GASTOS.map(cat => {
    const total = pres.gastos.filter(g => g.categoria === cat)
      .reduce((s, g) => s + MESES.reduce((ss, _, m) => ss + montoItem(g, m), 0), 0);
    return { cat, total };
  }).filter(d => d.total > 0);
  const donutTotal = donutItems.reduce((s, d) => s + d.total, 0);

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <button style={S.btn} onClick={agregar}>+ Agregar gasto</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        {/* donut */}
        <div style={S.card}>
          <h2 style={S.h2}>Distribución por categoría</h2>
          <DonutGastos items={donutItems} total={donutTotal} />
        </div>

        {/* análisis */}
        <div style={S.card}>
          <h2 style={S.h2}>Análisis de gastos</h2>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>
              Top 3 gastos más altos
            </div>
            {top3.map(({ g, total }, i) => (
              <div key={g.id} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #1a1a1a", fontSize:13 }}>
                <span style={{ color: i === 0 ? "#cc0000" : i === 1 ? "#f97316" : "#eab308" }}>
                  {i + 1}. {g.nombre}
                </span>
                <span style={{ color:"#aaa" }}>{fmtARS(total)}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>Operaciones cerradas en el año (para cálculo)</div>
            <input
              type="number"
              style={{ ...S.input, width:100 }}
              value={opsCerradas}
              onChange={e => setOpsCerradas(Number(e.target.value) || 1)}
            />
          </div>
          <div style={{ fontSize:13, marginBottom:6 }}>
            <span style={{ color:"#888" }}>Gasto promedio por operación: </span>
            <span style={{ color:"#e0e0e0", fontWeight:600 }}>{fmtARS(gastoPorOp)}</span>
          </div>
          <div style={{ fontSize:13 }}>
            <span style={{ color:"#888" }}>Punto de equilibrio mensual: </span>
            <span style={{ color:"#eab308", fontWeight:600 }}>{fmtARS(gastoMensualProm)}</span>
            <div style={{ fontSize:11, color:"#555", marginTop:2 }}>
              (ingreso mínimo mensual para cubrir todos los gastos)
            </div>
          </div>
        </div>
      </div>

      {/* items por categoría */}
      {CATS_GASTOS.map(cat => {
        const catItems = pres.gastos.filter(g => g.categoria === cat);
        if (catItems.length === 0) return null;
        const catTotal = catItems.reduce((s, g) => s + MESES.reduce((ss, _, m) => ss + montoItem(g, m), 0), 0);
        return (
          <div key={cat} style={{ marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0 4px" }}>
              <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:14, color: CAT_COLORES[cat] ?? "#e0e0e0" }}>
                {cat}
              </span>
              <span style={{ fontSize:12, color:"#888" }}>Total anual: {fmtARS(catTotal)}</span>
            </div>
            {catItems.map(item => (
              <ItemEditor
                key={item.id}
                item={item}
                expandido={expandido === item.id}
                onToggle={() => setExpandido(expandido === item.id ? null : item.id)}
                onUpdate={fn => actualizarItem(item.id, fn)}
                onEliminar={() => eliminar(item.id)}
                categoriaOptions={CATS_GASTOS}
              />
            ))}
          </div>
        );
      })}

      {/* totales */}
      <div style={S.card}>
        <h2 style={S.h2}>Totales por mes</h2>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={S.tableHead}>
                {MESES.map(m => (
                  <th key={m} style={{ padding:"6px 8px", textAlign:"right", fontWeight:600 }}>{m}</th>
                ))}
                <th style={{ padding:"6px 8px", textAlign:"right", fontWeight:600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {gastosPorMes.map((v, i) => (
                  <td key={i} style={{ padding:"6px 8px", textAlign:"right", color:"#cc4444" }}>
                    {fmtARS(v)}
                  </td>
                ))}
                <td style={{ padding:"6px 8px", textAlign:"right", color:"#cc4444", fontWeight:700 }}>
                  {fmtARS(totalGastos)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────

function DonutGastos({ items, total }: { items: { cat: string; total: number }[]; total: number }) {
  const R = 60, CX = 90, CY = 90;
  let startAngle = -Math.PI / 2;

  const slices = items.map(({ cat, total: val }) => {
    const angle = (val / (total || 1)) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    startAngle += angle;
    const x2 = CX + R * Math.cos(startAngle);
    const y2 = CY + R * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { cat, val, x1, y1, x2, y2, large, angle };
  });

  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
      <svg width={180} height={180} style={{ flexShrink:0 }}>
        {slices.map((s, i) => (
          s.angle > 0.01 ? (
            <path
              key={i}
              d={`M ${CX} ${CY} L ${s.x1} ${s.y1} A ${R} ${R} 0 ${s.large} 1 ${s.x2} ${s.y2} Z`}
              fill={CAT_COLORES[s.cat] ?? "#444"}
              stroke="#111"
              strokeWidth={2}
            />
          ) : null
        ))}
        <circle cx={CX} cy={CY} r={34} fill="#111" />
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize={11} fill="#888">Total</text>
        <text x={CX} y={CY + 8} textAnchor="middle" fontSize={10} fill="#e0e0e0">
          {Math.round(total / 1000000)}M
        </text>
      </svg>
      <div style={{ flex:1, minWidth:140 }}>
        {items.map(({ cat, total: val }) => (
          <div key={cat} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5, fontSize:12 }}>
            <span style={{ width:10, height:10, borderRadius:2, background: CAT_COLORES[cat] ?? "#444", flexShrink:0, display:"inline-block" }} />
            <span style={{ flex:1, color:"#aaa" }}>{cat}</span>
            <span style={{ color:"#e0e0e0" }}>{total > 0 ? pct(val, total) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ItemEditor ────────────────────────────────────────────────────────────────

interface ItemEditorProps {
  item: ItemPresupuesto;
  expandido: boolean;
  onToggle: () => void;
  onUpdate: (fn: (i: ItemPresupuesto) => ItemPresupuesto) => void;
  onEliminar: () => void;
  categoriaOptions: string[];
}

function ItemEditor({ item, expandido, onToggle, onUpdate, onEliminar, categoriaOptions }: ItemEditorProps) {
  const totalAnual = MESES.reduce((s, _, m) => s + montoItem(item, m), 0);

  const setMesActivo = (m: number, val: boolean) => {
    onUpdate(i => {
      const meses_activo = [...i.meses_activo] as boolean[];
      meses_activo[m] = val;
      return { ...i, meses_activo };
    });
  };

  const setMontoPorMes = (m: number, val: number) => {
    onUpdate(i => {
      const montos_por_mes = [...i.montos_por_mes] as number[];
      montos_por_mes[m] = val;
      return { ...i, montos_por_mes };
    });
  };

  return (
    <div style={{ ...S.card, padding:0, marginBottom:6, overflow:"hidden" }}>
      {/* cabecera colapsable */}
      <div
        style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", cursor:"pointer" }}
        onClick={onToggle}
      >
        <span style={{ fontSize:16, color:"#555", userSelect:"none" }}>{expandido ? "▾" : "▸"}</span>
        <span style={{ flex:1, fontSize:14, fontWeight:600, color:"#e0e0e0" }}>{item.nombre}</span>
        <span style={{ fontSize:12, color:"#666" }}>{item.categoria}</span>
        <span style={{ fontSize:13, color:"#888", minWidth:120, textAlign:"right" }}>{fmtARS(totalAnual)} / año</span>
      </div>

      {expandido && (
        <div style={{ padding:"0 16px 16px", borderTop:"1px solid #1a1a1a" }}>
          {/* campos básicos */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10, marginBottom:14, marginTop:14 }}>
            <div>
              <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:3 }}>Nombre</label>
              <input
                style={S.input}
                value={item.nombre}
                onChange={e => onUpdate(i => ({ ...i, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:3 }}>Categoría</label>
              <select
                style={{ ...S.input }}
                value={item.categoria}
                onChange={e => onUpdate(i => ({ ...i, categoria: e.target.value }))}
              >
                {categoriaOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:3 }}>Monto mensual (ARS)</label>
              <input
                type="number"
                style={S.input}
                value={item.monto_mensual}
                onChange={e => onUpdate(i => ({ ...i, monto_mensual: Number(e.target.value) || 0 }))}
              />
            </div>
            <div style={{ display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
              <button style={{ ...S.btnSec, fontSize:11, padding:"4px 10px", color:"#cc0000", borderColor:"#cc0000" }} onClick={onEliminar}>
                Eliminar
              </button>
            </div>
          </div>

          {/* variable toggle */}
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#aaa", marginBottom:12, cursor:"pointer" }}>
            <input
              type="checkbox"
              style={S.checkbox}
              checked={item.es_variable}
              onChange={e => onUpdate(i => ({ ...i, es_variable: e.target.checked }))}
            />
            Monto variable (distinto por mes)
          </label>

          {/* grilla meses */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse", fontSize:12, minWidth:600 }}>
              <thead>
                <tr style={S.tableHead}>
                  <th style={{ padding:"5px 8px", textAlign:"left" }}>Mes</th>
                  <th style={{ padding:"5px 8px" }}>Activo</th>
                  {item.es_variable && <th style={{ padding:"5px 8px" }}>Monto</th>}
                  <th style={{ padding:"5px 8px", textAlign:"right" }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {MESES.map((mes, m) => (
                  <tr key={m} style={{ borderBottom:"1px solid #1a1a1a" }}>
                    <td style={{ padding:"4px 8px", color:"#aaa" }}>{MESES_FULL[m]}</td>
                    <td style={{ padding:"4px 8px", textAlign:"center" }}>
                      <input
                        type="checkbox"
                        style={S.checkbox}
                        checked={item.meses_activo[m]}
                        onChange={e => setMesActivo(m, e.target.checked)}
                      />
                    </td>
                    {item.es_variable && (
                      <td style={{ padding:"4px 8px" }}>
                        <input
                          type="number"
                          style={{ ...S.input, width:120 }}
                          disabled={!item.meses_activo[m]}
                          value={item.montos_por_mes[m] ?? item.monto_mensual}
                          onChange={e => setMontoPorMes(m, Number(e.target.value) || 0)}
                        />
                      </td>
                    )}
                    <td style={{ padding:"4px 8px", textAlign:"right", color: item.meses_activo[m] ? "#e0e0e0" : "#444" }}>
                      {fmtARS(montoItem(item, m))}
                    </td>
                  </tr>
                ))}
                <tr style={{ background:"#161616", fontWeight:700 }}>
                  <td colSpan={item.es_variable ? 3 : 2} style={{ padding:"5px 8px", color:"#888" }}>Total anual</td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:"#e0e0e0" }}>{fmtARS(totalAnual)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
