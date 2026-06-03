"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface IndicesAPI {
  ok: boolean;
  actualizado: string;
  fuente: string;
  indices: {
    ICL: Record<string, number>;
    IPC: Record<string, number>;
    CER: Record<string, number>;
    CAC: Record<string, number>;
    UVA: Record<string, number>;
  };
}

type Indice = "ICL" | "IPC" | "CER" | "CAC" | "UVA";
type Modo = "rapido" | "contrato";

interface CuotaContrato {
  desde: string;
  hasta: string;
  monto: number;
  variacion: number;
  esReal: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtARS = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtPct = (n: number, d = 1) => (n >= 0 ? "+" : "") + n.toFixed(d).replace(".", ",") + "%";

const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const fmtMes = (iso: string) => {
  const [a, m] = iso.split("-");
  return MESES_CORTO[parseInt(m) - 1] + " " + a;
};
const fmtMesLargo = (iso: string) => {
  const mesesLargo = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const [a, m] = iso.split("-");
  return mesesLargo[parseInt(m) - 1] + " de " + a;
};

const addMonths = (iso: string, n: number): string => {
  const d = new Date(iso + "-01");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 7);
};

const hoyISO = () => new Date().toISOString().slice(0, 7);

const diasHasta = (mesISO: string) => {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const target = new Date(mesISO + "-01");
  return Math.round((target.getTime() - hoy.getTime()) / 86400000);
};

// ── Info por índice ───────────────────────────────────────────────────────────
const IDX: Record<Indice, { label: string; desc: string; color: string; dot: string }> = {
  ICL: { label: "ICL",  desc: "Índice para Contratos de Locación (BCRA)",  color: "#3abab6", dot: "🔵" },
  IPC: { label: "IPC",  desc: "Índice de Precios al Consumidor (INDEC)",    color: "#4ab8d8", dot: "🟦" },
  CER: { label: "CER",  desc: "Coeficiente de Estabilización de Referencia",color: "#d4960c", dot: "🟡" },
  CAC: { label: "CAC",  desc: "Cámara Argentina de la Construcción",         color: "#8b5cf6", dot: "🟣" },
  UVA: { label: "UVA",  desc: "Unidad de Valor Adquisitivo (BCRA)",          color: "#f97316", dot: "🟠" },
};

const FRECUENCIAS = [
  { value: 3,  label: "Trimestral (3 meses)" },
  { value: 6,  label: "Semestral (6 meses)" },
  { value: 12, label: "Anual (12 meses)" },
];

const DURACIONES = [
  { value: 24, label: "24 meses (2 años)" },
  { value: 36, label: "36 meses (3 años)" },
  { value: 48, label: "48 meses (4 años)" },
];

// ── Calcular factor para un período usando variaciones mensuales ──────────────
function calcularFactor(
  indices: Record<string, number>,
  mesDesde: string,
  frecuencia: number
): { factor: number; mesesUsados: number; mesesTotal: number } {
  let factor = 1;
  let usados = 0;
  for (let i = 1; i <= frecuencia; i++) {
    const mes = addMonths(mesDesde, i);
    const pct = indices[mes];
    if (pct !== undefined) { factor *= (1 + pct / 100); usados++; }
  }
  return { factor, mesesUsados: usados, mesesTotal: frecuencia };
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CalculadoraAlquilerPage() {
  const [apiData, setApiData]   = useState<IndicesAPI | null>(null);
  const [cargando, setCargando] = useState(true);
  const [apiError, setApiError] = useState(false);

  const [modo, setModo]               = useState<Modo>("rapido");
  const [indice, setIndice]           = useState<Indice>("ICL");
  const [montoActual, setMontoActual] = useState("300000");
  const [mesAjuste, setMesAjuste]     = useState(() => addMonths(hoyISO(), -3));
  const [frecuencia, setFrecuencia]   = useState(3);

  // Modo contrato
  const [montoInicial, setMontoInicial] = useState("200000");
  const [fechaInicio, setFechaInicio]   = useState(() => addMonths(hoyISO(), -6));
  const [duracion, setDuracion]         = useState(24);

  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch("/api/indices")
      .then(r => r.json())
      .then((d: IndicesAPI) => { setApiData(d); setCargando(false); })
      .catch(() => { setApiError(true); setCargando(false); });
  }, []);

  // ── Último mes disponible del índice seleccionado ─────────────────────────
  const ultimoMes = useMemo(() => {
    if (!apiData) return null;
    const keys = Object.keys(apiData.indices[indice] ?? {}).sort();
    return keys.length > 0 ? keys[keys.length - 1] : null;
  }, [apiData, indice]);

  // ── Variación del último mes disponible ───────────────────────────────────
  const variacionUltimaMes = useMemo(() => {
    if (!apiData || !ultimoMes) return null;
    return apiData.indices[indice][ultimoMes] ?? null;
  }, [apiData, indice, ultimoMes]);

  // ── MODO RÁPIDO: resultado del ajuste ─────────────────────────────────────
  const resultRapido = useMemo(() => {
    const monto = parseFloat(montoActual.replace(/\./g, "").replace(",", ".")) || 0;
    if (!monto || !mesAjuste || !apiData) return null;
    const idx = apiData.indices[indice];
    if (!idx) return null;

    const { factor, mesesUsados, mesesTotal } = calcularFactor(idx, mesAjuste, frecuencia);
    if (mesesUsados === 0) return null;

    const nuevoMonto   = monto * factor;
    const variacion    = (factor - 1) * 100;
    const proxAjuste   = addMonths(mesAjuste, frecuencia);
    const dias         = diasHasta(proxAjuste);
    const mesFinPeriodo = addMonths(mesAjuste, frecuencia);
    const esReal       = !!ultimoMes && ultimoMes >= mesFinPeriodo;

    return { monto, nuevoMonto, variacion, factor, proxAjuste, dias, esReal, mesesUsados, mesesTotal };
  }, [montoActual, mesAjuste, frecuencia, indice, apiData, ultimoMes]);

  // ── COMPARADOR: factor de cada índice para el mismo período ───────────────
  const comparador = useMemo(() => {
    const monto = parseFloat(montoActual.replace(/\./g, "").replace(",", ".")) || 0;
    if (!monto || !mesAjuste || !apiData) return [];
    return (["ICL","IPC","CER","CAC","UVA"] as Indice[]).map(idx => {
      const { factor, mesesUsados } = calcularFactor(apiData.indices[idx] ?? {}, mesAjuste, frecuencia);
      const variacion = (factor - 1) * 100;
      return { idx, factor, variacion, nuevoMonto: monto * factor, mesesUsados };
    }).filter(x => x.mesesUsados > 0);
  }, [montoActual, mesAjuste, frecuencia, apiData]);

  const maxVariacion = useMemo(() => Math.max(...comparador.map(c => c.variacion), 1), [comparador]);

  // ── MODO CONTRATO: cuotas ─────────────────────────────────────────────────
  const cuotas = useMemo((): CuotaContrato[] => {
    const inicial = parseFloat(montoInicial.replace(/\./g, "").replace(",", ".")) || 0;
    if (!inicial || !fechaInicio || !apiData) return [];
    const idx = apiData.indices[indice];
    const result: CuotaContrato[] = [];
    const numPeriodos = Math.ceil(duracion / frecuencia);

    let montoActualCont = inicial;
    for (let p = 0; p < numPeriodos; p++) {
      const desde = addMonths(fechaInicio, p * frecuencia);
      const hasta = addMonths(fechaInicio, Math.min((p + 1) * frecuencia, duracion) - 1);
      if (desde >= addMonths(fechaInicio, duracion)) break;

      if (p === 0) {
        result.push({ desde, hasta, monto: montoActualCont, variacion: 0, esReal: false });
      } else {
        const mesPeriodoAnterior = addMonths(fechaInicio, (p - 1) * frecuencia);
        const { factor, mesesUsados } = calcularFactor(idx ?? {}, mesPeriodoAnterior, frecuencia);
        const esReal = mesesUsados === frecuencia;
        const variacion = (factor - 1) * 100;
        montoActualCont = montoActualCont * factor;
        result.push({ desde, hasta, monto: montoActualCont, variacion, esReal });
      }
    }
    return result;
  }, [montoInicial, fechaInicio, duracion, frecuencia, indice, apiData]);

  const totalesContrato = useMemo(() => {
    if (cuotas.length === 0) return null;
    let total = 0;
    cuotas.forEach((c, i) => {
      const next = cuotas[i + 1];
      const meses = next
        ? (new Date(next.desde + "-01").getTime() - new Date(c.desde + "-01").getTime()) / (30.44 * 86400000)
        : duracion - cuotas.slice(0, i).reduce((acc, cx, j) => acc + (cuotas[j+1] ? (new Date(cuotas[j+1].desde + "-01").getTime() - new Date(cx.desde + "-01").getTime()) / (30.44 * 86400000) : 0), 0);
      total += c.monto * Math.round(meses);
    });
    const primera = cuotas[0]?.monto ?? 1;
    const ultima  = cuotas[cuotas.length - 1]?.monto ?? primera;
    return { total, variacionTotal: ((ultima / primera) - 1) * 100, ultimaCuota: ultima };
  }, [cuotas, duracion]);

  const maxMontoCuota = useMemo(() => Math.max(...cuotas.map(c => c.monto), 1), [cuotas]);

  // ── Compartir por WhatsApp ────────────────────────────────────────────────
  const shareWhatsApp = () => {
    if (!resultRapido) return;
    const txt = `📊 *Actualización de alquiler — GFI*\n\nÍndice: ${IDX[indice].label} · ${IDX[indice].desc}\nAlquiler anterior: ${fmtARS(resultRapido.monto)}\nAlquiler actualizado: ${fmtARS(resultRapido.nuevoMonto)}\nVariación: ${fmtPct(resultRapido.variacion)}\n\nCalculado en foroinmobiliario.com.ar`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const copiarResultado = async () => {
    if (!resultRapido) return;
    await navigator.clipboard.writeText(`Alquiler actualizado por ${IDX[indice].label}: ${fmtARS(resultRapido.nuevoMonto)} (${fmtPct(resultRapido.variacion)})`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  const exportarPDF = () => {
    if (modo === "rapido" && resultRapido) {
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(`<!DOCTYPE html><html><head><title>Ajuste de alquiler</title>
      <style>body{font-family:Arial;padding:24px;color:#111}h1{font-size:18px;margin-bottom:4px}p{font-size:13px;color:#555;margin:0 0 16px}.big{font-size:36px;font-weight:800;color:#333;margin:0}.pct{font-size:20px;color:#0070c0}.nota{font-size:11px;color:#888;margin-top:24px;border-top:1px solid #eee;padding-top:12px}</style>
      </head><body>
      <h1>Ajuste de Alquiler — ${IDX[indice].label}</h1>
      <p>Período: ${fmtMes(mesAjuste)} → ${fmtMes(addMonths(mesAjuste, frecuencia))} · ${FRECUENCIAS.find(f=>f.value===frecuencia)?.label}</p>
      <p>Alquiler anterior: <strong>${fmtARS(resultRapido.monto)}</strong></p>
      <p class="big">${fmtARS(resultRapido.nuevoMonto)}</p>
      <p class="pct">${fmtPct(resultRapido.variacion)}</p>
      <p>Próximo ajuste: ${fmtMesLargo(resultRapido.proxAjuste)}</p>
      <p class="nota">Calculado con datos del BCRA · ${IDX[indice].desc} · foroinmobiliario.com.ar</p>
      </body></html>`);
      setTimeout(() => win.print(), 300);
    } else {
      window.print();
    }
  };

  const montoNum = parseFloat(montoActual.replace(/\./g, "").replace(",", ".")) || 0;

  return (
    <>
      <style>{`
        .alq2-input { width:100%; padding:10px 13px; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px; color:#fff; font-size:15px; font-family:var(--font-body,Inter,sans-serif); outline:none; box-sizing:border-box; transition:border-color 0.15s; }
        .alq2-input:focus { border-color:rgba(153,0,0,0.5); }
        .alq2-select { width:100%; padding:10px 13px; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px; color:#fff; font-size:14px; font-family:var(--font-body,Inter,sans-serif); outline:none; cursor:pointer; }
        .alq2-label { display:block; font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#666; margin-bottom:6px; font-family:var(--font-display,Montserrat,sans-serif); }
        .alq2-card { background:#111; border:1px solid #222; border-radius:10px; padding:20px; }
        .alq2-btn { padding:9px 18px; border:none; border-radius:6px; font-family:var(--font-display,Montserrat,sans-serif); font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; transition:all 0.15s; }
        .alq2-idx-tab { padding:7px 16px; border-radius:6px; font-family:var(--font-display,Montserrat,sans-serif); font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; border:1px solid transparent; transition:all 0.15s; white-space:nowrap; }
        .alq2-modo-btn { padding:8px 18px; border-radius:6px; font-family:var(--font-display,Montserrat,sans-serif); font-size:12px; font-weight:700; letter-spacing:0.06em; cursor:pointer; border:1px solid #2a2a2a; transition:all 0.15s; }
        @keyframes alq2-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .alq2-loading { animation:alq2-pulse 1.5s infinite; }
        @keyframes alq2-slide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .alq2-result { animation:alq2-slide 0.3s ease-out; }
        @media(max-width:720px){.alq2-main{flex-direction:column!important;}.alq2-cmp-cols{flex-direction:column!important;}}
      `}</style>

      <div style={{ maxWidth: 980, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Nav calculadoras ── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 14, borderBottom: "1px solid #1c1c1c" }}>
          {[
            { href: "/calculadoras",              label: "Índices", icon: "📊" },
            { href: "/calculadoras/alquiler",     label: "Actualizar Alquiler", icon: "🏠", active: true },
            { href: "/calculadoras/comparador",   label: "Comparador", icon: "⚖️" },
            { href: "/calculadoras/honorarios-inmobiliarios", label: "Honorarios", icon: "📋" },
            { href: "/calculadoras/bcra-live",    label: "BCRA Live", icon: "📡" },
          ].map(({ href, label, icon, active }) => (
            <Link key={href} href={href} style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px",
              borderRadius: 6, fontSize: 11, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700,
              letterSpacing: "0.06em", textDecoration: "none", transition: "all 0.15s",
              background: active ? "rgba(153,0,0,0.12)" : "#111",
              border: `1px solid ${active ? "rgba(153,0,0,0.35)" : "#222"}`,
              color: active ? "#990000" : "#555",
            }}><span>{icon}</span>{label}</Link>
          ))}
        </div>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 22, fontWeight: 800, color: "#f0f0f0", margin: 0, marginBottom: 4 }}>
              Actualizar <span style={{ color: "#990000" }}>Alquiler</span>
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#555" }}>
              Índices ICL · IPC · CER · CAC en tiempo real · Datos BCRA
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["rapido", "contrato"].map(m => (
              <button key={m} className="alq2-modo-btn" onClick={() => setModo(m as Modo)}
                style={{ background: modo === m ? "rgba(153,0,0,0.12)" : "#0d0d0d", color: modo === m ? "#cc3333" : "#555", borderColor: modo === m ? "rgba(153,0,0,0.3)" : "#222" }}>
                {m === "rapido" ? "⚡ Ajuste rápido" : "📄 Contrato completo"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Selector de índice ── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["ICL","IPC","CER","CAC","UVA"] as Indice[]).map(idx => {
            const info = IDX[idx];
            const active = indice === idx;
            const lastVar = apiData ? (apiData.indices[idx][ultimoMes ?? ""] ?? null) : null;
            return (
              <button key={idx} className="alq2-idx-tab" onClick={() => setIndice(idx)}
                style={{
                  background: active ? `rgba(${hexToRgb(info.color)},0.12)` : "#0d0d0d",
                  borderColor: active ? `rgba(${hexToRgb(info.color)},0.4)` : "#222",
                  color: active ? info.color : "#555",
                }}>
                <span style={{ marginRight: 4 }}>{idx}</span>
                {ultimoMes && lastVar !== null && (
                  <span style={{ fontSize: 10, opacity: 0.8 }}>
                    {fmtPct(lastVar)}
                  </span>
                )}
              </button>
            );
          })}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {cargando && <span className="alq2-loading" style={{ fontSize: 11, color: "#555" }}>Cargando índices...</span>}
            {apiError && <span style={{ fontSize: 11, color: "#b35050" }}>⚠ Error al cargar BCRA</span>}
            {!cargando && !apiError && ultimoMes && (
              <span style={{ fontSize: 10, color: "#444", fontFamily: "var(--font-display,Montserrat,sans-serif)", letterSpacing: "0.06em" }}>
                Datos al {fmtMes(ultimoMes)}
              </span>
            )}
          </div>
        </div>

        {/* ── Info del índice seleccionado ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: `rgba(${hexToRgb(IDX[indice].color)},0.05)`, border: `1px solid rgba(${hexToRgb(IDX[indice].color)},0.15)`, borderRadius: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: IDX[indice].color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#888", fontFamily: "var(--font-body,Inter,sans-serif)" }}>{IDX[indice].desc}</span>
          {ultimoMes && variacionUltimaMes !== null && (
            <>
              <span style={{ fontSize: 11, color: "#444" }}>·</span>
              <span style={{ fontSize: 12, color: IDX[indice].color, fontWeight: 700 }}>
                Último dato: {fmtPct(variacionUltimaMes)} en {fmtMes(ultimoMes)}
              </span>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MODO RÁPIDO
        ════════════════════════════════════════════════════════════════════ */}
        {modo === "rapido" && (
          <div className="alq2-main" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

            {/* ── Formulario ── */}
            <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="alq2-card">
                <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
                  Datos del ajuste
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="alq2-label">Alquiler actual (ARS)</label>
                  <input className="alq2-input" type="text" inputMode="numeric"
                    value={montoActual}
                    onChange={e => setMontoActual(e.target.value.replace(/[^0-9,.]/g, ""))}
                    placeholder="300.000" />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="alq2-label">Mes del último ajuste</label>
                  <input className="alq2-input" type="month" value={mesAjuste}
                    onChange={e => setMesAjuste(e.target.value)} />
                  <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
                    Mes en que se fijó el monto actual
                  </div>
                </div>

                <div>
                  <label className="alq2-label">Frecuencia de ajuste</label>
                  <select className="alq2-select" value={frecuencia}
                    onChange={e => setFrecuencia(parseInt(e.target.value))}>
                    {FRECUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Leyenda del índice */}
              <div className="alq2-card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6, fontFamily: "var(--font-body,Inter,sans-serif)" }}>
                  <strong style={{ color: IDX[indice].color }}>{IDX[indice].label}</strong> = {IDX[indice].desc}.<br />
                  Fórmula: Monto × ∏(1 + variación mensual).
                </div>
                {!cargando && !apiError && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(["ICL","IPC","CER","CAC","UVA"] as Indice[]).map(i => {
                      const keys = Object.keys(apiData?.indices[i] ?? {});
                      return (
                        <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: i === indice ? `rgba(${hexToRgb(IDX[i].color)},0.12)` : "#1a1a1a", color: i === indice ? IDX[i].color : "#444", border: `1px solid ${i === indice ? `rgba(${hexToRgb(IDX[i].color)},0.3)` : "#222"}`, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700 }}>
                          {i} {keys.length > 0 ? `${keys.length}m` : "—"}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Botones */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="alq2-btn" onClick={exportarPDF}
                  style={{ background: "#1a1a1a", color: "#666", border: "1px solid #2a2a2a", flex: 1 }}>
                  ↓ PDF
                </button>
                <button className="alq2-btn" onClick={copiarResultado}
                  style={{ background: copiado ? "rgba(58,186,182,0.1)" : "#1a1a1a", color: copiado ? "#3abab6" : "#666", border: `1px solid ${copiado ? "rgba(58,186,182,0.3)" : "#2a2a2a"}`, flex: 1 }}>
                  {copiado ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            {/* ── Panel de resultados ── */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Resultado principal */}
              {cargando ? (
                <div className="alq2-card" style={{ padding: "40px 24px", textAlign: "center" }}>
                  <div className="alq2-loading" style={{ fontSize: 13, color: "#555" }}>Cargando índices del BCRA...</div>
                </div>
              ) : !resultRapido ? (
                <div className="alq2-card" style={{ padding: "40px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#555" }}>
                    {apiError ? "⚠ No se pudo conectar con la API del BCRA" : "Completá los datos para calcular el ajuste"}
                  </div>
                </div>
              ) : (
                <div className="alq2-card alq2-result" style={{
                  background: "linear-gradient(135deg, #111 0%, #151515 100%)",
                  border: "1px solid #222",
                  position: "relative", overflow: "hidden",
                }}>
                  {/* Accent top */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #990000 0%, ${IDX[indice].color} 100%)` }} />

                  <div style={{ padding: "6px 0 20px" }}>
                    <div style={{ fontSize: 11, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                      Alquiler actualizado · {IDX[indice].label} · {FRECUENCIAS.find(f=>f.value===frecuencia)?.label}
                    </div>

                    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                      <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: "clamp(32px,5vw,52px)", fontWeight: 800, color: "#f0f0f0", lineHeight: 1 }}>
                        {fmtARS(resultRapido.nuevoMonto)}
                      </div>
                      <div style={{
                        padding: "6px 14px", borderRadius: 20,
                        background: `rgba(${hexToRgb(IDX[indice].color)},0.15)`,
                        border: `1px solid rgba(${hexToRgb(IDX[indice].color)},0.35)`,
                        fontSize: 18, fontWeight: 800, color: IDX[indice].color,
                        fontFamily: "var(--font-display,Montserrat,sans-serif)", letterSpacing: "0.04em",
                      }}>
                        {fmtPct(resultRapido.variacion)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Antes</div>
                        <div style={{ fontSize: 18, color: "#888", fontWeight: 700, fontFamily: "var(--font-display,Montserrat,sans-serif)" }}>{fmtARS(resultRapido.monto)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Aumento</div>
                        <div style={{ fontSize: 18, color: IDX[indice].color, fontWeight: 700, fontFamily: "var(--font-display,Montserrat,sans-serif)" }}>{fmtARS(resultRapido.nuevoMonto - resultRapido.monto)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Período</div>
                        <div style={{ fontSize: 14, color: "#888", fontFamily: "Inter,sans-serif" }}>{fmtMes(addMonths(mesAjuste,1))} → {fmtMes(addMonths(mesAjuste,frecuencia))}</div>
                      </div>
                    </div>

                    {/* Badges */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: resultRapido.esReal ? "rgba(58,186,182,0.1)" : "rgba(212,150,12,0.1)", color: resultRapido.esReal ? "#3abab6" : "#d4960c", border: `1px solid ${resultRapido.esReal ? "rgba(58,186,182,0.25)" : "rgba(212,150,12,0.25)"}`, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700 }}>
                        {resultRapido.esReal ? "✓ Dato real" : "~ Proyección parcial"}
                      </span>
                      <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#1a1a1a", color: "#666", border: "1px solid #2a2a2a", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700 }}>
                        {resultRapido.mesesUsados}/{resultRapido.mesesTotal} meses con dato
                      </span>
                      {ultimoMes && (
                        <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#1a1a1a", color: "#555", border: "1px solid #222", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700 }}>
                          Último dato: {fmtMes(ultimoMes)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Próximo ajuste */}
              {resultRapido && (
                <div className="alq2-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: 28 }}>📅</div>
                    <div>
                      <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Próximo ajuste</div>
                      <div style={{ fontSize: 16, color: "#e0e0e0", fontWeight: 700, fontFamily: "var(--font-display,Montserrat,sans-serif)" }}>
                        {fmtMesLargo(resultRapido.proxAjuste)}
                      </div>
                      <div style={{ fontSize: 12, color: resultRapido.dias <= 30 ? "#d4960c" : "#555" }}>
                        {resultRapido.dias <= 0 ? "¡Hoy es el día del ajuste!" : resultRapido.dias === 1 ? "mañana" : `en ${resultRapido.dias} días`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="alq2-btn" onClick={shareWhatsApp}
                      style={{ background: "rgba(37,211,102,0.08)", color: "#25d366", border: "1px solid rgba(37,211,102,0.2)" }}>
                      WhatsApp
                    </button>
                    <button className="alq2-btn" onClick={copiarResultado}
                      style={{ background: "#1a1a1a", color: "#666", border: "1px solid #2a2a2a" }}>
                      {copiado ? "✓ Copiado" : "Copiar monto"}
                    </button>
                  </div>
                </div>
              )}

              {/* Comparador de índices */}
              {comparador.length > 0 && (
                <div className="alq2-card">
                  <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
                    Comparador de índices · mismo período · {fmtMes(addMonths(mesAjuste,1))} → {fmtMes(addMonths(mesAjuste,frecuencia))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {comparador
                      .slice()
                      .sort((a, b) => b.variacion - a.variacion)
                      .map(c => {
                        const barW = Math.max(4, (c.variacion / maxVariacion) * 100);
                        const isActive = c.idx === indice;
                        return (
                          <div key={c.idx}
                            onClick={() => setIndice(c.idx)}
                            style={{ cursor: "pointer", padding: "12px 14px", borderRadius: 8, background: isActive ? `rgba(${hexToRgb(IDX[c.idx].color)},0.07)` : "transparent", border: `1px solid ${isActive ? `rgba(${hexToRgb(IDX[c.idx].color)},0.2)` : "transparent"}`, transition: "all 0.15s" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <span style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 13, fontWeight: 800, color: IDX[c.idx].color, minWidth: 36 }}>{c.idx}</span>
                                <span style={{ fontSize: 12, color: "#555" }}>{IDX[c.idx].desc.split(" (")[0]}</span>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 15, fontWeight: 800, color: IDX[c.idx].color }}>{fmtPct(c.variacion)}</div>
                                <div style={{ fontSize: 12, color: "#888" }}>{fmtARS(c.nuevoMonto)}</div>
                              </div>
                            </div>
                            <div style={{ height: 5, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${barW}%`, background: IDX[c.idx].color, borderRadius: 3, transition: "width 0.4s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 10, color: "#444" }}>
                    Hacé click en un índice para usarlo como base
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODO CONTRATO COMPLETO
        ════════════════════════════════════════════════════════════════════ */}
        {modo === "contrato" && (
          <div className="alq2-main" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

            {/* Formulario */}
            <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="alq2-card">
                <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
                  Datos del contrato
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="alq2-label">Alquiler inicial (ARS)</label>
                  <input className="alq2-input" type="text" inputMode="numeric"
                    value={montoInicial}
                    onChange={e => setMontoInicial(e.target.value.replace(/[^0-9,.]/g, ""))} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="alq2-label">Mes de inicio</label>
                  <input className="alq2-input" type="month" value={fechaInicio}
                    onChange={e => setFechaInicio(e.target.value)} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="alq2-label">Duración</label>
                  <select className="alq2-select" value={duracion}
                    onChange={e => setDuracion(parseInt(e.target.value))}>
                    {DURACIONES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="alq2-label">Frecuencia de ajuste</label>
                  <select className="alq2-select" value={frecuencia}
                    onChange={e => setFrecuencia(parseInt(e.target.value))}>
                    {FRECUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="alq2-label">Índice</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(["ICL","IPC","CER","CAC","UVA"] as Indice[]).map(idx => (
                      <button key={idx} onClick={() => setIndice(idx)}
                        style={{ padding: "6px 12px", borderRadius: 5, fontSize: 11, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, cursor: "pointer", border: `1px solid ${indice === idx ? `rgba(${hexToRgb(IDX[idx].color)},0.4)` : "#222"}`, background: indice === idx ? `rgba(${hexToRgb(IDX[idx].color)},0.12)` : "#1a1a1a", color: indice === idx ? IDX[idx].color : "#555" }}>
                        {idx}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button className="alq2-btn" onClick={exportarPDF}
                style={{ background: "#1a1a1a", color: "#666", border: "1px solid #2a2a2a", width: "100%" }}>
                ↓ Exportar PDF
              </button>
            </div>

            {/* Resultados contrato */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* KPIs */}
              {totalesContrato && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {[
                    { n: fmtARS(parseFloat(montoInicial.replace(/\./g,"").replace(",",".")) || 0), l: "Cuota inicial", c: "#fff" },
                    { n: fmtARS(totalesContrato.ultimaCuota), l: "Cuota final", c: "#d4960c" },
                    { n: fmtPct(totalesContrato.variacionTotal), l: "Variación total", c: IDX[indice].color },
                  ].map(k => (
                    <div key={k.l} className="alq2-card" style={{ textAlign: "center", padding: "14px" }}>
                      <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 16, fontWeight: 800, color: k.c, marginBottom: 4 }}>{k.n}</div>
                      <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{k.l}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Gráfico */}
              {cuotas.length > 0 && (
                <div className="alq2-card">
                  <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                    Evolución de cuotas · {IDX[indice].label}
                  </div>
                  <svg width="100%" height={140} viewBox={`0 0 ${cuotas.length * 70} 140`} preserveAspectRatio="none">
                    {cuotas.map((c, i) => {
                      const barH = Math.max(6, (c.monto / maxMontoCuota) * 110);
                      const y = 120 - barH;
                      const x = i * 70 + 6;
                      const barW = 58;
                      const color = c.esReal ? IDX[indice].color : "rgba(255,255,255,0.15)";
                      return (
                        <g key={i}>
                          <rect x={x} y={y} width={barW} height={barH} fill={color} rx={4} />
                          <text x={x + barW/2} y={135} textAnchor="middle" fill="#444" fontSize={9} fontFamily="Montserrat,sans-serif">
                            {fmtMes(c.desde)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, background: IDX[indice].color, borderRadius: 2 }} />
                      <span style={{ fontSize: 10, color: "#555" }}>Real</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, background: "rgba(255,255,255,0.15)", borderRadius: 2 }} />
                      <span style={{ fontSize: 10, color: "#555" }}>Proyección</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla */}
              <div className="alq2-card">
                <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                  Cuotas por período
                </div>

                {cargando ? (
                  <div className="alq2-loading" style={{ textAlign: "center", padding: "24px", fontSize: 13, color: "#555" }}>Cargando...</div>
                ) : cuotas.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px", fontSize: 13, color: "#555" }}>Completá los datos para calcular</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter,sans-serif" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
                          {["#","Desde","Hasta","Cuota mensual","Variación","Estado"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: h === "Cuota mensual" || h === "Variación" ? "right" : "left", fontSize: 10, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#444" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cuotas.map((c, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #151515" }}>
                            <td style={{ padding: "11px 10px", color: "#444", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700 }}>{i + 1}</td>
                            <td style={{ padding: "11px 10px", color: "#ccc" }}>{fmtMes(c.desde)}</td>
                            <td style={{ padding: "11px 10px", color: "#888" }}>{fmtMes(c.hasta)}</td>
                            <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 800, color: "#f0f0f0", fontFamily: "var(--font-display,Montserrat,sans-serif)", letterSpacing: "0.03em" }}>{fmtARS(c.monto)}</td>
                            <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 700, color: i === 0 ? "#444" : IDX[indice].color }}>
                              {i === 0 ? "—" : fmtPct(c.variacion)}
                            </td>
                            <td style={{ padding: "11px 10px" }}>
                              {i > 0 && (
                                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, background: c.esReal ? `rgba(${hexToRgb(IDX[indice].color)},0.1)` : "rgba(255,255,255,0.05)", color: c.esReal ? IDX[indice].color : "#555", border: `1px solid ${c.esReal ? `rgba(${hexToRgb(IDX[indice].color)},0.25)` : "#222"}` }}>
                                  {c.esReal ? "Real" : "Proyección"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {totalesContrato && (
                        <tfoot>
                          <tr style={{ borderTop: "1px solid #2a2a2a" }}>
                            <td colSpan={3} style={{ padding: "12px 10px", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                              Total pagado ({duracion} meses)
                            </td>
                            <td style={{ padding: "12px 10px", textAlign: "right", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 800, fontSize: 15, color: IDX[indice].color }}>
                              {fmtARS(totalesContrato.total)}
                            </td>
                            <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: IDX[indice].color }}>
                              {fmtPct(totalesContrato.variacionTotal)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Nota legal ── */}
        <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 6, fontSize: 11, color: "rgba(245,158,11,0.6)", lineHeight: 1.6 }}>
          <strong>Ley 27.737:</strong> Los contratos de locación habitacional se actualizan según el índice pactado entre las partes, publicado por el Banco Central (BCRA) o el INDEC. Esta calculadora usa datos reales de la API oficial del BCRA. Los datos proyectados se marcan explícitamente.
        </div>

      </div>
    </>
  );
}

// ── Utility: hex a rgb para usar en rgba() ────────────────────────────────────
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
