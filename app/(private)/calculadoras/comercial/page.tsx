"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Formateadores ──────────────────────────────────────────────────────────────
const fmtUSD = (n: number) =>
  "USD " + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtARS = (n: number) =>
  "$ " + Math.round(n).toLocaleString("es-AR");

const fmtNum = (n: number, moneda: "USD" | "ARS") =>
  moneda === "USD" ? fmtUSD(n) : fmtARS(n);

const fmtPct = (n: number, dec = 1) =>
  n.toFixed(dec).replace(".", ",") + "%";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Moneda = "USD" | "ARS";
type Indice = "CAC" | "IPC" | "CER" | "ICL" | "fijo";
type PeriodoAjuste = 3 | 6 | 12;
type Tab = "resumen" | "proyeccion" | "comparativa";

interface Config {
  superficieM2: number;
  alquilerBase: number;
  moneda: Moneda;
  tipoCambio: number;
  expensas: number;
  impuestosLocatario: number;
  honorariosEntrada: number;
  depositoMeses: number;
  indiceAjuste: Indice;
  tasaAjusteAnual: number;
  periodoAjuste: PeriodoAjuste;
  mesesContrato: number;
  precioPropiedad: number;
}

interface FilaMes {
  mes: number;
  factor: number;
  alquilerAjustado: number;
  impuesto: number;
  costoMensual: number;
}

interface Calculos {
  filas: FilaMes[];
  honorariosTotal: number;
  depositoTotal: number;
  costoEntrada: number;
  totalContrato: number;
  rentaAnualUSD: number[];
  rendimientoAnual: number[];
}

interface ConfigComp {
  alquilerResidencial: number;
  tasaResidencial: number;
  periodoResidencial: PeriodoAjuste;
}

// ── Constantes ────────────────────────────────────────────────────────────────
const INDICES: { value: Indice; label: string }[] = [
  { value: "CAC", label: "CAC — Costo de la Construcción" },
  { value: "IPC", label: "IPC — Índice de Precios al Consumidor" },
  { value: "CER", label: "CER — Coeficiente Estabilización Referencia" },
  { value: "ICL", label: "ICL — Índice Contratos Locación" },
  { value: "fijo", label: "Tasa fija anual" },
];

const PERIODOS: { value: PeriodoAjuste; label: string }[] = [
  { value: 3, label: "Trimestral (3 meses)" },
  { value: 6, label: "Semestral (6 meses)" },
  { value: 12, label: "Anual (12 meses)" },
];

// ── Helpers de cálculo ────────────────────────────────────────────────────────
function calcFactor(mes: number, tasa: number, periodo: PeriodoAjuste): number {
  const ajustesAplicados = Math.floor(mes / periodo);
  const aniosEquivalentes = (ajustesAplicados * periodo) / 12;
  return Math.pow(1 + tasa / 100, aniosEquivalentes);
}

function calcFilas(cfg: Config): FilaMes[] {
  const filas: FilaMes[] = [];
  for (let m = 0; m < cfg.mesesContrato; m++) {
    const factor = calcFactor(m, cfg.tasaAjusteAnual, cfg.periodoAjuste);
    const alquilerAjustado = cfg.alquilerBase * factor;
    const impuesto = alquilerAjustado * (cfg.impuestosLocatario / 100);
    const costoMensual = alquilerAjustado + cfg.expensas + impuesto;
    filas.push({ mes: m + 1, factor, alquilerAjustado, impuesto, costoMensual });
  }
  return filas;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CalculadoraComercialPage() {
  const [tab, setTab] = useState<Tab>("resumen");
  const [cfg, setCfg] = useState<Config>({
    superficieM2: 100,
    alquilerBase: 2500,
    moneda: "USD",
    tipoCambio: 1300,
    expensas: 300,
    impuestosLocatario: 15,
    honorariosEntrada: 1.5,
    depositoMeses: 1,
    indiceAjuste: "CAC",
    tasaAjusteAnual: 120,
    periodoAjuste: 3,
    mesesContrato: 36,
    precioPropiedad: 0,
  });

  const [comp, setComp] = useState<ConfigComp>({
    alquilerResidencial: 2000,
    tasaResidencial: 80,
    periodoResidencial: 3,
  });

  // Tooltip state for chart
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    mes: number;
    valor: number;
  }>({ visible: false, x: 0, y: 0, mes: 0, valor: 0 });

  const svgRef = useRef<SVGSVGElement>(null);

  // ── Cálculos principales ───────────────────────────────────────────────────
  const calculos = useMemo((): Calculos => {
    const filas = calcFilas(cfg);
    const honorariosTotal = cfg.alquilerBase * cfg.honorariosEntrada;
    const depositoTotal = cfg.alquilerBase * cfg.depositoMeses;
    const costoEntrada = honorariosTotal + depositoTotal;
    const totalContrato = filas.reduce((s, f) => s + f.costoMensual, 0);

    const toUSD = (v: number) =>
      cfg.moneda === "ARS" ? v / cfg.tipoCambio : v;

    const anios = Math.ceil(cfg.mesesContrato / 12);
    const rentaAnualUSD: number[] = [];
    const rendimientoAnual: number[] = [];

    for (let a = 0; a < anios; a++) {
      const inicio = a * 12;
      const fin = Math.min(inicio + 12, cfg.mesesContrato);
      let sumaAnio = 0;
      for (let m = inicio; m < fin; m++) {
        sumaAnio += filas[m]?.costoMensual ?? 0;
      }
      const rentaUSD = toUSD(sumaAnio);
      rentaAnualUSD.push(rentaUSD);
      const rend =
        cfg.precioPropiedad > 0 ? (rentaUSD / cfg.precioPropiedad) * 100 : 0;
      rendimientoAnual.push(rend);
    }

    return {
      filas,
      honorariosTotal,
      depositoTotal,
      costoEntrada,
      totalContrato,
      rentaAnualUSD,
      rendimientoAnual,
    };
  }, [cfg]);

  // ── Cálculos comparativa ───────────────────────────────────────────────────
  const calcComp = useMemo(() => {
    const anios = Math.ceil(cfg.mesesContrato / 12);
    const toUSD = (v: number) =>
      cfg.moneda === "ARS" ? v / cfg.tipoCambio : v;

    const comercialAnual: number[] = [];
    const residencialAnual: number[] = [];

    for (let a = 0; a < anios; a++) {
      const inicio = a * 12;
      const fin = Math.min(inicio + 12, cfg.mesesContrato);
      let sumaComercial = 0;
      let sumaResidencial = 0;
      for (let m = inicio; m < fin; m++) {
        sumaComercial += calculos.filas[m]?.costoMensual ?? 0;
        const factor = calcFactor(m, comp.tasaResidencial, comp.periodoResidencial);
        sumaResidencial += comp.alquilerResidencial * factor;
      }
      comercialAnual.push(toUSD(sumaComercial));
      residencialAnual.push(toUSD(sumaResidencial));
    }

    return { comercialAnual, residencialAnual };
  }, [cfg, comp, calculos.filas]);

  // ── Filas para tabla resumen (primeros 6 + último de cada año) ─────────────
  const filasResumen = useMemo(() => {
    const { filas } = calculos;
    if (filas.length === 0) return [];
    const set = new Set<number>();
    // primeros 6
    for (let i = 0; i < Math.min(6, filas.length); i++) set.add(i);
    // último mes de cada año
    const anios = Math.ceil(cfg.mesesContrato / 12);
    for (let a = 1; a <= anios; a++) {
      const ultimoMes = Math.min(a * 12, cfg.mesesContrato) - 1;
      set.add(ultimoMes);
    }
    return Array.from(set)
      .sort((a, b) => a - b)
      .map((i) => filas[i])
      .filter(Boolean);
  }, [calculos, cfg.mesesContrato]);

  // ── SVG Chart ─────────────────────────────────────────────────────────────
  const W = 900;
  const H = 240;
  const PAD = { top: 20, right: 20, bottom: 30, left: 10 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const chartPoints = useMemo(() => {
    const { filas } = calculos;
    if (filas.length === 0) return { points: "", dots: [] };
    const maxVal = Math.max(...filas.map((f) => f.costoMensual));
    const minVal = Math.min(...filas.map((f) => f.costoMensual));
    const range = maxVal - minVal || 1;

    const dots = filas.map((f, i) => {
      const x = PAD.left + (i / (filas.length - 1 || 1)) * innerW;
      const y = PAD.top + innerH - ((f.costoMensual - minVal) / range) * innerH;
      return { x, y, mes: f.mes, valor: f.costoMensual };
    });

    const points = dots.map((d) => `${d.x},${d.y}`).join(" ");
    return { points, dots, maxVal, minVal };
  }, [calculos, innerW, innerH]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || chartPoints.dots.length === 0) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = W / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;
      const { dots } = chartPoints;
      let closest = dots[0];
      let minDist = Math.abs(mx - dots[0].x);
      for (const d of dots) {
        const dist = Math.abs(mx - d.x);
        if (dist < minDist) {
          minDist = dist;
          closest = d;
        }
      }
      setTooltip({
        visible: true,
        x: closest.x,
        y: closest.y,
        mes: closest.mes,
        valor: closest.valor,
      });
    },
    [chartPoints]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const { filas, honorariosTotal, depositoTotal, costoEntrada, totalContrato } = calculos;
    const primerMes = filas[0]?.costoMensual ?? 0;
    const ultimoMes = filas[filas.length - 1]?.costoMensual ?? 0;
    const rows = filasResumen
      .map(
        (f) => `<tr style="border-bottom:1px solid #eee">
        <td style="padding:6px 10px">${f.mes}</td>
        <td style="padding:6px 10px;text-align:right">${fmtNum(f.alquilerAjustado, cfg.moneda)}</td>
        <td style="padding:6px 10px;text-align:right">${fmtNum(cfg.expensas, cfg.moneda)}</td>
        <td style="padding:6px 10px;text-align:right">${fmtNum(f.impuesto, cfg.moneda)}</td>
        <td style="padding:6px 10px;text-align:right;font-weight:700">${fmtNum(f.costoMensual, cfg.moneda)}</td>
      </tr>`
      )
      .join("");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Calculadora Alquiler Comercial</title>
      <style>body{font-family:Arial,sans-serif;color:#111;padding:24px;font-size:13px}
      h1{font-size:18px;margin-bottom:4px}p{margin:4px 0}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#f3f4f6;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase}
      td{font-size:12px}.cards{display:flex;gap:16px;margin:16px 0}
      .card{flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:12px}
      .card-n{font-size:16px;font-weight:700}.card-l{font-size:10px;color:#666;text-transform:uppercase;margin-top:2px}
      </style></head><body>
      <h1>Calculadora de Alquiler Comercial</h1>
      <p>Alquiler base: <strong>${fmtNum(cfg.alquilerBase, cfg.moneda)}/mes</strong>
         · Superficie: <strong>${cfg.superficieM2} m²</strong>
         · Duración: <strong>${cfg.mesesContrato} meses</strong>
         · Índice: <strong>${cfg.indiceAjuste} ${fmtPct(cfg.tasaAjusteAnual)}/año</strong></p>
      <div class="cards">
        <div class="card"><div class="card-n">${fmtNum(primerMes, cfg.moneda)}</div><div class="card-l">Costo mes 1</div></div>
        <div class="card"><div class="card-n">${fmtNum(ultimoMes, cfg.moneda)}</div><div class="card-l">Costo mes ${cfg.mesesContrato}</div></div>
        <div class="card"><div class="card-n">${fmtNum(costoEntrada, cfg.moneda)}</div><div class="card-l">Costo de entrada</div></div>
        <div class="card"><div class="card-n">${fmtNum(totalContrato, cfg.moneda)}</div><div class="card-l">Total contrato</div></div>
      </div>
      <p><strong>Honorarios:</strong> ${fmtNum(honorariosTotal, cfg.moneda)} · <strong>Depósito:</strong> ${fmtNum(depositoTotal, cfg.moneda)}</p>
      <table><thead><tr><th>Mes</th><th>Alquiler</th><th>Expensas</th><th>Impuestos</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  // ── Helpers de set ─────────────────────────────────────────────────────────
  const set = <K extends keyof Config>(k: K, v: Config[K]) =>
    setCfg((prev) => ({ ...prev, [k]: v }));

  const setN = (k: keyof Config, v: string) => {
    const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
    if (!isNaN(n)) set(k, n as Config[typeof k]);
  };

  const setComp_ = <K extends keyof ConfigComp>(k: K, v: ConfigComp[K]) =>
    setComp((prev) => ({ ...prev, [k]: v }));

  // ── Computed shortcuts ─────────────────────────────────────────────────────
  const { filas, honorariosTotal, depositoTotal, costoEntrada, totalContrato, rentaAnualUSD, rendimientoAnual } = calculos;
  const primerMes = filas[0]?.costoMensual ?? 0;
  const ultimoMes = filas[filas.length - 1]?.costoMensual ?? 0;
  const anios = Math.ceil(cfg.mesesContrato / 12);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .com-input {
          width: 100%; padding: 9px 11px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px; color: #fff;
          font-size: 14px; font-family: 'Inter', sans-serif;
          outline: none; box-sizing: border-box;
        }
        .com-input:focus { border-color: rgba(204,0,0,0.5); }
        .com-select {
          width: 100%; padding: 9px 11px;
          background: rgba(14,14,14,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px; color: #fff;
          font-size: 14px; font-family: 'Inter', sans-serif;
          outline: none; box-sizing: border-box;
        }
        .com-label {
          display: block; font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.35); margin-bottom: 5px;
          font-family: 'Montserrat', sans-serif;
        }
        .com-card {
          background: rgba(14,14,14,0.9);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px; padding: 18px;
        }
        .com-tab {
          padding: 8px 18px; border-radius: 5px;
          font-family: 'Montserrat', sans-serif;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; cursor: pointer;
          border: 1px solid transparent; transition: all 0.15s;
          background: none;
        }
        .com-btn {
          padding: 8px 16px; border: none; border-radius: 5px;
          font-family: 'Montserrat', sans-serif; font-size: 11px;
          font-weight: 700; letter-spacing: 0.08em; cursor: pointer;
          transition: opacity 0.15s;
        }
        .com-row { display: flex; gap: 16px; }
        .com-row > * { flex: 1; min-width: 0; }
        @media(max-width: 768px) {
          .com-row { flex-direction: column !important; }
          .com-main-layout { flex-direction: column !important; }
          .com-sidebar { flex: none !important; width: 100% !important; }
          .com-kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1080, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{
              fontFamily: "Montserrat, sans-serif", fontSize: 24, fontWeight: 800,
              color: "#fff", margin: 0, lineHeight: 1.2,
            }}>
              Calculadora de{" "}
              <span style={{ color: "#cc0000" }}>Alquiler Comercial</span>
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "6px 0 0", fontFamily: "Inter, sans-serif" }}>
              Locales · Oficinas · Galpones — Proyección con índice {cfg.indiceAjuste}
            </p>
          </div>
          <button
            className="com-btn"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
            onClick={exportPDF}
          >
            ↓ Exportar PDF
          </button>
        </div>

        {/* ── Layout principal ──────────────────────────────────────────────── */}
        <div className="com-main-layout" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

          {/* ── Sidebar: configuración ──────────────────────────────────────── */}
          <div className="com-sidebar" style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Datos del inmueble */}
            <div className="com-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                Inmueble
              </div>

              <div className="com-row" style={{ marginBottom: 12 }}>
                <div>
                  <label className="com-label">Superficie (m²)</label>
                  <input className="com-input" type="number" min={1} value={cfg.superficieM2}
                    onChange={(e) => setN("superficieM2", e.target.value)} />
                </div>
                <div>
                  <label className="com-label">Duración (meses)</label>
                  <input className="com-input" type="number" min={1} max={120} value={cfg.mesesContrato}
                    onChange={(e) => setN("mesesContrato", e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="com-label">Precio de la propiedad (USD) <span style={{ color: "rgba(255,255,255,0.2)" }}>opcional</span></label>
                <input className="com-input" type="number" min={0} value={cfg.precioPropiedad || ""}
                  placeholder="0 = no calcular rendimiento"
                  onChange={(e) => setN("precioPropiedad", e.target.value || "0")} />
              </div>
            </div>

            {/* Alquiler */}
            <div className="com-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                Alquiler base
              </div>

              <div className="com-row" style={{ marginBottom: 12 }}>
                <div>
                  <label className="com-label">Moneda</label>
                  <select className="com-select" value={cfg.moneda}
                    onChange={(e) => set("moneda", e.target.value as Moneda)}>
                    <option value="USD">USD — Dólar</option>
                    <option value="ARS">ARS — Peso</option>
                  </select>
                </div>
                <div>
                  <label className="com-label">Alquiler base / mes</label>
                  <input className="com-input" type="number" min={0} value={cfg.alquilerBase}
                    onChange={(e) => setN("alquilerBase", e.target.value)} />
                </div>
              </div>

              {cfg.moneda === "ARS" && (
                <div style={{ marginBottom: 12 }}>
                  <label className="com-label">Tipo de cambio (ARS por USD)</label>
                  <input className="com-input" type="number" min={1} value={cfg.tipoCambio}
                    onChange={(e) => setN("tipoCambio", e.target.value)} />
                </div>
              )}

              <div className="com-row" style={{ marginBottom: 12 }}>
                <div>
                  <label className="com-label">Expensas / mes</label>
                  <input className="com-input" type="number" min={0} value={cfg.expensas}
                    onChange={(e) => setN("expensas", e.target.value)} />
                </div>
                <div>
                  <label className="com-label">Impuestos locatario (%)</label>
                  <input className="com-input" type="number" min={0} max={100} value={cfg.impuestosLocatario}
                    onChange={(e) => setN("impuestosLocatario", e.target.value)} />
                </div>
              </div>

              <div className="com-row">
                <div>
                  <label className="com-label">Honorarios entrada (meses)</label>
                  <input className="com-input" type="number" min={0} step={0.5} value={cfg.honorariosEntrada}
                    onChange={(e) => setN("honorariosEntrada", e.target.value)} />
                </div>
                <div>
                  <label className="com-label">Depósito (meses)</label>
                  <input className="com-input" type="number" min={0} value={cfg.depositoMeses}
                    onChange={(e) => setN("depositoMeses", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Índice de ajuste */}
            <div className="com-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                Índice de ajuste
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="com-label">Índice</label>
                <select className="com-select" value={cfg.indiceAjuste}
                  onChange={(e) => set("indiceAjuste", e.target.value as Indice)}>
                  {INDICES.map((i) => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
              </div>

              <div className="com-row">
                <div>
                  <label className="com-label">Tasa anual (%)</label>
                  <input className="com-input" type="number" min={0} value={cfg.tasaAjusteAnual}
                    onChange={(e) => setN("tasaAjusteAnual", e.target.value)} />
                </div>
                <div>
                  <label className="com-label">Período de ajuste</label>
                  <select className="com-select" value={cfg.periodoAjuste}
                    onChange={(e) => set("periodoAjuste", parseInt(e.target.value) as PeriodoAjuste)}>
                    {PERIODOS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Panel derecho: resultados ─────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── KPI cards ──────────────────────────────────────────────────── */}
            <div className="com-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[
                { valor: fmtNum(primerMes, cfg.moneda), label: "Costo mes 1", color: "#fff" },
                { valor: fmtNum(ultimoMes, cfg.moneda), label: `Costo mes ${cfg.mesesContrato}`, color: "#f59e0b" },
                { valor: fmtNum(costoEntrada, cfg.moneda), label: "Costo de entrada", color: "#60a5fa" },
                { valor: fmtNum(totalContrato, cfg.moneda), label: "Total contrato", color: "#cc0000" },
              ].map((k) => (
                <div key={k.label} className="com-card" style={{ textAlign: "center", padding: "16px 10px" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: k.color, lineHeight: 1.2 }}>
                    {k.valor}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 5 }}>
                    {k.label}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Tabs ──────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 0 }}>
              {(["resumen", "proyeccion", "comparativa"] as Tab[]).map((t) => {
                const labels: Record<Tab, string> = {
                  resumen: "Resumen",
                  proyeccion: "Proyección",
                  comparativa: "Comparativa",
                };
                const active = tab === t;
                return (
                  <button
                    key={t}
                    className="com-tab"
                    style={{
                      background: active ? "rgba(204,0,0,0.1)" : "transparent",
                      color: active ? "#cc0000" : "rgba(255,255,255,0.4)",
                      borderColor: active ? "rgba(204,0,0,0.3)" : "transparent",
                      borderBottom: active ? "2px solid #cc0000" : "2px solid transparent",
                      borderRadius: "5px 5px 0 0",
                    }}
                    onClick={() => setTab(t)}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>

            {/* ══ TAB: RESUMEN ══════════════════════════════════════════════ */}
            {tab === "resumen" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Desglose de entrada */}
                <div className="com-card">
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                    Desglose de entrada
                  </div>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    {[
                      { label: "Honorarios inmobiliaria", valor: fmtNum(honorariosTotal, cfg.moneda), sub: `${cfg.honorariosEntrada} mes${cfg.honorariosEntrada !== 1 ? "es" : ""}` },
                      { label: "Depósito de garantía", valor: fmtNum(depositoTotal, cfg.moneda), sub: `${cfg.depositoMeses} mes${cfg.depositoMeses !== 1 ? "es" : ""}` },
                      { label: "Total a abonar al inicio", valor: fmtNum(costoEntrada, cfg.moneda), sub: "honorarios + depósito" },
                    ].map((item) => (
                      <div key={item.label} style={{ flex: 1, minWidth: 140, padding: "12px 0", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 18, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#fff" }}>
                          {item.valor}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>
                          {item.sub}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rendimiento anual (si hay precio) */}
                {cfg.precioPropiedad > 0 && (
                  <div className="com-card">
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                      Rendimiento sobre inversión
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {rentaAnualUSD.map((renta, i) => (
                        <div key={i} className="com-card" style={{ flex: 1, minWidth: 100, textAlign: "center", padding: "12px 10px", border: "1px solid rgba(204,0,0,0.2)" }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Año {i + 1}
                          </div>
                          <div style={{ fontSize: 16, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#22c55e", margin: "6px 0 2px" }}>
                            {fmtPct(rendimientoAnual[i], 2)}
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                            {fmtUSD(renta)} renta
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabla mes a mes */}
                <div className="com-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      Proyección mes a mes
                    </div>
                    <button
                      className="com-btn"
                      style={{ background: "rgba(204,0,0,0.1)", color: "#cc0000", border: "1px solid rgba(204,0,0,0.25)", fontSize: 10 }}
                      onClick={exportPDF}
                    >
                      ↓ PDF
                    </button>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter,sans-serif" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          {["Mes", "Factor", "Alquiler ajust.", "Expensas", "Impuestos", "Total mes"].map((h) => (
                            <th key={h} style={{
                              padding: "8px 10px", fontSize: 10,
                              fontFamily: "Montserrat,sans-serif", fontWeight: 700,
                              letterSpacing: "0.08em", textTransform: "uppercase",
                              color: "rgba(255,255,255,0.3)",
                              textAlign: h === "Mes" || h === "Factor" ? "left" : "right",
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filasResumen.map((f, idx) => {
                          const prevFila = idx > 0 ? filasResumen[idx - 1] : null;
                          const esPrimerMesAnio = prevFila && Math.ceil(f.mes / 12) !== Math.ceil(prevFila.mes / 12);
                          return (
                            <tr
                              key={f.mes}
                              style={{
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                borderTop: esPrimerMesAnio ? "1px solid rgba(204,0,0,0.2)" : undefined,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.5)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 12 }}>
                                {f.mes}
                              </td>
                              <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                                ×{f.factor.toFixed(3)}
                              </td>
                              <td style={{ padding: "9px 10px", textAlign: "right", color: "#fff" }}>
                                {fmtNum(f.alquilerAjustado, cfg.moneda)}
                              </td>
                              <td style={{ padding: "9px 10px", textAlign: "right", color: "rgba(255,255,255,0.5)" }}>
                                {fmtNum(cfg.expensas, cfg.moneda)}
                              </td>
                              <td style={{ padding: "9px 10px", textAlign: "right", color: "rgba(255,255,255,0.5)" }}>
                                {fmtNum(f.impuesto, cfg.moneda)}
                              </td>
                              <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#cc0000" }}>
                                {fmtNum(f.costoMensual, cfg.moneda)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                          <td colSpan={5} style={{ padding: "12px 10px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Total acumulado ({cfg.mesesContrato} meses)
                          </td>
                          <td style={{ padding: "12px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 15, color: "#cc0000" }}>
                            {fmtNum(totalContrato, cfg.moneda)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══ TAB: PROYECCIÓN ═══════════════════════════════════════════ */}
            {tab === "proyeccion" && (
              <div className="com-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                  Costo mensual total — {cfg.mesesContrato} meses
                </div>

                <div style={{ position: "relative" }}>
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${W} ${H}`}
                    width="100%"
                    height={H}
                    style={{ display: "block", overflow: "visible" }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Líneas de grilla horizontales */}
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                      const y = PAD.top + t * innerH;
                      return (
                        <line
                          key={t}
                          x1={PAD.left}
                          y1={y}
                          x2={PAD.left + innerW}
                          y2={y}
                          stroke="rgba(255,255,255,0.07)"
                          strokeWidth={1}
                        />
                      );
                    })}

                    {/* Líneas verticales por año */}
                    {Array.from({ length: anios - 1 }, (_, i) => i + 1).map((a) => {
                      const mesIdx = a * 12;
                      if (mesIdx >= cfg.mesesContrato) return null;
                      const x = PAD.left + (mesIdx / (cfg.mesesContrato - 1 || 1)) * innerW;
                      return (
                        <g key={a}>
                          <line
                            x1={x} y1={PAD.top}
                            x2={x} y2={PAD.top + innerH}
                            stroke="rgba(255,255,255,0.07)"
                            strokeWidth={1}
                            strokeDasharray="4 4"
                          />
                          <text
                            x={x} y={H - 6}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.25)"
                            fontSize={10}
                            fontFamily="Montserrat,sans-serif"
                          >
                            Año {a}
                          </text>
                        </g>
                      );
                    })}

                    {/* Línea del gráfico */}
                    {chartPoints.points && (
                      <polyline
                        points={chartPoints.points}
                        fill="none"
                        stroke="#cc0000"
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Área bajo la línea */}
                    {chartPoints.dots && chartPoints.dots.length > 0 && (
                      <polygon
                        points={[
                          `${chartPoints.dots[0].x},${PAD.top + innerH}`,
                          ...chartPoints.dots.map((d) => `${d.x},${d.y}`),
                          `${chartPoints.dots[chartPoints.dots.length - 1].x},${PAD.top + innerH}`,
                        ].join(" ")}
                        fill="rgba(204,0,0,0.06)"
                      />
                    )}

                    {/* Tooltip dot */}
                    {tooltip.visible && (
                      <g>
                        <circle cx={tooltip.x} cy={tooltip.y} r={5} fill="#cc0000" />
                        <circle cx={tooltip.x} cy={tooltip.y} r={9} fill="none" stroke="rgba(204,0,0,0.4)" strokeWidth={1.5} />
                        {/* Tooltip box */}
                        <rect
                          x={tooltip.x > W / 2 ? tooltip.x - 145 : tooltip.x + 12}
                          y={tooltip.y - 30}
                          width={130}
                          height={46}
                          rx={4}
                          fill="rgba(20,20,20,0.95)"
                          stroke="rgba(204,0,0,0.3)"
                          strokeWidth={1}
                        />
                        <text
                          x={tooltip.x > W / 2 ? tooltip.x - 80 : tooltip.x + 77}
                          y={tooltip.y - 12}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.5)"
                          fontSize={10}
                          fontFamily="Montserrat,sans-serif"
                          fontWeight={700}
                        >
                          MES {tooltip.mes}
                        </text>
                        <text
                          x={tooltip.x > W / 2 ? tooltip.x - 80 : tooltip.x + 77}
                          y={tooltip.y + 6}
                          textAnchor="middle"
                          fill="#fff"
                          fontSize={12}
                          fontFamily="Montserrat,sans-serif"
                          fontWeight={800}
                        >
                          {fmtNum(tooltip.valor, cfg.moneda)}
                        </text>
                      </g>
                    )}

                    {/* Etiquetas eje Y */}
                    {chartPoints.maxVal !== undefined && chartPoints.minVal !== undefined && (
                      <>
                        <text x={PAD.left + 4} y={PAD.top + 12} fill="rgba(255,255,255,0.3)" fontSize={10} fontFamily="Inter,sans-serif">
                          {fmtNum(chartPoints.maxVal, cfg.moneda)}
                        </text>
                        <text x={PAD.left + 4} y={PAD.top + innerH - 4} fill="rgba(255,255,255,0.3)" fontSize={10} fontFamily="Inter,sans-serif">
                          {fmtNum(chartPoints.minVal, cfg.moneda)}
                        </text>
                      </>
                    )}
                  </svg>
                </div>

                {/* Leyenda */}
                <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 3, background: "#cc0000", borderRadius: 2 }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>
                      Costo mensual total (alquiler + expensas + impuestos)
                    </span>
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif" }}>
                    Índice {cfg.indiceAjuste} · {fmtPct(cfg.tasaAjusteAnual)}/año · ajuste {cfg.periodoAjuste === 3 ? "trimestral" : cfg.periodoAjuste === 6 ? "semestral" : "anual"}
                  </div>
                </div>

                {/* Tabla resumen por año */}
                <div style={{ marginTop: 20, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter,sans-serif" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        {["Año", "Renta anual (bruta)", "Renta anual USD", cfg.precioPropiedad > 0 ? "Rendimiento" : null].filter(Boolean).map((h) => (
                          <th key={h!} style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rentaAnualUSD.map((renta, i) => {
                        const inicio = i * 12;
                        const fin = Math.min(inicio + 12, cfg.mesesContrato);
                        let sumaAnio = 0;
                        for (let m = inicio; m < fin; m++) sumaAnio += filas[m]?.costoMensual ?? 0;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
                              Año {i + 1}
                            </td>
                            <td style={{ padding: "9px 10px", textAlign: "right", color: "#fff", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                              {fmtNum(sumaAnio, cfg.moneda)}
                            </td>
                            <td style={{ padding: "9px 10px", textAlign: "right", color: "rgba(255,255,255,0.6)" }}>
                              {fmtUSD(renta)}
                            </td>
                            {cfg.precioPropiedad > 0 && (
                              <td style={{ padding: "9px 10px", textAlign: "right", color: "#22c55e", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                                {fmtPct(rendimientoAnual[i], 2)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══ TAB: COMPARATIVA ══════════════════════════════════════════ */}
            {tab === "comparativa" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Config residencial */}
                <div className="com-card">
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                    Alquiler residencial equivalente
                  </div>
                  <div className="com-row">
                    <div>
                      <label className="com-label">Alquiler residencial / mes ({cfg.moneda})</label>
                      <input className="com-input" type="number" min={0} value={comp.alquilerResidencial}
                        onChange={(e) => setComp_("alquilerResidencial", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="com-label">Tasa ajuste anual (%)</label>
                      <input className="com-input" type="number" min={0} value={comp.tasaResidencial}
                        onChange={(e) => setComp_("tasaResidencial", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="com-label">Período de ajuste</label>
                      <select className="com-select" value={comp.periodoResidencial}
                        onChange={(e) => setComp_("periodoResidencial", parseInt(e.target.value) as PeriodoAjuste)}>
                        {PERIODOS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Tabla comparativa */}
                <div className="com-card">
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                    Comparativa año a año
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter,sans-serif" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          {["Año", "Comercial (acum.)", "Residencial (acum.)", "Diferencia", "Diferencia %"].map((h) => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: h === "Año" ? "left" : "right", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {calcComp.comercialAnual.map((com_, i) => {
                          const res = calcComp.residencialAnual[i] ?? 0;
                          const diff = com_ - res;
                          const diffPct = res > 0 ? (diff / res) * 100 : 0;
                          // acumulados
                          const comAcum = calcComp.comercialAnual.slice(0, i + 1).reduce((s, v) => s + v, 0);
                          const resAcum = calcComp.residencialAnual.slice(0, i + 1).reduce((s, v) => s + v, 0);
                          const diffAcum = comAcum - resAcum;
                          const diffPctAcum = resAcum > 0 ? (diffAcum / resAcum) * 100 : 0;
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "10px 10px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
                                Año {i + 1}
                              </td>
                              <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#cc0000" }}>
                                {fmtUSD(comAcum)}
                              </td>
                              <td style={{ padding: "10px 10px", textAlign: "right", color: "rgba(255,255,255,0.6)" }}>
                                {fmtUSD(resAcum)}
                              </td>
                              <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: diffAcum > 0 ? "#ef4444" : "#22c55e" }}>
                                {diffAcum >= 0 ? "+" : ""}{fmtUSD(diffAcum)}
                              </td>
                              <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: diffPctAcum > 0 ? "#ef4444" : "#22c55e" }}>
                                {diffPctAcum >= 0 ? "+" : ""}{fmtPct(diffPctAcum, 1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mini análisis */}
                  {calcComp.comercialAnual.length > 0 && (
                    <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                      {(() => {
                        const totalCom = calcComp.comercialAnual.reduce((s, v) => s + v, 0);
                        const totalRes = calcComp.residencialAnual.reduce((s, v) => s + v, 0);
                        const diff = totalCom - totalRes;
                        const pct = totalRes > 0 ? (diff / totalRes) * 100 : 0;
                        const masEconomico = diff < 0 ? "comercial" : "residencial";
                        return (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter,sans-serif", lineHeight: 1.6 }}>
                            <span style={{ color: "#fff", fontWeight: 600 }}>Conclusión: </span>
                            El alquiler {masEconomico} es más económico en el total del contrato.
                            La diferencia acumulada es{" "}
                            <span style={{ color: diff < 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                              {fmtUSD(Math.abs(diff))} ({Math.abs(pct).toFixed(1)}%)
                            </span>
                            {" "}a favor del {masEconomico}.
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Chart comparativo */}
                <div className="com-card">
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                    Costo acumulado comparado
                  </div>
                  <svg viewBox={`0 0 ${W} 200`} width="100%" height={200} style={{ display: "block" }}>
                    {(() => {
                      const { comercialAnual, residencialAnual } = calcComp;
                      if (comercialAnual.length === 0) return null;
                      const n = comercialAnual.length;
                      const cumulCom = comercialAnual.map((_, i) => comercialAnual.slice(0, i + 1).reduce((s, v) => s + v, 0));
                      const cumulRes = residencialAnual.map((_, i) => residencialAnual.slice(0, i + 1).reduce((s, v) => s + v, 0));
                      const allVals = [...cumulCom, ...cumulRes];
                      const maxV = Math.max(...allVals);
                      const minV = 0;
                      const range = maxV - minV || 1;
                      const chartH2 = 160;
                      const pad2 = { top: 16, right: 20, bottom: 24, left: 10 };
                      const iW = W - pad2.left - pad2.right;

                      const toX = (i: number) => pad2.left + (i / (n - 1 || 1)) * iW;
                      const toY = (v: number) => pad2.top + chartH2 - ((v - minV) / range) * chartH2;

                      const ptsCom = cumulCom.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
                      const ptsRes = cumulRes.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

                      return (
                        <g>
                          {/* Grid */}
                          {[0, 0.5, 1].map((t) => (
                            <line key={t}
                              x1={pad2.left} y1={pad2.top + (1 - t) * chartH2}
                              x2={pad2.left + iW} y2={pad2.top + (1 - t) * chartH2}
                              stroke="rgba(255,255,255,0.07)" strokeWidth={1}
                            />
                          ))}
                          {/* Líneas */}
                          <polyline points={ptsRes} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeDasharray="6 4" />
                          <polyline points={ptsCom} fill="none" stroke="#cc0000" strokeWidth={2.5} />
                          {/* Dots + etiquetas */}
                          {cumulCom.map((v, i) => (
                            <g key={i}>
                              <circle cx={toX(i)} cy={toY(v)} r={4} fill="#cc0000" />
                              <circle cx={toX(i)} cy={toY(cumulRes[i])} r={4} fill="rgba(255,255,255,0.4)" />
                              <text x={toX(i)} y={200 - 6} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={10} fontFamily="Montserrat,sans-serif">
                                Año {i + 1}
                              </text>
                            </g>
                          ))}
                        </g>
                      );
                    })()}
                  </svg>
                  {/* Leyenda */}
                  <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 3, background: "#cc0000", borderRadius: 2 }} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>Comercial</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 3, background: "rgba(255,255,255,0.4)", borderRadius: 2, borderTop: "2px dashed rgba(255,255,255,0.4)" }} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>Residencial</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
