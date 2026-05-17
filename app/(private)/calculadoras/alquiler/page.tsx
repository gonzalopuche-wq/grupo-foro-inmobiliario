"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtARS = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtPct = (n: number, decimals = 2) =>
  (n >= 0 ? "+" : "") + n.toFixed(decimals).replace(".", ",") + "%";
const fmtMes = (iso: string) => {
  const [a, m] = iso.split("-");
  return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][parseInt(m)-1] + " " + a;
};

const addMonths = (iso: string, n: number): string => {
  const d = new Date(iso + "-01");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 7);
};

// ── tipos ─────────────────────────────────────────────────────────────────────
interface PeriodoIcl {
  mesISO: string;    // "2024-01"
  icl: string;       // valor ICL publicado por BCRA (número de índice, ej "384.52")
  manual: boolean;   // si el usuario lo cargó
}

interface CuotaCalculada {
  desde: string;     // mes ISO inicio de vigencia
  hasta: string;     // mes ISO fin de vigencia
  monto: number;
  variacion: number; // % vs cuota anterior
  esProyeccion: boolean;
}

const FRECUENCIAS = [
  { value: 3,  label: "Trimestral (cada 3 meses)" },
  { value: 4,  label: "Cuatrimestral (cada 4 meses)" },
  { value: 6,  label: "Semestral (cada 6 meses)" },
  { value: 12, label: "Anual" },
];

const DURACIONES = [
  { value: 24, label: "24 meses (2 años)" },
  { value: 36, label: "36 meses (3 años)" },
  { value: 48, label: "48 meses (4 años)" },
];

// ── componente ────────────────────────────────────────────────────────────────
export default function CalculadoraAlquilerPage() {
  const [montoInicial, setMontoInicial] = useState("200000");
  const [fechaInicio, setFechaInicio]   = useState("2025-01");
  const [duracion, setDuracion]         = useState(24);
  const [frecuencia, setFrecuencia]     = useState(3);
  const [proyeccion, setProyeccion]     = useState("15"); // % por período esperado
  const [periodos, setPeriodos]         = useState<PeriodoIcl[]>([]);
  const [activeTab, setActiveTab]       = useState<"icl" | "pct">("pct");

  // ── generar lista de meses del contrato ───────────────────────────────────
  const mesesContrato = useMemo(() => {
    const meses: string[] = [];
    for (let i = 0; i < duracion; i++) meses.push(addMonths(fechaInicio, i));
    return meses;
  }, [fechaInicio, duracion]);

  // ── ajuste automático de periodos cuando cambia fechaInicio/duracion ──────
  const initPeriodos = useCallback(() => {
    const nuevos: PeriodoIcl[] = [];
    // un período ICL por cada mes del contrato (el usuario sólo llena los que corresponden)
    for (let i = 0; i < duracion; i++) {
      const mes = addMonths(fechaInicio, i);
      const existing = periodos.find(p => p.mesISO === mes);
      nuevos.push(existing ?? { mesISO: mes, icl: "", manual: false });
    }
    setPeriodos(nuevos);
  }, [fechaInicio, duracion, periodos]);

  // Inicializar periodos si está vacío
  useMemo(() => {
    if (periodos.length === 0 && fechaInicio && duracion > 0) {
      const init: PeriodoIcl[] = [];
      for (let i = 0; i < duracion; i++) {
        init.push({ mesISO: addMonths(fechaInicio, i), icl: "", manual: false });
      }
      setPeriodos(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── calcular cuotas ──────────────────────────────────────────────────────
  const cuotas = useMemo((): CuotaCalculada[] => {
    const inicial = parseFloat(montoInicial.replace(/\./g, "").replace(",", ".")) || 0;
    if (!inicial || mesesContrato.length === 0) return [];

    const proy = parseFloat(proyeccion.replace(",", ".")) / 100 || 0;
    const result: CuotaCalculada[] = [];

    // Períodos de ajuste: mes 0, mes +frecuencia, mes +2*frecuencia, ...
    const ajusteIndices = Array.from(
      { length: Math.ceil(duracion / frecuencia) },
      (_, i) => i * frecuencia
    ).filter(i => i < duracion);

    let montoActual = inicial;

    for (let ai = 0; ai < ajusteIndices.length; ai++) {
      const inicio = ajusteIndices[ai];
      const fin    = ajusteIndices[ai + 1] ?? duracion;
      const desde  = addMonths(fechaInicio, inicio);
      const hasta  = addMonths(fechaInicio, fin - 1);

      if (ai === 0) {
        result.push({ desde, hasta, monto: montoActual, variacion: 0, esProyeccion: false });
      } else {
        // buscar ICL del mes de inicio del período anterior vs actual (si modo ICL)
        const mesAnterior = addMonths(fechaInicio, ajusteIndices[ai - 1]);
        const mesActual   = desde;

        const iclAnteriorEntry = periodos.find(p => p.mesISO === mesAnterior);
        const iclActualEntry   = periodos.find(p => p.mesISO === mesActual);

        let variacion = proy;
        let esProyeccion = true;

        if (activeTab === "icl" &&
            iclAnteriorEntry?.icl && iclActualEntry?.icl &&
            parseFloat(iclAnteriorEntry.icl) > 0) {
          const iclA = parseFloat(iclAnteriorEntry.icl);
          const iclB = parseFloat(iclActualEntry.icl);
          variacion = (iclB / iclA - 1);
          esProyeccion = false;
        }

        montoActual = montoActual * (1 + variacion);
        result.push({ desde, hasta, monto: montoActual, variacion, esProyeccion });
      }
    }
    return result;
  }, [montoInicial, fechaInicio, duracion, frecuencia, periodos, proyeccion, activeTab, mesesContrato]);

  // ── totales ────────────────────────────────────────────────────────────────
  const totales = useMemo(() => {
    if (cuotas.length === 0) return { totalPagado: 0, promedioMensual: 0, ultimaCuota: 0, variacionTotal: 0 };
    let total = 0;
    cuotas.forEach(c => {
      // cuántos meses cubre esta cuota
      const i1 = mesesContrato.indexOf(c.desde);
      const i2 = mesesContrato.indexOf(c.hasta);
      const meses = Math.max(1, i2 - i1 + 1);
      total += c.monto * meses;
    });
    const primera = cuotas[0]?.monto ?? 1;
    const ultima  = cuotas[cuotas.length - 1]?.monto ?? primera;
    return {
      totalPagado:     total,
      promedioMensual: total / duracion,
      ultimaCuota:     ultima,
      variacionTotal:  ((ultima / primera) - 1) * 100,
    };
  }, [cuotas, duracion, mesesContrato]);

  const updateIcl = (mes: string, val: string) => {
    setPeriodos(prev => prev.map(p =>
      p.mesISO === mes ? { ...p, icl: val, manual: true } : p
    ));
  };

  // meses donde aplica ajuste (inicio de cada período)
  const mesesAjuste = useMemo(() =>
    cuotas.map(c => c.desde),
  [cuotas]);

  // ── max cuota para barra SVG ───────────────────────────────────────────────
  const maxMonto = useMemo(() => Math.max(...cuotas.map(c => c.monto), 1), [cuotas]);

  // ── PDF export ─────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = cuotas.map((c, i) => `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:6px 10px">${i + 1}</td>
        <td style="padding:6px 10px">${fmtMes(c.desde)}</td>
        <td style="padding:6px 10px">${fmtMes(c.hasta)}</td>
        <td style="padding:6px 10px;text-align:right;font-weight:600">${fmtARS(c.monto)}</td>
        <td style="padding:6px 10px;text-align:right;color:${c.variacion >= 0 ? "#16a34a" : "#dc2626"}">${i === 0 ? "—" : fmtPct(c.variacion * 100)}</td>
        <td style="padding:6px 10px;text-align:center;font-size:11px;color:#666">${c.esProyeccion ? "Proyección" : "Real"}</td>
      </tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Alquiler - Proyección de cuotas</title>
    <style>body{font-family:Arial,sans-serif;color:#111;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:6px 10px;text-align:left;font-size:12px}td{font-size:13px}</style></head>
    <body><h1>Proyección de cuotas de alquiler</h1>
    <p>Monto inicial: <strong>${fmtARS(parseFloat(montoInicial)||0)}</strong> · Inicio: <strong>${fmtMes(fechaInicio)}</strong> · Duración: <strong>${duracion} meses</strong> · Ajuste: <strong>cada ${frecuencia} meses</strong></p>
    <table><thead><tr><th>#</th><th>Desde</th><th>Hasta</th><th>Cuota</th><th>Variación</th><th>Tipo</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p style="margin-top:20px"><strong>Total pagado:</strong> ${fmtARS(totales.totalPagado)} · <strong>Cuota promedio:</strong> ${fmtARS(totales.promedioMensual)} · <strong>Variación total:</strong> ${fmtPct(totales.variacionTotal)}</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const inicialNum = parseFloat(montoInicial.replace(/\./g, "").replace(",", ".")) || 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .alq-input { width:100%; padding:9px 11px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; font-size:14px; font-family:'Inter',sans-serif; outline:none; box-sizing:border-box; }
        .alq-input:focus { border-color:rgba(204,0,0,0.5); }
        .alq-select { width:100%; padding:9px 11px; background:rgba(14,14,14,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; font-size:14px; font-family:'Inter',sans-serif; outline:none; }
        .alq-label { display:block; font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:5px; font-family:'Montserrat',sans-serif; }
        .alq-btn { padding:8px 16px; border:none; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; transition:opacity 0.15s; }
        .alq-card { background:rgba(14,14,14,0.9); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:18px; }
        .alq-kpi { text-align:center; }
        .alq-kpi-n { font-family:'Montserrat',sans-serif; font-size:18px; font-weight:800; }
        .alq-kpi-l { font-size:10px; color:rgba(255,255,255,0.35); font-family:'Montserrat',sans-serif; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; margin-top:3px; }
        .alq-tab { padding:7px 16px; border-radius:4px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; border:1px solid transparent; transition:all 0.15s; }
        @media(max-width:700px){.alq-cols{flex-direction:column!important;}}
      `}</style>

      <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Navegación ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { href: "/calculadoras",              label: "Índices",          icon: "📊" },
            { href: "/calculadoras/operacion",    label: "Costos de Op.",    icon: "📋" },
            { href: "/calculadoras/rentabilidad", label: "Rentabilidad",     icon: "📈" },
            { href: "/calculadoras/credito",      label: "Crédito Hipot.",   icon: "🏦" },
            { href: "/calculadoras/alquiler",     label: "Ajuste Alquiler",  icon: "🏠", active: true },
          ].map(({ href, label, icon, active }) => (
            <Link key={href} href={href} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 6, fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
              letterSpacing: "0.06em", textDecoration: "none", transition: "all 0.15s",
              background: active ? "rgba(204,0,0,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${active ? "rgba(204,0,0,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: active ? "#cc0000" : "rgba(255,255,255,0.5)",
            }}><span style={{ fontSize: 13 }}>{icon}</span>{label}</Link>
          ))}
        </div>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#fff" }}>
              Ajuste de <span style={{ color: "#cc0000" }}>Alquiler</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
              Proyección de cuotas por ICL / índice personalizado · Ley 27.737
            </div>
          </div>
          <button className="alq-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }} onClick={exportPDF}>
            ↓ Exportar PDF
          </button>
        </div>

        {/* ── Layout principal ── */}
        <div className="alq-cols" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

          {/* ── Panel izquierdo: configuración ── */}
          <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 14 }}>

            <div className="alq-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                Datos del contrato
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="alq-label">Alquiler inicial (ARS)</label>
                <input className="alq-input" type="text" inputMode="numeric" value={montoInicial}
                  onChange={e => setMontoInicial(e.target.value.replace(/[^0-9,.]/g, ""))} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="alq-label">Mes de inicio</label>
                <input className="alq-input" type="month" value={fechaInicio}
                  onChange={e => {
                    setFechaInicio(e.target.value);
                    setPeriodos([]);
                  }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="alq-label">Duración del contrato</label>
                <select className="alq-select" value={duracion}
                  onChange={e => { setDuracion(parseInt(e.target.value)); setPeriodos([]); }}>
                  {DURACIONES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <div>
                <label className="alq-label">Frecuencia de ajuste</label>
                <select className="alq-select" value={frecuencia}
                  onChange={e => setFrecuencia(parseInt(e.target.value))}>
                  {FRECUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>

            {/* ── Método ── */}
            <div className="alq-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                Método de ajuste
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <button className="alq-tab"
                  style={{ background: activeTab === "pct" ? "rgba(204,0,0,0.12)" : "rgba(255,255,255,0.04)", color: activeTab === "pct" ? "#cc0000" : "rgba(255,255,255,0.45)", border: `1px solid ${activeTab === "pct" ? "rgba(204,0,0,0.35)" : "rgba(255,255,255,0.08)"}` }}
                  onClick={() => setActiveTab("pct")}>% Proyectado</button>
                <button className="alq-tab"
                  style={{ background: activeTab === "icl" ? "rgba(204,0,0,0.12)" : "rgba(255,255,255,0.04)", color: activeTab === "icl" ? "#cc0000" : "rgba(255,255,255,0.45)", border: `1px solid ${activeTab === "icl" ? "rgba(204,0,0,0.35)" : "rgba(255,255,255,0.08)"}` }}
                  onClick={() => setActiveTab("icl")}>ICL / Índice</button>
              </div>

              {activeTab === "pct" && (
                <div>
                  <label className="alq-label">Variación esperada por período (%)</label>
                  <input className="alq-input" type="text" inputMode="decimal" value={proyeccion}
                    onChange={e => setProyeccion(e.target.value.replace(/[^0-9,.]/g, ""))} />
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6, fontFamily: "Inter,sans-serif" }}>
                    Ej: 15% trimestral ≈ 77% anual
                  </div>
                </div>
              )}

              {activeTab === "icl" && (
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif", marginBottom: 10, lineHeight: 1.5 }}>
                    Ingresá el valor del ICL para cada mes de ajuste. Consultá en <span style={{ color: "#60a5fa" }}>bcra.gob.ar</span>. Los períodos sin dato usarán {proyeccion}% proyectado.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                    {mesesAjuste.map((mes, i) => {
                      const p = periodos.find(x => x.mesISO === mes);
                      return (
                        <div key={mes} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 11, color: i === 0 ? "#22c55e" : "rgba(255,255,255,0.5)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, minWidth: 68 }}>
                            {i === 0 ? "Inicio" : fmtMes(mes)}
                          </div>
                          {i === 0 ? (
                            <div style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>Cuota base</div>
                          ) : (
                            <input
                              className="alq-input"
                              style={{ flex: 1, padding: "6px 8px", fontSize: 12 }}
                              type="text"
                              inputMode="decimal"
                              placeholder="Valor ICL"
                              value={p?.icl ?? ""}
                              onChange={e => updateIcl(mes, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label className="alq-label">% proyectado para sin dato</label>
                    <input className="alq-input" type="text" inputMode="decimal" value={proyeccion}
                      onChange={e => setProyeccion(e.target.value.replace(/[^0-9,.]/g, ""))} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Panel derecho: resultados ── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── KPIs ── */}
            {cuotas.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {[
                  { n: fmtARS(inicialNum),               l: "Cuota inicial",      c: "#fff" },
                  { n: fmtARS(totales.ultimaCuota),       l: "Cuota final",        c: "#f59e0b" },
                  { n: fmtPct(totales.variacionTotal),    l: "Variación total",    c: totales.variacionTotal > 0 ? "#22c55e" : "#ef4444" },
                  { n: fmtARS(totales.totalPagado),       l: "Total contrato",     c: "#60a5fa" },
                ].map(k => (
                  <div key={k.l} className="alq-card alq-kpi">
                    <div className="alq-kpi-n" style={{ color: k.c, fontSize: 14 }}>{k.n}</div>
                    <div className="alq-kpi-l">{k.l}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Gráfico de barras ── */}
            {cuotas.length > 0 && (
              <div className="alq-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                  Evolución de cuotas
                </div>
                <svg width="100%" height={160} viewBox={`0 0 ${cuotas.length * 60} 160`} preserveAspectRatio="none">
                  {cuotas.map((c, i) => {
                    const barH = Math.max(4, (c.monto / maxMonto) * 130);
                    const y = 140 - barH;
                    const x = i * 60 + 5;
                    const barW = 50;
                    const color = c.esProyeccion ? "rgba(96,165,250,0.5)" : "#cc0000";
                    const borderColor = c.esProyeccion ? "#60a5fa" : "#ff2222";
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width={barW} height={barH}
                          fill={color} stroke={borderColor} strokeWidth={0.5} rx={3} />
                        <text x={x + barW/2} y={155} textAnchor="middle"
                          fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="Montserrat,sans-serif">
                          {fmtMes(c.desde).replace(" ", "\n")}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: "#cc0000", borderRadius: 2 }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>Real</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: "rgba(96,165,250,0.5)", borderRadius: 2 }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>Proyección</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tabla de cuotas ── */}
            <div className="alq-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                Cuotas por período
              </div>

              {cuotas.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", padding: "32px 0", fontFamily: "Inter,sans-serif", fontSize: 13 }}>
                  Completá los datos del contrato para calcular
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter,sans-serif" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        {["#", "Desde", "Hasta", "Cuota mensual", "Variación", "Tipo"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: h === "Cuota mensual" || h === "Variación" ? "right" : "left", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cuotas.map((c, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.7)" }}>{fmtMes(c.desde)}</td>
                          <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.5)" }}>{fmtMes(c.hasta)}</td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#fff", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.04em" }}>
                            {fmtARS(c.monto)}
                          </td>
                          <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600, color: i === 0 ? "rgba(255,255,255,0.3)" : c.variacion >= 0 ? "#22c55e" : "#ef4444" }}>
                            {i === 0 ? "—" : fmtPct(c.variacion * 100)}
                          </td>
                          <td style={{ padding: "10px 10px" }}>
                            <span style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
                              background: c.esProyeccion ? "rgba(96,165,250,0.1)" : "rgba(204,0,0,0.1)",
                              color: c.esProyeccion ? "#60a5fa" : "#cc0000",
                              border: `1px solid ${c.esProyeccion ? "rgba(96,165,250,0.25)" : "rgba(204,0,0,0.25)"}`,
                            }}>
                              {c.esProyeccion ? "Proyección" : "Real"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                        <td colSpan={3} style={{ padding: "12px 10px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Total pagado ({duracion} meses)
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 14, color: "#60a5fa" }}>
                          {fmtARS(totales.totalPagado)}
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: totales.variacionTotal >= 0 ? "#22c55e" : "#ef4444" }}>
                          {fmtPct(totales.variacionTotal)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* ── Nota legal ── */}
            <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "rgba(245,158,11,0.8)", fontFamily: "Inter,sans-serif", lineHeight: 1.5 }}>
                <strong>Ley 27.737:</strong> Los contratos de locación de inmuebles con destino habitacional se actualizan trimestralmente según el ICL publicado por el Banco Central de la República Argentina (BCRA). El ICL se calcula como el promedio entre la variación del IPC y de los salarios (CVS).
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
