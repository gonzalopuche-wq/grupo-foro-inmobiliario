"use client";

import { useState, useEffect, useCallback } from "react";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface IndicesMes {
  ICL: Record<string, number>;
  IPC: Record<string, number>;
  CER: Record<string, number>;
  CAC: Record<string, number>;
}

interface BCRAVar {
  valor: number | null;
  fecha: string | null;
  cargando: boolean;
  error: boolean;
}

interface DolarCotiz {
  nombre: string;
  compra: number | null;
  venta: number | null;
  color: string;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const BCRA_BASE = "https://api.bcra.gob.ar";
const DOLAR_API = "https://dolarapi.com/v1/dolares";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function nombreMes(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

function ahora() {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function BCRALivePage() {
  const [indices, setIndices] = useState<IndicesMes | null>(null);
  const [uva, setUva] = useState<BCRAVar>({ valor: null, fecha: null, cargando: true, error: false });
  const [dolares, setDolares] = useState<DolarCotiz[]>([]);
  const [cargandoIndices, setCargandoIndices] = useState(true);
  const [cargandoDolar, setCargandoDolar] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string>("");
  const [tabActiva, setTabActiva] = useState<"indices" | "uva" | "dolar" | "tasas">("indices");
  const [tasas, setTasas] = useState<{ nombre: string; valor: number | null; cargando: boolean }[]>([
    { nombre: "Plazo fijo (TNA BCRA)", valor: null, cargando: true },
    { nombre: "Préstamos personales (TNA)", valor: null, cargando: true },
    { nombre: "Tasa política monetaria", valor: null, cargando: true },
  ]);

  const cargarIndices = useCallback(async () => {
    setCargandoIndices(true);
    try {
      const res = await fetch("/api/indices");
      const data = await res.json();
      if (data?.indices) setIndices(data.indices as IndicesMes);
    } catch {
      // silencioso — se mostrará el estado de error
    } finally {
      setCargandoIndices(false);
    }
  }, []);

  const cargarUVA = useCallback(async () => {
    setUva(v => ({ ...v, cargando: true, error: false }));
    try {
      // Variable 31 = UVA (Unidad de Valor Adquisitivo)
      const hoy = new Date();
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - 7);
      const desdeStr = desde.toISOString().split("T")[0];
      const hastaStr = hoy.toISOString().split("T")[0];
      const res = await fetch(
        `${BCRA_BASE}/estadisticas/v4.0/monetarias/31?desde=${desdeStr}&hasta=${hastaStr}&limit=10`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error("BCRA error");
      const json = await res.json();
      const detalle: { fecha: string; valor: number }[] = json.results?.[0]?.detalle ?? [];
      if (detalle.length > 0) {
        const ultimo = detalle[detalle.length - 1];
        setUva({ valor: ultimo.valor, fecha: ultimo.fecha, cargando: false, error: false });
      } else {
        setUva({ valor: null, fecha: null, cargando: false, error: true });
      }
    } catch {
      setUva({ valor: null, fecha: null, cargando: false, error: true });
    }
  }, []);

  const cargarDolar = useCallback(async () => {
    setCargandoDolar(true);
    try {
      const res = await fetch(DOLAR_API, { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      const colores: Record<string, string> = {
        oficial: "#22c55e", blue: "#3b82f6", bolsa: "#8b5cf6",
        contadoconliqui: "#f97316", cripto: "#eab308", mayorista: "#06b6d4", tarjeta: "#ec4899",
      };
      const mapeados: DolarCotiz[] = (Array.isArray(data) ? data : []).map((d: any) => ({
        nombre: d.nombre ?? d.casa ?? d.casa?.nombre ?? "Dólar",
        compra: d.compra ?? null,
        venta: d.venta ?? null,
        color: colores[d.casa?.toLowerCase() ?? ""] ?? "#cc0000",
      })).filter((d: DolarCotiz) => d.venta !== null);
      setDolares(mapeados);
    } catch {
      setDolares([]);
    } finally {
      setCargandoDolar(false);
    }
  }, []);

  const cargarTasas = useCallback(async () => {
    // Variables BCRA: 6 = tasas pasivas (plazo fijo), 7 = tasa activa préstamos,
    // 34 = tasa política monetaria (Leliq/Pases)
    const vars = [
      { id: 6, nombre: "Plazo fijo (TNA BCRA)" },
      { id: 7, nombre: "Préstamos personales (TNA)" },
      { id: 34, nombre: "Tasa política monetaria" },
    ];
    setTasas(vars.map(v => ({ ...v, valor: null, cargando: true })));
    const resultados = await Promise.allSettled(
      vars.map(async v => {
        const hoy = new Date().toISOString().split("T")[0];
        const desde = new Date(); desde.setDate(desde.getDate() - 7);
        const desdeStr = desde.toISOString().split("T")[0];
        const res = await fetch(
          `${BCRA_BASE}/estadisticas/v4.0/monetarias/${v.id}?desde=${desdeStr}&hasta=${hoy}&limit=5`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }
        );
        if (!res.ok) throw new Error("error");
        const json = await res.json();
        const det: { fecha: string; valor: number }[] = json.results?.[0]?.detalle ?? [];
        return det.length > 0 ? det[det.length - 1].valor : null;
      })
    );
    setTasas(vars.map((v, i) => ({
      nombre: v.nombre,
      valor: resultados[i].status === "fulfilled" ? resultados[i].value : null,
      cargando: false,
    })));
  }, []);

  const cargarTodo = useCallback(() => {
    cargarIndices();
    cargarUVA();
    cargarDolar();
    cargarTasas();
    setUltimaActualizacion(ahora());
  }, [cargarIndices, cargarUVA, cargarDolar, cargarTasas]);

  useEffect(() => {
    cargarTodo();
    const interval = setInterval(cargarTodo, 1000 * 60 * 30); // cada 30 min
    return () => clearInterval(interval);
  }, [cargarTodo]);

  // Últimos valores de índices
  const ultimoIndice = (key: keyof IndicesMes) => {
    if (!indices) return null;
    const datos = indices[key];
    const claves = Object.keys(datos).sort();
    if (claves.length === 0) return null;
    const ult = claves[claves.length - 1];
    const pen = claves.length > 1 ? claves[claves.length - 2] : null;
    return { mes: ult, valor: datos[ult], anterior: pen ? datos[pen] : null };
  };

  const acumAnual = (key: keyof IndicesMes) => {
    if (!indices) return null;
    const datos = indices[key];
    const claves = Object.keys(datos).sort().slice(-12);
    let acum = 1;
    for (const k of claves) acum *= (1 + datos[k] / 100);
    return (acum - 1) * 100;
  };

  const INDICES_INFO = [
    { id: "ICL" as keyof IndicesMes, nombre: "ICL", desc: "Índice Contratos Locación", color: "#cc0000", fuente: "BCRA" },
    { id: "IPC" as keyof IndicesMes, nombre: "IPC", desc: "Inflación mensual (INDEC)", color: "#3b82f6", fuente: "INDEC" },
    { id: "CER" as keyof IndicesMes, nombre: "CER", desc: "Coef. Estabilización Referencia", color: "#a78bfa", fuente: "BCRA" },
    { id: "CAC" as keyof IndicesMes, nombre: "CAC", desc: "Costo de Construcción (CAMARCO)", color: "#f97316", fuente: "CAMARCO" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .bl-wrap { max-width: 960px; display: flex; flex-direction: column; gap: 20px; font-family: 'Inter', sans-serif; }
        .bl-titulo { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .bl-titulo span { color: #cc0000; }
        .bl-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 3px; }
        .bl-status { display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; flex-wrap: wrap; }
        .bl-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .bl-refresh { padding: 5px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; letter-spacing: 0.08em; }
        .bl-refresh:hover { background: rgba(255,255,255,0.08); }
        /* Tabs */
        .bl-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .bl-tab { padding: 10px 18px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); cursor: pointer; border-bottom: 2px solid transparent; background: none; border-top: none; border-left: none; border-right: none; transition: all 0.15s; }
        .bl-tab.on { color: #fff; border-bottom-color: #cc0000; }
        /* Cards grid */
        .bl-grid4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
        .bl-grid2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
        .bl-card { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 16px 18px; }
        .bl-card-label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 6px; }
        .bl-card-val { font-family: 'Montserrat',sans-serif; font-size: 26px; font-weight: 800; color: #fff; line-height: 1; }
        .bl-card-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 5px; }
        .bl-card-acum { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; margin-top: 6px; }
        .bl-tendencia { font-size: 10px; font-weight: 800; }
        /* Historico mini bars */
        .bl-mini { display: flex; align-items: flex-end; gap: 2px; height: 40px; margin-top: 10px; }
        .bl-mini-bar { flex: 1; border-radius: 2px 2px 0 0; min-height: 2px; }
        /* UVA big */
        .bl-uva-big { font-family: 'Montserrat',sans-serif; font-size: 56px; font-weight: 800; line-height: 1; }
        .bl-uva-fecha { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 6px; }
        /* Dólar list */
        .bl-dolar-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .bl-dolar-item:last-child { border-bottom: none; }
        .bl-dolar-nombre { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; }
        .bl-dolar-prices { display: flex; gap: 16px; align-items: center; }
        .bl-dolar-c { font-size: 11px; color: rgba(255,255,255,0.35); }
        .bl-dolar-v { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; }
        /* Tasas */
        .bl-tasa-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; margin-bottom: 8px; }
        .bl-tasa-nombre { font-size: 13px; color: rgba(255,255,255,0.7); font-family: 'Inter',sans-serif; }
        .bl-tasa-val { font-family: 'Montserrat',sans-serif; font-size: 24px; font-weight: 800; color: #fff; }
        .bl-tasa-pct { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 2px; }
        /* Loading */
        .bl-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Tabla historial */
        .bl-tabla { width: 100%; border-collapse: collapse; font-size: 12px; }
        .bl-tabla th { padding: 7px 10px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .bl-tabla td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.65); font-family: 'Inter',sans-serif; }
        @media (max-width: 700px) {
          .bl-grid4 { grid-template-columns: repeat(2,1fr); }
          .bl-grid2 { grid-template-columns: 1fr; }
          .bl-uva-big { font-size: 40px; }
        }
      `}</style>

      <div className="bl-wrap">
        {/* Header */}
        <div>
          <div className="bl-titulo">Datos <span>BCRA</span> en tiempo real</div>
          <div className="bl-sub">ICL, IPC, CER, CAC, UVA, tipos de cambio y tasas. Fuente: BCRA API v4.0 + INDEC + DolarAPI.</div>
        </div>

        {/* Status bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div className="bl-status">
            <div className="bl-dot" />
            <span>Live · Se actualiza cada 30 min</span>
            {ultimaActualizacion && <span>· Última actualización: {ultimaActualizacion}</span>}
          </div>
          <button className="bl-refresh" onClick={cargarTodo}>↺ Actualizar ahora</button>
        </div>

        {/* Tabs */}
        <div className="bl-tabs">
          {([
            { id: "indices", label: "Índices ICL/IPC/CER/CAC" },
            { id: "uva", label: "UVA del día" },
            { id: "dolar", label: "Tipos de cambio" },
            { id: "tasas", label: "Tasas BCRA" },
          ] as { id: typeof tabActiva; label: string }[]).map(t => (
            <button key={t.id} className={`bl-tab${tabActiva === t.id ? " on" : ""}`} onClick={() => setTabActiva(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ ÍNDICES ═══ */}
        {tabActiva === "indices" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {cargandoIndices ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div className="bl-spinner" style={{ width: 24, height: 24 }} />
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Conectando con BCRA...</div>
              </div>
            ) : (
              <>
                {/* Cards últimos valores */}
                <div className="bl-grid4">
                  {INDICES_INFO.map(ind => {
                    const ult = ultimoIndice(ind.id);
                    const acum = acumAnual(ind.id);
                    if (!ult) return (
                      <div key={ind.id} className="bl-card" style={{ borderColor: `${ind.color}20` }}>
                        <div className="bl-card-label" style={{ color: ind.color }}>{ind.nombre}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Sin datos disponibles</div>
                      </div>
                    );
                    const tendencia = ult.anterior !== null
                      ? ult.valor > ult.anterior ? "▲" : ult.valor < ult.anterior ? "▼" : "→"
                      : "";
                    const tendColor = ult.anterior !== null
                      ? ult.valor > ult.anterior ? "#ef4444" : "#22c55e"
                      : "#94a3b8";
                    return (
                      <div key={ind.id} className="bl-card" style={{ borderColor: `${ind.color}25`, background: `${ind.color}06` }}>
                        <div className="bl-card-label" style={{ color: ind.color }}>{ind.nombre} · {ind.fuente}</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <div className="bl-card-val" style={{ color: ind.color }}>+{ult.valor.toFixed(2)}%</div>
                          <span className="bl-tendencia" style={{ color: tendColor }}>{tendencia}</span>
                        </div>
                        <div className="bl-card-sub">{nombreMes(ult.mes)} · {ind.desc}</div>
                        {acum !== null && (
                          <div className="bl-card-acum" style={{ color: "#22c55e" }}>Acum. 12m: +{acum.toFixed(1)}%</div>
                        )}
                        {/* Mini barras históricas */}
                        {indices && (() => {
                          const datos = indices[ind.id];
                          const claves = Object.keys(datos).sort().slice(-12);
                          const maxV = Math.max(...claves.map(k => datos[k]), 0.01);
                          return (
                            <div className="bl-mini">
                              {claves.map((k, i) => (
                                <div
                                  key={k}
                                  className="bl-mini-bar"
                                  style={{
                                    height: `${Math.max((datos[k] / maxV) * 100, 5)}%`,
                                    background: i === claves.length - 1 ? ind.color : `${ind.color}50`,
                                  }}
                                  title={`${nombreMes(k)}: +${datos[k].toFixed(2)}%`}
                                />
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>

                {/* Tabla comparativa últimos 6 meses */}
                <div className="bl-card">
                  <div className="bl-card-label">Historial comparativo — últimos 12 meses</div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="bl-tabla">
                      <thead>
                        <tr>
                          <th>Mes</th>
                          {INDICES_INFO.map(i => <th key={i.id} style={{ color: i.color }}>{i.nombre}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {indices && (() => {
                          const allMeses = new Set<string>();
                          INDICES_INFO.forEach(ind => {
                            Object.keys(indices[ind.id]).slice(-12).forEach(k => allMeses.add(k));
                          });
                          return [...allMeses].sort().reverse().map(mes => (
                            <tr key={mes}>
                              <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff" }}>{nombreMes(mes)}</td>
                              {INDICES_INFO.map(ind => {
                                const v = indices[ind.id][mes];
                                return (
                                  <td key={ind.id} style={{ color: v !== undefined ? ind.color : "rgba(255,255,255,0.2)", fontFamily: "Montserrat,sans-serif", fontWeight: v !== undefined ? 700 : 400 }}>
                                    {v !== undefined ? `+${v.toFixed(2)}%` : "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ UVA ═══ */}
        {tabActiva === "uva" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="bl-card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div className="bl-card-label" style={{ marginBottom: 14 }}>Valor UVA del día · BCRA</div>
              {uva.cargando ? (
                <div className="bl-spinner" style={{ width: 32, height: 32, margin: "0 auto" }} />
              ) : uva.error || uva.valor === null ? (
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>
                  No se pudo obtener el valor UVA del BCRA.
                  <div style={{ marginTop: 8 }}>
                    <button className="bl-refresh" onClick={cargarUVA}>Reintentar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bl-uva-big" style={{ color: "#cc0000" }}>
                    $ {uva.valor.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="bl-uva-fecha">
                    Valor al {uva.fecha ? new Date(uva.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"} · Fuente: BCRA API v4.0
                  </div>
                </>
              )}
            </div>

            {!uva.cargando && !uva.error && uva.valor !== null && (
              <div className="bl-grid2">
                <div className="bl-card">
                  <div className="bl-card-label">¿Qué es la UVA?</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                    La Unidad de Valor Adquisitivo es una unidad de cuenta que se actualiza diariamente según la variación del CER (que sigue al IPC). Se usa para indexar créditos hipotecarios UVA y contratos en pesos.
                  </div>
                </div>
                <div className="bl-card">
                  <div className="bl-card-label">Calculá en UVA</div>
                  <UVACalculator valorUVA={uva.valor} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ DÓLAR ═══ */}
        {tabActiva === "dolar" && (
          <div className="bl-card" style={{ padding: 0, overflow: "hidden" }}>
            {cargandoDolar ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div className="bl-spinner" style={{ width: 24, height: 24 }} />
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Obteniendo cotizaciones...</div>
              </div>
            ) : dolares.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                No se pudo obtener cotizaciones. Intentá más tarde.
              </div>
            ) : (
              dolares.map(d => (
                <div key={d.nombre} className="bl-dolar-item">
                  <div>
                    <div className="bl-dolar-nombre" style={{ color: d.color }}>{d.nombre}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1, fontFamily: "Montserrat,sans-serif" }}>
                      Compra: {d.compra !== null ? `$${d.compra.toLocaleString("es-AR")}` : "—"}
                    </div>
                  </div>
                  <div className="bl-dolar-prices">
                    <div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", marginBottom: 2 }}>VENTA</div>
                      <div className="bl-dolar-v" style={{ color: d.venta !== null ? "#fff" : "rgba(255,255,255,0.3)" }}>
                        {d.venta !== null ? `$${d.venta.toLocaleString("es-AR")}` : "—"}
                      </div>
                    </div>
                    {d.compra !== null && d.venta !== null && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", marginBottom: 2 }}>SPREAD</div>
                        <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 12, color: "#eab308" }}>
                          {((d.venta - d.compra) / d.compra * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ TASAS ═══ */}
        {tabActiva === "tasas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif", marginBottom: 4 }}>
              Tasas nominales anuales (TNA) publicadas por el BCRA. Se actualizan en días hábiles.
            </div>
            {tasas.map((t, i) => (
              <div key={i} className="bl-tasa-item">
                <div className="bl-tasa-nombre">{t.nombre}</div>
                <div style={{ textAlign: "right" }}>
                  {t.cargando ? (
                    <div className="bl-spinner" />
                  ) : t.valor !== null ? (
                    <>
                      <div className="bl-tasa-val">{t.valor.toFixed(2)}%</div>
                      <div className="bl-tasa-pct">TNA</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>No disponible</div>
                  )}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif" }}>
              Fuente: BCRA API estadísticas v4.0. Variables 6, 7 y 34. Los datos se actualizan cada día hábil.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-componente calculadora UVA ────────────────────────────────────────────

function UVACalculator({ valorUVA }: { valorUVA: number }) {
  const [uvas, setUvas] = useState("");
  const [pesos, setPesos] = useState("");
  const [modo, setModo] = useState<"uva-a-pesos" | "pesos-a-uva">("uva-a-pesos");

  const uvasNum = parseFloat(uvas.replace(",", ".")) || 0;
  const pesosNum = parseFloat(pesos.replace(",", ".")) || 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {(["uva-a-pesos", "pesos-a-uva"] as const).map(m => (
          <button
            key={m}
            onClick={() => setModo(m)}
            style={{
              flex: 1, padding: "6px 8px",
              background: modo === m ? "rgba(204,0,0,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${modo === m ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 4, cursor: "pointer",
              color: modo === m ? "#cc0000" : "rgba(255,255,255,0.4)",
              fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700,
            }}
          >
            {m === "uva-a-pesos" ? "UVA → $" : "$ → UVA"}
          </button>
        ))}
      </div>
      {modo === "uva-a-pesos" ? (
        <>
          <input
            type="number" placeholder="Cantidad de UVAs" value={uvas}
            onChange={e => setUvas(e.target.value)}
            style={{ width: "100%", padding: "9px 11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          />
          {uvasNum > 0 && (
            <div style={{ padding: "8px 12px", background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 5 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>EQUIVALE A</div>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#cc0000" }}>
                $ {(uvasNum * valorUVA).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <input
            type="number" placeholder="Monto en pesos $" value={pesos}
            onChange={e => setPesos(e.target.value)}
            style={{ width: "100%", padding: "9px 11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          />
          {pesosNum > 0 && (
            <div style={{ padding: "8px 12px", background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 5 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>EQUIVALE A</div>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#cc0000" }}>
                {(pesosNum / valorUVA).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UVA
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
