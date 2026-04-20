"use client";

import { useState, useMemo } from "react";

// ── Datos de índices (valores reales aproximados 2023-2025) ─────────────────
// En producción estos vendrían de la API del BCRA/INDEC

const ICL_MENSUAL: Record<string, number> = {
  "2023-01": 6.21, "2023-02": 6.61, "2023-03": 7.68, "2023-04": 8.37,
  "2023-05": 8.96, "2023-06": 7.97, "2023-07": 6.28, "2023-08": 7.33,
  "2023-09": 12.39,"2023-10": 10.77,"2023-11": 12.83,"2023-12": 25.47,
  "2024-01": 20.61,"2024-02": 15.02,"2024-03": 13.22,"2024-04": 10.73,
  "2024-05": 8.85, "2024-06": 7.26, "2024-07": 6.41, "2024-08": 4.19,
  "2024-09": 3.48, "2024-10": 3.21, "2024-11": 2.89, "2024-12": 3.12,
  "2025-01": 3.38, "2025-02": 2.91, "2025-03": 3.05,
};

const IPC_MENSUAL: Record<string, number> = {
  "2023-01": 6.00, "2023-02": 6.60, "2023-03": 7.70, "2023-04": 8.40,
  "2023-05": 7.80, "2023-06": 6.00, "2023-07": 6.30, "2023-08": 12.40,
  "2023-09": 12.70,"2023-10": 8.30, "2023-11": 12.80,"2023-12": 25.50,
  "2024-01": 20.60,"2024-02": 13.20,"2024-03": 11.00,"2024-04": 8.80,
  "2024-05": 4.20, "2024-06": 4.60, "2024-07": 4.00, "2024-08": 4.20,
  "2024-09": 3.50, "2024-10": 2.40, "2024-11": 2.40, "2024-12": 2.70,
  "2025-01": 2.30, "2025-02": 2.40, "2025-03": 3.70,
};

const CAC_MENSUAL: Record<string, number> = {
  "2023-01": 7.20, "2023-02": 7.80, "2023-03": 8.90, "2023-04": 9.60,
  "2023-05": 10.20,"2023-06": 9.10, "2023-07": 7.50, "2023-08": 8.40,
  "2023-09": 13.80,"2023-10": 12.10,"2023-11": 14.20,"2023-12": 28.30,
  "2024-01": 23.40,"2024-02": 17.10,"2024-03": 15.30,"2024-04": 12.80,
  "2024-05": 10.20,"2024-06": 8.90, "2024-07": 7.80, "2024-08": 5.30,
  "2024-09": 4.60, "2024-10": 4.10, "2024-11": 3.80, "2024-12": 4.20,
  "2025-01": 4.50, "2025-02": 3.90, "2025-03": 4.10,
};

const CER_MENSUAL: Record<string, number> = {
  "2023-01": 5.90, "2023-02": 6.50, "2023-03": 7.60, "2023-04": 8.20,
  "2023-05": 7.60, "2023-06": 5.80, "2023-07": 6.20, "2023-08": 12.20,
  "2023-09": 12.50,"2023-10": 8.10, "2023-11": 12.60,"2023-12": 25.20,
  "2024-01": 20.30,"2024-02": 13.00,"2024-03": 10.80,"2024-04": 8.60,
  "2024-05": 4.00, "2024-06": 4.40, "2024-07": 3.80, "2024-08": 4.00,
  "2024-09": 3.30, "2024-10": 2.30, "2024-11": 2.30, "2024-12": 2.50,
  "2025-01": 2.20, "2025-02": 2.30, "2025-03": 3.60,
};

const INDICES_DATA: Record<string, Record<string, number>> = {
  ICL: ICL_MENSUAL,
  IPC: IPC_MENSUAL,
  CAC: CAC_MENSUAL,
  CER: CER_MENSUAL,
};

const INDICES_INFO = [
  { id: "ICL", nombre: "ICL", descripcion: "Índice para Contratos de Locación", detalle: "Promedio UVA + IPC · Ley 27.551", color: "#cc0000", badge: "Alquileres" },
  { id: "IPC", nombre: "IPC", descripcion: "Índice de Precios al Consumidor", detalle: "INDEC · Inflación general", color: "#3b82f6", badge: "General" },
  { id: "CAC", nombre: "CAC", descripcion: "Cámara Argentina de la Construcción", detalle: "Construcción · Obras", color: "#f97316", badge: "Obras" },
  { id: "CER", nombre: "CER", descripcion: "Coeficiente de Estabilización", detalle: "BCRA · Créditos y deudas", color: "#a78bfa", badge: "Créditos" },
];

// Períodos de ajuste según ley
const PERIODOS = [
  { id: "3", label: "Trimestral (3 meses)", meses: 3 },
  { id: "4", label: "Cuatrimestral (4 meses)", meses: 4 },
  { id: "6", label: "Semestral (6 meses)", meses: 6 },
  { id: "12", label: "Anual (12 meses)", meses: 12 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const formatPct = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function sumarMeses(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nombreMes(yyyymm: string): string {
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const [y, m] = yyyymm.split("-").map(Number);
  return `${meses[m - 1]} ${y}`;
}

function calcularAcumulado(indiceId: string, desde: string, meses: number): {
  factor: number;
  desglose: { mes: string; variacion: number; acumulado: number }[];
} {
  const data = INDICES_DATA[indiceId] ?? ICL_MENSUAL;
  let acum = 1;
  const desglose = [];
  for (let i = 0; i < meses; i++) {
    const mes = sumarMeses(desde, i);
    const v = data[mes] ?? 3.5; // fallback
    acum *= (1 + v / 100);
    desglose.push({ mes, variacion: v, acumulado: (acum - 1) * 100 });
  }
  return { factor: acum, desglose };
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function CalculadorasPage() {
  const [indice, setIndice] = useState("ICL");
  const [alquilerActual, setAlquilerActual] = useState("");
  const [fechaUltimoAjuste, setFechaUltimoAjuste] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [periodoAjuste, setPeriodoAjuste] = useState("6");
  const [tab, setTab] = useState<"calculadora" | "tabla" | "comparar">("calculadora");

  const indiceInfo = INDICES_INFO.find(i => i.id === indice)!;
  const mesesPeriodo = parseInt(periodoAjuste);
  const montoNum = parseFloat(alquilerActual.replace(/\./g, "").replace(",", ".")) || 0;

  // Cálculo principal
  const calculo = useMemo(() => {
    if (!montoNum) return null;
    const { factor, desglose } = calcularAcumulado(indice, fechaUltimoAjuste, mesesPeriodo);
    const nuevoAlquiler = montoNum * factor;
    const variacionTotal = (factor - 1) * 100;
    const diferencia = nuevoAlquiler - montoNum;
    return { nuevoAlquiler, variacionTotal, diferencia, factor, desglose };
  }, [montoNum, indice, fechaUltimoAjuste, mesesPeriodo]);

  // Tabla de próximos ajustes (para todo el año)
  const proximosAjustes = useMemo(() => {
    if (!montoNum) return [];
    const ajustes = [];
    let montoActual = montoNum;
    let desde = fechaUltimoAjuste;
    for (let i = 0; i < 4; i++) {
      const hasta = sumarMeses(desde, mesesPeriodo);
      const { factor } = calcularAcumulado(indice, desde, mesesPeriodo);
      const nuevo = montoActual * factor;
      ajustes.push({
        periodo: `${nombreMes(desde)} → ${nombreMes(hasta)}`,
        montoAnterior: montoActual,
        montoNuevo: nuevo,
        variacion: (factor - 1) * 100,
      });
      montoActual = nuevo;
      desde = hasta;
    }
    return ajustes;
  }, [montoNum, indice, fechaUltimoAjuste, mesesPeriodo]);

  // Comparar todos los índices
  const comparacion = useMemo(() => {
    if (!montoNum) return [];
    return INDICES_INFO.map(ind => {
      const { factor } = calcularAcumulado(ind.id, fechaUltimoAjuste, mesesPeriodo);
      return {
        ...ind,
        montoNuevo: montoNum * factor,
        variacion: (factor - 1) * 100,
      };
    }).sort((a, b) => b.variacion - a.variacion);
  }, [montoNum, fechaUltimoAjuste, mesesPeriodo]);

  const compartirWA = () => {
    if (!calculo) return;
    const txt = `📊 *Actualización de Alquiler — ${indice}*\n\nAlquiler actual: ${formatARS(montoNum)}\nNuevo alquiler: ${formatARS(calculo.nuevoAlquiler)}\nAumento: ${formatPct(calculo.variacionTotal)}\nDiferencia: ${formatARS(calculo.diferencia)}\n\nCalculado con GFI® Grupo Foro Inmobiliario`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .c-wrap { max-width: 900px; display: flex; flex-direction: column; gap: 20px; }
        .c-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .c-titulo span { color: #cc0000; }
        .c-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 3px; }
        /* Índices */
        .c-indices { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
        .c-ind { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; cursor: pointer; transition: all 0.15s; }
        .c-ind:hover { border-color: rgba(255,255,255,0.15); }
        .c-ind.on { border-width: 2px; }
        .c-ind-nombre { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; }
        .c-ind-desc { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 3px; line-height: 1.4; }
        .c-ind-badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 8px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.08em; margin-top: 6px; }
        /* Tabs */
        .c-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .c-tab { padding: 10px 18px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); cursor: pointer; border-bottom: 2px solid transparent; background: none; border-top: none; border-left: none; border-right: none; transition: all 0.15s; }
        .c-tab.on { color: #fff; border-bottom-color: #cc0000; }
        /* Grid */
        .c-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .c-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 20px 22px; }
        .c-card-t { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 14px; }
        .c-field { margin-bottom: 12px; }
        .c-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .c-input { width: 100%; padding: 11px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 16px; font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .c-input:focus { border-color: rgba(200,0,0,0.5); }
        .c-input::placeholder { color: rgba(255,255,255,0.2); }
        .c-select { width: 100%; padding: 11px 13px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; }
        /* Resultado */
        .c-resultado { border-radius: 8px; padding: 22px; }
        .c-res-label { font-size: 11px; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px; }
        .c-res-monto { font-family: 'Montserrat',sans-serif; font-size: 38px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
        .c-res-original { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 18px; }
        .c-res-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
        .c-res-stat { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 12px 14px; }
        .c-res-stat-val { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; }
        .c-res-stat-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 3px; font-family: 'Montserrat',sans-serif; }
        .c-btns { display: flex; gap: 8px; flex-wrap: wrap; }
        .c-btn-wa { flex: 1; padding: 11px; background: #25d366; border: none; border-radius: 5px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .c-btn-wa:hover { opacity: 0.85; }
        .c-btn-copy { flex: 1; padding: 11px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; color: rgba(255,255,255,0.6); font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; }
        /* Desglose */
        .c-desglose { margin-top: 16px; }
        .c-desglose-t { font-size: 10px; color: rgba(255,255,255,0.25); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
        .c-tabla { width: 100%; border-collapse: collapse; font-size: 12px; }
        .c-tabla th { padding: 7px 10px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.2); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .c-tabla td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); font-family: 'Inter',sans-serif; color: rgba(255,255,255,0.65); }
        .c-tabla tr:last-child td { border-bottom: none; }
        /* Vacío */
        .c-vacio { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; gap: 10px; text-align: center; }
        .c-vacio-icon { font-size: 36px; }
        .c-vacio-txt { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.3); }
        .c-vacio-sub { font-size: 12px; color: rgba(255,255,255,0.2); max-width: 240px; line-height: 1.6; }
        /* Comparar */
        .c-comp-item { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
        .c-comp-nombre { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; width: 56px; flex-shrink: 0; }
        .c-comp-barra-wrap { flex: 1; }
        .c-comp-barra-bg { height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; margin-bottom: 4px; }
        .c-comp-barra { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
        .c-comp-desc { font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
        .c-comp-monto { text-align: right; flex-shrink: 0; }
        .c-comp-monto-val { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .c-comp-monto-pct { font-size: 11px; margin-top: 2px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        /* Próximos ajustes */
        .c-ajuste { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .c-ajuste-n { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
        .c-ajuste-periodo { font-size: 12px; color: rgba(255,255,255,0.5); font-family: 'Inter',sans-serif; }
        .c-ajuste-monto { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .c-ajuste-pct { font-size: 11px; font-family: 'Montserrat',sans-serif; font-weight: 700; margin-top: 2px; }
        @media (max-width: 700px) {
          .c-grid { grid-template-columns: 1fr; }
          .c-indices { grid-template-columns: repeat(2,1fr); }
          .c-res-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="c-wrap">

        {/* Header */}
        <div>
          <div className="c-titulo">Calculadora de <span>Alquileres</span></div>
          <div className="c-sub">Actualizá el alquiler por ICL, IPC, CAC o CER. Resultados al instante.</div>
        </div>

        {/* Selector índice */}
        <div className="c-indices">
          {INDICES_INFO.map(ind => (
            <div
              key={ind.id}
              className={`c-ind${indice === ind.id ? " on" : ""}`}
              style={indice === ind.id ? { borderColor: ind.color, background: `${ind.color}10` } : {}}
              onClick={() => setIndice(ind.id)}
            >
              <div className="c-ind-nombre" style={{ color: indice === ind.id ? ind.color : "#fff" }}>{ind.nombre}</div>
              <div className="c-ind-desc">{ind.descripcion}</div>
              <div className="c-ind-badge" style={{ background: `${ind.color}20`, color: ind.color, border: `1px solid ${ind.color}40` }}>
                {ind.badge}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="c-tabs">
          {[
            { id: "calculadora", label: "Calculadora" },
            { id: "tabla", label: "Próximos ajustes" },
            { id: "comparar", label: "Comparar índices" },
          ].map(t => (
            <button key={t.id} className={`c-tab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id as any)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ Tab Calculadora ═══ */}
        {tab === "calculadora" && (
          <div className="c-grid">
            {/* Formulario */}
            <div className="c-card">
              <div className="c-card-t">Datos del alquiler</div>

              <div className="c-field">
                <label className="c-label">Alquiler actual ($)</label>
                <input
                  className="c-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej: 150.000"
                  value={alquilerActual}
                  onChange={e => setAlquilerActual(e.target.value.replace(/[^0-9.,]/g, ""))}
                />
              </div>

              <div className="c-field">
                <label className="c-label">Fecha del último ajuste</label>
                <input
                  className="c-input"
                  type="month"
                  value={fechaUltimoAjuste}
                  onChange={e => setFechaUltimoAjuste(e.target.value)}
                />
              </div>

              <div className="c-field">
                <label className="c-label">Período de ajuste</label>
                <select className="c-select" value={periodoAjuste} onChange={e => setPeriodoAjuste(e.target.value)}>
                  {PERIODOS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Info del índice seleccionado */}
              <div style={{ padding: "12px 14px", background: `${indiceInfo.color}10`, border: `1px solid ${indiceInfo.color}25`, borderRadius: 6, marginTop: 8 }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: indiceInfo.color, marginBottom: 4 }}>
                  {indiceInfo.nombre} — {indiceInfo.descripcion}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>{indiceInfo.detalle}</div>
              </div>
            </div>

            {/* Resultado */}
            <div>
              {!calculo ? (
                <div className="c-card" style={{ height: "100%" }}>
                  <div className="c-vacio">
                    <div className="c-vacio-icon">🧮</div>
                    <div className="c-vacio-txt">Ingresá el monto actual</div>
                    <div className="c-vacio-sub">El nuevo alquiler se calcula automáticamente al escribir el monto.</div>
                  </div>
                </div>
              ) : (
                <div className="c-resultado" style={{ background: `${indiceInfo.color}08`, border: `1px solid ${indiceInfo.color}25` }}>
                  <div className="c-res-label">Nuevo alquiler · {indiceInfo.nombre} · {periodoAjuste} meses</div>
                  <div className="c-res-monto" style={{ color: "#22c55e" }}>{formatARS(calculo.nuevoAlquiler)}</div>
                  <div className="c-res-original">Alquiler actual: {formatARS(montoNum)}</div>

                  <div className="c-res-grid">
                    <div className="c-res-stat">
                      <div className="c-res-stat-val" style={{ color: "#22c55e" }}>{formatPct(calculo.variacionTotal)}</div>
                      <div className="c-res-stat-label">Aumento total</div>
                    </div>
                    <div className="c-res-stat">
                      <div className="c-res-stat-val" style={{ color: "#eab308", fontSize: 16 }}>{formatARS(calculo.diferencia)}</div>
                      <div className="c-res-stat-label">Diferencia mensual</div>
                    </div>
                  </div>

                  <div className="c-btns">
                    <button className="c-btn-wa" onClick={compartirWA}>
                      💬 Compartir por WhatsApp
                    </button>
                    <button className="c-btn-copy" onClick={() => {
                      navigator.clipboard.writeText(`Alquiler actualizado por ${indiceInfo.nombre}: ${formatARS(calculo.nuevoAlquiler)} (aumento ${formatPct(calculo.variacionTotal)})`);
                    }}>
                      📋 Copiar
                    </button>
                  </div>

                  {/* Desglose mes a mes */}
                  <div className="c-desglose">
                    <div className="c-desglose-t">Desglose mes a mes</div>
                    <table className="c-tabla">
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th>Variación</th>
                          <th>Acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculo.desglose.map((d, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: "#fff" }}>{nombreMes(d.mes)}</td>
                            <td style={{ color: "#22c55e" }}>+{d.variacion.toFixed(2)}%</td>
                            <td style={{ color: "rgba(255,255,255,0.5)" }}>+{d.acumulado.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Tab Próximos ajustes ═══ */}
        {tab === "tabla" && (
          <div>
            {!montoNum ? (
              <div className="c-card">
                <div className="c-vacio">
                  <div className="c-vacio-icon">📅</div>
                  <div className="c-vacio-txt">Ingresá un monto en la calculadora</div>
                  <div className="c-vacio-sub">Se proyectarán los próximos 4 períodos de ajuste.</div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 12, fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>
                  Proyección de los próximos 4 ajustes por <strong style={{ color: indiceInfo.color }}>{indiceInfo.nombre}</strong> cada {periodoAjuste} meses
                </div>
                {proximosAjustes.map((a, i) => (
                  <div key={i} className="c-ajuste">
                    <div>
                      <div className="c-ajuste-n">Ajuste {i + 1}</div>
                      <div className="c-ajuste-periodo">{a.periodo}</div>
                    </div>
                    <div style={{ flex: 1, padding: "0 16px" }}>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(a.variacion, 50) * 2}%`, background: indiceInfo.color, borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "Montserrat,sans-serif", marginTop: 4 }}>
                        Anterior: {formatARS(a.montoAnterior)}
                      </div>
                    </div>
                    <div className="c-ajuste-monto">
                      <div className="c-ajuste-monto">{formatARS(a.montoNuevo)}</div>
                      <div className="c-ajuste-pct" style={{ color: "#22c55e" }}>{formatPct(a.variacion)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Tab Comparar índices ═══ */}
        {tab === "comparar" && (
          <div>
            {!montoNum ? (
              <div className="c-card">
                <div className="c-vacio">
                  <div className="c-vacio-icon">⚖️</div>
                  <div className="c-vacio-txt">Ingresá un monto en la calculadora</div>
                  <div className="c-vacio-sub">Compará cuánto daría el mismo alquiler con cada índice.</div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 12, fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>
                  Comparación de {formatARS(montoNum)} actualizado por cada índice · {periodoAjuste} meses
                </div>
                {comparacion.map((c, i) => {
                  const maxPct = comparacion[0].variacion;
                  const pctBarra = maxPct > 0 ? (c.variacion / maxPct) * 100 : 0;
                  return (
                    <div key={c.id} className="c-comp-item" style={indice === c.id ? { borderColor: c.color } : {}}>
                      <div className="c-comp-nombre" style={{ color: c.color }}>{c.nombre}</div>
                      <div className="c-comp-barra-wrap">
                        <div className="c-comp-barra-bg">
                          <div className="c-comp-barra" style={{ width: `${pctBarra}%`, background: c.color }} />
                        </div>
                        <div className="c-comp-desc">{c.descripcion}</div>
                      </div>
                      <div className="c-comp-monto">
                        <div className="c-comp-monto-val">{formatARS(c.montoNuevo)}</div>
                        <div className="c-comp-monto-pct" style={{ color: "#22c55e" }}>{formatPct(c.variacion)}</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                  💡 Los datos de variación son aproximados. Para contratos legales verificá los valores oficiales en el BCRA e INDEC.
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
