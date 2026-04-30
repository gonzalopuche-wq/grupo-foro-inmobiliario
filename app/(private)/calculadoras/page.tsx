"use client";

import { useState, useMemo, useEffect } from "react";

// ── Tipos ───────────────────────────────────────────────────────────────────

interface IndicesData {
  ok: boolean;
  actualizado: string | null;
  fuente: string;
  indices: Record<string, Record<string, number>>;
}

const INDICES_INFO = [
  { id: "ICL", nombre: "ICL", descripcion: "Índice para Contratos de Locación", detalle: "Promedio UVA + IPC · Ley 27.551 · Fuente: BCRA", color: "#cc0000", badge: "Alquileres" },
  { id: "IPC", nombre: "IPC", descripcion: "Índice de Precios al Consumidor", detalle: "Inflación general · Fuente: BCRA/INDEC", color: "#3b82f6", badge: "General" },
  { id: "CAC", nombre: "CAC", descripcion: "Cámara Arg. de la Construcción", detalle: "Costo de construcción · Obras", color: "#f97316", badge: "Obras" },
  { id: "CER", nombre: "CER", descripcion: "Coeficiente de Estabilización", detalle: "Créditos y deudas indexados · Fuente: BCRA", color: "#a78bfa", badge: "Créditos" },
];

const PERIODOS = [
  { id: "3", label: "Trimestral (3 meses)", meses: 3 },
  { id: "4", label: "Cuatrimestral (4 meses)", meses: 4 },
  { id: "6", label: "Semestral (6 meses)", meses: 6 },
  { id: "12", label: "Anual (12 meses)", meses: 12 },
];

const MESES_NOMBRES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// Datos de fallback actualizados al 2026 — usados inmediatamente antes de que cargue la API
const FALLBACK_INDICES: IndicesData = {
  ok: false,
  actualizado: null,
  fuente: "fallback",
  indices: {
    ICL: {
      "2024-01": 20.61,"2024-02": 15.02,"2024-03": 13.22,"2024-04": 10.73,
      "2024-05": 8.85, "2024-06": 7.26, "2024-07": 6.41, "2024-08": 4.19,
      "2024-09": 3.48, "2024-10": 3.21, "2024-11": 2.89, "2024-12": 3.12,
      "2025-01": 3.38, "2025-02": 2.91, "2025-03": 3.05, "2025-04": 2.98,
      "2025-05": 3.12, "2025-06": 2.87, "2025-07": 2.75, "2025-08": 2.70,
      "2025-09": 2.65, "2025-10": 2.80, "2025-11": 2.95, "2025-12": 3.10,
      "2026-01": 2.90, "2026-02": 2.85, "2026-03": 2.80,
    },
    IPC: {
      "2024-01": 20.60,"2024-02": 13.20,"2024-03": 11.00,"2024-04": 8.80,
      "2024-05": 4.20, "2024-06": 4.60, "2024-07": 4.00, "2024-08": 4.20,
      "2024-09": 3.50, "2024-10": 2.40, "2024-11": 2.40, "2024-12": 2.70,
      "2025-01": 2.30, "2025-02": 2.40, "2025-03": 3.70, "2025-04": 3.20,
      "2025-05": 3.30, "2025-06": 2.90, "2025-07": 2.80, "2025-08": 2.90,
      "2025-09": 3.10, "2025-10": 2.80, "2025-11": 2.70, "2025-12": 2.90,
      "2026-01": 2.60, "2026-02": 2.50, "2026-03": 2.40,
    },
    CAC: {
      "2024-01": 23.40,"2024-02": 17.10,"2024-03": 15.30,"2024-04": 12.80,
      "2024-05": 10.20,"2024-06": 8.90, "2024-07": 7.80, "2024-08": 5.30,
      "2024-09": 4.60, "2024-10": 4.10, "2024-11": 3.80, "2024-12": 4.20,
      "2025-01": 4.50, "2025-02": 3.90, "2025-03": 4.10, "2025-04": 4.00,
      "2025-05": 3.80, "2025-06": 3.70, "2025-07": 3.60, "2025-08": 3.50,
      "2025-09": 3.60, "2025-10": 3.80, "2025-11": 4.00, "2025-12": 4.20,
      "2026-01": 4.10, "2026-02": 4.00, "2026-03": 3.90,
    },
    CER: {
      "2024-01": 20.30,"2024-02": 13.00,"2024-03": 10.80,"2024-04": 8.60,
      "2024-05": 4.00, "2024-06": 4.40, "2024-07": 3.80, "2024-08": 4.00,
      "2024-09": 3.30, "2024-10": 2.30, "2024-11": 2.30, "2024-12": 2.50,
      "2025-01": 2.20, "2025-02": 2.30, "2025-03": 3.60, "2025-04": 3.10,
      "2025-05": 3.20, "2025-06": 2.80, "2025-07": 2.70, "2025-08": 2.80,
      "2025-09": 3.00, "2025-10": 2.70, "2025-11": 2.60, "2025-12": 2.80,
      "2026-01": 2.50, "2026-02": 2.40, "2026-03": 2.30,
    },
  },
};

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
  const [y, m] = yyyymm.split("-").map(Number);
  return `${MESES_NOMBRES[m - 1]} ${y}`;
}

function calcularAcumulado(
  datos: Record<string, number>,
  desde: string,
  meses: number
): { factor: number; desglose: { mes: string; variacion: number; acumulado: number }[] } {
  let acum = 1;
  const desglose = [];
  for (let i = 0; i < meses; i++) {
    const mes = sumarMeses(desde, i);
    // Buscar el valor exacto o el más cercano disponible
    const v = datos[mes] ?? obtenerFallback(datos, mes);
    acum *= (1 + v / 100);
    desglose.push({ mes, variacion: v, acumulado: (acum - 1) * 100 });
  }
  return { factor: acum, desglose };
}

// Si no hay dato para el mes exacto, usar el último disponible
function obtenerFallback(datos: Record<string, number>, mes: string): number {
  const claves = Object.keys(datos).sort();
  // Buscar el mes anterior más cercano
  const anteriores = claves.filter(k => k <= mes);
  if (anteriores.length > 0) return datos[anteriores[anteriores.length - 1]];
  // Si no hay anteriores, usar el primer disponible
  if (claves.length > 0) return datos[claves[0]];
  return 3.5; // último fallback
}

// Últimos 12 meses de datos para el mini gráfico
function ultimos12(datos: Record<string, number>): { mes: string; valor: number }[] {
  const claves = Object.keys(datos).sort().slice(-12);
  return claves.map(k => ({ mes: k, valor: datos[k] }));
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
  const [indicesData, setIndicesData] = useState<IndicesData>(FALLBACK_INDICES);
  const [loadingIndices, setLoadingIndices] = useState(true);
  const [errorIndices, setErrorIndices] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Cargar índices reales desde la API
  useEffect(() => {
    const cargar = async () => {
      try {
        setLoadingIndices(true);
        const res = await fetch("/api/indices");
        const data = await res.json();
        if (data?.indices) {
          // Mergear: API sobre fallback — si la API devuelve vacío para algún índice, se usa el fallback
          setIndicesData({
            ...data,
            indices: {
              ICL: { ...FALLBACK_INDICES.indices.ICL, ...(data.indices.ICL ?? {}) },
              IPC: { ...FALLBACK_INDICES.indices.IPC, ...(data.indices.IPC ?? {}) },
              CAC: { ...FALLBACK_INDICES.indices.CAC, ...(data.indices.CAC ?? {}) },
              CER: { ...FALLBACK_INDICES.indices.CER, ...(data.indices.CER ?? {}) },
            },
          });
        }
        setErrorIndices(!data.ok);
      } catch {
        setErrorIndices(true);
      } finally {
        setLoadingIndices(false);
      }
    };
    cargar();
  }, []);

  const indiceInfo = INDICES_INFO.find(i => i.id === indice)!;
  const mesesPeriodo = parseInt(periodoAjuste);
  const montoNum = parseFloat(alquilerActual.replace(/\./g, "").replace(",", ".")) || 0;
  const datosIndice = indicesData?.indices?.[indice] ?? {};
  const historico = ultimos12(datosIndice);

  // Variaciones para el gráfico
  const maxVal = Math.max(...historico.map(h => h.valor), 0.01);

  // Último valor conocido del índice
  const ultimoValor = historico.length > 0 ? historico[historico.length - 1].valor : null;
  const penultimoValor = historico.length > 1 ? historico[historico.length - 2].valor : null;
  const tendencia = ultimoValor && penultimoValor
    ? ultimoValor > penultimoValor ? "▲" : ultimoValor < penultimoValor ? "▼" : "→"
    : "";

  // Acumulado últimos 12 meses
  const acum12 = historico.reduce((acc, h) => acc * (1 + h.valor / 100), 1) - 1;

  // Cálculo principal
  const calculo = useMemo(() => {
    if (!montoNum || Object.keys(datosIndice).length === 0) return null;
    const { factor, desglose } = calcularAcumulado(datosIndice, fechaUltimoAjuste, mesesPeriodo);
    return {
      nuevoAlquiler: montoNum * factor,
      variacionTotal: (factor - 1) * 100,
      diferencia: montoNum * factor - montoNum,
      desglose,
    };
  }, [montoNum, datosIndice, fechaUltimoAjuste, mesesPeriodo]);

  // Proyección próximos ajustes
  const proximosAjustes = useMemo(() => {
    if (!montoNum || Object.keys(datosIndice).length === 0) return [];
    const ajustes = [];
    let montoActual = montoNum;
    let desde = fechaUltimoAjuste;
    for (let i = 0; i < 4; i++) {
      const hasta = sumarMeses(desde, mesesPeriodo);
      const { factor } = calcularAcumulado(datosIndice, desde, mesesPeriodo);
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
  }, [montoNum, datosIndice, fechaUltimoAjuste, mesesPeriodo]);

  // Comparar todos los índices
  const comparacion = useMemo(() => {
    if (!montoNum || !indicesData) return [];
    return INDICES_INFO.map(ind => {
      const datos = indicesData.indices?.[ind.id] ?? {};
      if (Object.keys(datos).length === 0) return null;
      const { factor } = calcularAcumulado(datos, fechaUltimoAjuste, mesesPeriodo);
      return { ...ind, montoNuevo: montoNum * factor, variacion: (factor - 1) * 100 };
    }).filter(Boolean).sort((a: any, b: any) => b.variacion - a.variacion) as any[];
  }, [montoNum, indicesData, fechaUltimoAjuste, mesesPeriodo]);

  const compartirWA = () => {
    if (!calculo) return;
    const txt = `📊 *Actualización de Alquiler — ${indice}*\n\nAlquiler actual: ${formatARS(montoNum)}\nNuevo alquiler: ${formatARS(calculo.nuevoAlquiler)}\nAumento: ${formatPct(calculo.variacionTotal)}\nDiferencia: ${formatARS(calculo.diferencia)}\n\nCalculado con GFI® Grupo Foro Inmobiliario`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const copiar = () => {
    if (!calculo) return;
    navigator.clipboard.writeText(
      `Alquiler actualizado por ${indice}: ${formatARS(calculo.nuevoAlquiler)} (aumento ${formatPct(calculo.variacionTotal)})`
    );
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .c-wrap { max-width: 900px; display: flex; flex-direction: column; gap: 20px; }
        .c-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .c-titulo span { color: #cc0000; }
        .c-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 3px; }
        .c-fuente { font-size: 10px; color: rgba(255,255,255,0.2); font-family: 'Montserrat',sans-serif; margin-top: 4px; display: flex; align-items: center; gap: 6px; }
        .c-fuente-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
        .c-fuente-dot.err { background: #f97316; }
        /* Índices */
        .c-indices { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
        .c-ind { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; cursor: pointer; transition: all 0.15s; }
        .c-ind:hover { border-color: rgba(255,255,255,0.15); }
        .c-ind.on { border-width: 2px; }
        .c-ind-nombre { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; }
        .c-ind-desc { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 3px; line-height: 1.4; }
        .c-ind-val { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; margin-top: 6px; }
        .c-ind-badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 8px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.08em; margin-top: 4px; }
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
        /* Mini gráfico */
        .c-grafico { display: flex; align-items: flex-end; gap: 3px; height: 60px; margin: 12px 0 4px; }
        .c-barra-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 2px; height: 100%; }
        .c-barra { width: 100%; border-radius: 2px 2px 0 0; min-height: 3px; transition: height 0.3s; }
        .c-barra-lbl { font-size: 7px; color: rgba(255,255,255,0.2); font-family: 'Montserrat',sans-serif; }
        /* Resultado */
        .c-resultado { border-radius: 8px; padding: 22px; }
        .c-res-label { font-size: 11px; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px; }
        .c-res-monto { font-family: 'Montserrat',sans-serif; font-size: 36px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
        .c-res-original { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 16px; }
        .c-res-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .c-res-stat { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 12px 14px; }
        .c-res-stat-val { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; }
        .c-res-stat-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 3px; font-family: 'Montserrat',sans-serif; }
        .c-btns { display: flex; gap: 8px; flex-wrap: wrap; }
        .c-btn-wa { flex: 1; padding: 10px; background: #25d366; border: none; border-radius: 5px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; }
        .c-btn-copy { flex: 1; padding: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; color: rgba(255,255,255,0.6); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        /* Desglose */
        .c-tabla { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 14px; }
        .c-tabla th { padding: 6px 10px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.2); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .c-tabla td { padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); font-family: 'Inter',sans-serif; color: rgba(255,255,255,0.65); }
        .c-tabla tr:last-child td { border-bottom: none; }
        /* Vacío */
        .c-vacio { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; gap: 10px; text-align: center; }
        .c-vacio-icon { font-size: 32px; }
        .c-vacio-txt { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.3); }
        .c-vacio-sub { font-size: 12px; color: rgba(255,255,255,0.2); max-width: 240px; line-height: 1.6; }
        /* Comparar */
        .c-comp-item { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
        .c-comp-nombre { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; width: 52px; flex-shrink: 0; }
        .c-comp-barra-wrap { flex: 1; }
        .c-comp-barra-bg { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; margin-bottom: 3px; }
        .c-comp-barra { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
        .c-comp-desc { font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
        .c-comp-monto { text-align: right; flex-shrink: 0; }
        .c-comp-monto-val { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .c-comp-monto-pct { font-size: 11px; margin-top: 2px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        /* Próximos */
        .c-ajuste { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .c-ajuste-n { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
        .c-ajuste-periodo { font-size: 12px; color: rgba(255,255,255,0.5); font-family: 'Inter',sans-serif; margin-top: 2px; }
        .c-ajuste-derecha { text-align: right; }
        .c-ajuste-monto { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .c-ajuste-pct { font-size: 11px; font-family: 'Montserrat',sans-serif; font-weight: 700; color: #22c55e; margin-top: 2px; }
        /* Loading */
        .c-loading { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
        .c-spinner { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
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
          <div className="c-sub">Actualizá el alquiler por ICL, IPC, CAC o CER con datos oficiales.</div>
          {loadingIndices ? (
            <div className="c-fuente"><div className="c-spinner" />Conectando con API del BCRA...</div>
          ) : (
            <div className="c-fuente">
              <div className={`c-fuente-dot${errorIndices ? " err" : ""}`} />
              {errorIndices
                ? "Usando datos de respaldo"
                : `Datos actualizados · ${indicesData?.fuente ?? "BCRA"} · ${indicesData?.actualizado ? new Date(indicesData.actualizado).toLocaleDateString("es-AR") : ""}`}
            </div>
          )}
        </div>

        {/* Selector índice */}
        <div className="c-indices">
          {INDICES_INFO.map(ind => {
            const datos = indicesData?.indices?.[ind.id] ?? {};
            const hist = Object.entries(datos).sort(([a], [b]) => a.localeCompare(b));
            const ultimo = hist.length > 0 ? hist[hist.length - 1][1] : null;
            return (
              <div
                key={ind.id}
                className={`c-ind${indice === ind.id ? " on" : ""}`}
                style={indice === ind.id ? { borderColor: ind.color, background: `${ind.color}10` } : {}}
                onClick={() => setIndice(ind.id)}
              >
                <div className="c-ind-nombre" style={{ color: indice === ind.id ? ind.color : "#fff" }}>{ind.nombre}</div>
                <div className="c-ind-desc">{ind.descripcion}</div>
                {ultimo !== null && (
                  <div className="c-ind-val" style={{ color: ind.color }}>
                    +{ultimo.toFixed(2)}% <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>último mes</span>
                  </div>
                )}
                <div className="c-ind-badge" style={{ background: `${ind.color}20`, color: ind.color, border: `1px solid ${ind.color}40` }}>
                  {ind.badge}
                </div>
              </div>
            );
          })}
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

        {/* ═══ Calculadora ═══ */}
        {tab === "calculadora" && (
          <div className="c-grid">
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
                <input className="c-input" type="month" value={fechaUltimoAjuste} onChange={e => setFechaUltimoAjuste(e.target.value)} />
              </div>

              <div className="c-field">
                <label className="c-label">Período de ajuste</label>
                <select className="c-select" value={periodoAjuste} onChange={e => setPeriodoAjuste(e.target.value)}>
                  {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>

              {/* Mini gráfico histórico */}
              {historico.length > 0 && (
                <>
                  <div className="c-card-t" style={{ marginBottom: 4 }}>Histórico {indiceInfo.nombre}</div>
                  <div className="c-grafico">
                    {historico.map((h, i) => (
                      <div key={i} className="c-barra-wrap">
                        <div
                          className="c-barra"
                          style={{
                            height: `${Math.max((h.valor / maxVal) * 100, 5)}%`,
                            background: i === historico.length - 1 ? indiceInfo.color : `${indiceInfo.color}50`,
                          }}
                          title={`${nombreMes(h.mes)}: +${h.valor.toFixed(2)}%`}
                        />
                        <div className="c-barra-lbl">{MESES_NOMBRES[parseInt(h.mes.split("-")[1]) - 1]}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif" }}>
                    <span>Último: <strong style={{ color: indiceInfo.color }}>+{ultimoValor?.toFixed(2)}% {tendencia}</strong></span>
                    <span>Acum. 12m: <strong style={{ color: "#22c55e" }}>+{(acum12 * 100).toFixed(1)}%</strong></span>
                  </div>
                </>
              )}

              {/* Info */}
              <div style={{ padding: "10px 12px", background: `${indiceInfo.color}10`, border: `1px solid ${indiceInfo.color}25`, borderRadius: 6, marginTop: 12 }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, color: indiceInfo.color, marginBottom: 3 }}>{indiceInfo.nombre}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>{indiceInfo.detalle}</div>
              </div>

              {/* Botón calcular — útil en mobile para bajar al resultado */}
              {montoNum > 0 && (
                <button
                  onClick={() => document.getElementById("resultado-alquiler")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  style={{ width: "100%", marginTop: 14, padding: "13px", background: "#cc0000", border: "none", borderRadius: 5, color: "#fff", fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}
                >
                  Ver resultado ↓
                </button>
              )}
            </div>

            {/* Resultado */}
            <div id="resultado-alquiler">
              {!montoNum || !calculo ? (
                <div className="c-card" style={{ height: "100%" }}>
                  <div className="c-vacio">
                    <div className="c-vacio-icon">🧮</div>
                    <div className="c-vacio-txt">Ingresá el monto actual</div>
                    <div className="c-vacio-sub">El nuevo alquiler se calcula automáticamente.</div>
                  </div>
                </div>
              ) : (
                <div className="c-resultado" style={{ background: `${indiceInfo.color}08`, border: `1px solid ${indiceInfo.color}25` }}>
                  <div className="c-res-label">{indiceInfo.nombre} · {periodoAjuste} meses · desde {nombreMes(fechaUltimoAjuste)}</div>
                  <div className="c-res-monto" style={{ color: "#22c55e" }}>{formatARS(calculo.nuevoAlquiler)}</div>
                  <div className="c-res-original">Alquiler actual: {formatARS(montoNum)}</div>
                  <div className="c-res-grid">
                    <div className="c-res-stat">
                      <div className="c-res-stat-val" style={{ color: "#22c55e" }}>{formatPct(calculo.variacionTotal)}</div>
                      <div className="c-res-stat-label">Aumento total</div>
                    </div>
                    <div className="c-res-stat">
                      <div className="c-res-stat-val" style={{ color: "#eab308", fontSize: 15 }}>{formatARS(calculo.diferencia)}</div>
                      <div className="c-res-stat-label">Diferencia/mes</div>
                    </div>
                  </div>
                  <div className="c-btns">
                    <button className="c-btn-wa" onClick={compartirWA}>💬 Compartir por WhatsApp</button>
                    <button className="c-btn-copy" onClick={copiar}>{copiado ? "✓ Copiado" : "📋 Copiar"}</button>
                  </div>
                  {/* Desglose */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                      Desglose mes a mes
                    </div>
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
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
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Próximos ajustes ═══ */}
        {tab === "tabla" && (
          <div>
            {!montoNum ? (
              <div className="c-card"><div className="c-vacio"><div className="c-vacio-icon">📅</div><div className="c-vacio-txt">Ingresá un monto en la calculadora</div></div></div>
            ) : (
              <>
                <div style={{ marginBottom: 10, fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>
                  Proyección de los próximos 4 ajustes por <strong style={{ color: indiceInfo.color }}>{indiceInfo.nombre}</strong> cada {periodoAjuste} meses
                </div>
                {proximosAjustes.map((a, i) => (
                  <div key={i} className="c-ajuste">
                    <div>
                      <div className="c-ajuste-n">Ajuste {i + 1}</div>
                      <div className="c-ajuste-periodo">{a.periodo}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>
                        Anterior: {formatARS(a.montoAnterior)}
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: "0 16px" }}>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(a.variacion * 2, 100)}%`, background: indiceInfo.color, borderRadius: 2 }} />
                      </div>
                    </div>
                    <div className="c-ajuste-derecha">
                      <div className="c-ajuste-monto">{formatARS(a.montoNuevo)}</div>
                      <div className="c-ajuste-pct">{formatPct(a.variacion)}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ═══ Comparar ═══ */}
        {tab === "comparar" && (
          <div>
            {!montoNum ? (
              <div className="c-card"><div className="c-vacio"><div className="c-vacio-icon">⚖️</div><div className="c-vacio-txt">Ingresá un monto en la calculadora</div></div></div>
            ) : (
              <>
                <div style={{ marginBottom: 10, fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>
                  {formatARS(montoNum)} actualizado por cada índice · {periodoAjuste} meses
                </div>
                {comparacion.map((c: any) => {
                  const maxPct = comparacion[0]?.variacion ?? 1;
                  return (
                    <div key={c.id} className="c-comp-item" style={indice === c.id ? { borderColor: c.color, background: `${c.color}08` } : {}}>
                      <div className="c-comp-nombre" style={{ color: c.color }}>{c.nombre}</div>
                      <div className="c-comp-barra-wrap">
                        <div className="c-comp-barra-bg">
                          <div className="c-comp-barra" style={{ width: `${(c.variacion / maxPct) * 100}%`, background: c.color }} />
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
                <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif" }}>
                  💡 Datos tomados de la API oficial del BCRA. Para contratos legales verificá los valores vigentes.
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          CALCULADORA DE ACTUALIZACIÓN DE ALQUILER
      ══════════════════════════════════════════════════ */}
      <ActualizacionAlquilerSection indicesData={indicesData} loadingIndices={loadingIndices} />
    </>
  );
}

// ── Sección: Calculadora de Actualización de Alquiler ─────────────────────────

const PERIODOS_ACT = [
  { value: "3", label: "Trimestral", meses: 3 },
  { value: "4", label: "Cuatrimestral", meses: 4 },
  { value: "6", label: "Semestral", meses: 6 },
  { value: "12", label: "Anual", meses: 12 },
];

function ActualizacionAlquilerSection({ indicesData, loadingIndices }: { indicesData: IndicesData; loadingIndices: boolean }) {
  const defaultFechaContrato = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  })();

  const [fechaContrato, setFechaContrato] = useState(defaultFechaContrato);
  const [montoInicial, setMontoInicial] = useState("");
  const [indiceAct, setIndiceAct] = useState("ICL");
  const [periodicidad, setPeriodicidad] = useState("6");

  const datosIndiceAct = indicesData?.indices?.[indiceAct] ?? {};
  const montoNum = parseFloat(montoInicial.replace(/\./g, "").replace(",", ".")) || 0;

  // Convertir fecha contrato a yyyymm
  const fechaContratoMes = fechaContrato.slice(0, 7);

  // Calcular tabla de períodos de ajuste desde la fecha del contrato hasta hoy
  const tablaActualizacion = useMemo(() => {
    if (!montoNum || Object.keys(datosIndiceAct).length === 0) return [];
    const periodoMeses = parseInt(periodicidad);
    const hoyMes = new Date().toISOString().slice(0, 7);
    const filas: { fecha: string; monto: number; variacion: number; acumuladoPct: number }[] = [];
    let montoActual = montoNum;
    let desde = fechaContratoMes;
    let acumFactor = 1;
    // primera fila: monto inicial
    filas.push({ fecha: desde, monto: montoNum, variacion: 0, acumuladoPct: 0 });
    while (true) {
      const hasta = sumarMeses(desde, periodoMeses);
      if (hasta > hoyMes) break;
      const { factor } = calcularAcumulado(datosIndiceAct, desde, periodoMeses);
      montoActual = montoActual * factor;
      acumFactor = acumFactor * factor;
      filas.push({ fecha: hasta, monto: montoActual, variacion: (factor - 1) * 100, acumuladoPct: (acumFactor - 1) * 100 });
      desde = hasta;
      if (filas.length > 50) break; // seguridad
    }
    return filas;
  }, [montoNum, datosIndiceAct, fechaContratoMes, periodicidad]);

  const montoActual = tablaActualizacion.length > 0 ? tablaActualizacion[tablaActualizacion.length - 1].monto : montoNum;
  const pctAcumulado = tablaActualizacion.length > 1 ? tablaActualizacion[tablaActualizacion.length - 1].acumuladoPct : 0;

  // Calcular próximo ajuste (el siguiente período que aún no llegó)
  const proximoAjuste = useMemo(() => {
    if (!montoNum || Object.keys(datosIndiceAct).length === 0) return null;
    const periodoMeses = parseInt(periodicidad);
    const hoyMes = new Date().toISOString().slice(0, 7);
    // El próximo es el primer período que empieza >= hoy
    let desde = fechaContratoMes;
    // Avanzar hasta que "hasta" sea > hoyMes (ese es el próximo)
    for (let i = 0; i < 100; i++) {
      const hasta = sumarMeses(desde, periodoMeses);
      if (hasta > hoyMes) {
        // "desde" a "hasta" es el próximo período
        const { factor } = calcularAcumulado(datosIndiceAct, desde, periodoMeses);
        return {
          fechaAjuste: hasta,
          montoEstimado: montoActual * factor,
          variacionEstimada: (factor - 1) * 100,
        };
      }
      desde = hasta;
    }
    return null;
  }, [montoNum, datosIndiceAct, fechaContratoMes, periodicidad, montoActual]);

  return (
    <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 16, marginTop: 20, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div>
        <div className="c-titulo">Calculadora de <span style={{ color: "#cc0000" }}>Actualización</span> de Alquiler</div>
        <div className="c-sub">Calculá el monto actual de un contrato según su fecha de inicio, índice y periodicidad.</div>
      </div>

      <div className="c-grid">
        {/* Inputs */}
        <div className="c-card">
          <div className="c-card-t">Datos del contrato</div>

          <div className="c-field">
            <label className="c-label">Fecha del contrato</label>
            <input className="c-input" type="date" value={fechaContrato} onChange={e => setFechaContrato(e.target.value)} />
          </div>

          <div className="c-field">
            <label className="c-label">Monto mensual inicial ($)</label>
            <input
              className="c-input"
              type="text"
              inputMode="numeric"
              placeholder="Ej: 200.000"
              value={montoInicial}
              onChange={e => setMontoInicial(e.target.value.replace(/[^0-9.,]/g, ""))}
            />
          </div>

          <div className="c-field">
            <label className="c-label">Índice de ajuste</label>
            <select className="c-select" value={indiceAct} onChange={e => setIndiceAct(e.target.value)}>
              <option value="ICL">ICL — Índice para Contratos de Locación</option>
              <option value="IPC">IPC — Índice de Precios al Consumidor</option>
            </select>
          </div>

          <div className="c-field">
            <label className="c-label">Periodicidad de ajuste</label>
            <select className="c-select" value={periodicidad} onChange={e => setPeriodicidad(e.target.value)}>
              {PERIODOS_ACT.map(p => <option key={p.value} value={p.value}>{p.label} (cada {p.meses} meses)</option>)}
            </select>
          </div>
        </div>

        {/* Resultado */}
        <div>
          {!montoNum ? (
            <div className="c-card" style={{ height: "100%" }}>
              <div className="c-vacio">
                <div className="c-vacio-icon">🏠</div>
                <div className="c-vacio-txt">Ingresá el monto inicial</div>
                <div className="c-vacio-sub">El monto actualizado se calcula automáticamente según los ajustes aplicados.</div>
              </div>
            </div>
          ) : (
            <div className="c-resultado" style={{ background: "rgba(204,0,0,0.05)", border: "1px solid rgba(204,0,0,0.18)" }}>
              <div className="c-res-label">{indiceAct} · {PERIODOS_ACT.find(p => p.value === periodicidad)?.label} · desde {new Date(fechaContrato + "T12:00:00").toLocaleDateString("es-AR")}</div>
              <div className="c-res-monto" style={{ color: "#22c55e" }}>{formatARS(montoActual)}</div>
              <div className="c-res-original">Monto inicial: {formatARS(montoNum)}</div>
              <div className="c-res-grid">
                <div className="c-res-stat">
                  <div className="c-res-stat-val" style={{ color: "#22c55e" }}>{pctAcumulado > 0 ? `+${pctAcumulado.toFixed(1)}%` : "0%"}</div>
                  <div className="c-res-stat-label">Aumento acumulado</div>
                </div>
                <div className="c-res-stat">
                  <div className="c-res-stat-val" style={{ color: "#eab308", fontSize: 15 }}>{tablaActualizacion.length > 1 ? tablaActualizacion.length - 1 : 0} ajuste{tablaActualizacion.length !== 2 ? "s" : ""}</div>
                  <div className="c-res-stat-label">Aplicados</div>
                </div>
              </div>
              {loadingIndices && <div className="c-loading"><div className="c-spinner" />Cargando índices...</div>}

              {/* Próximo ajuste — siempre visible si hay dato */}
              {proximoAjuste && montoNum > 0 && (
                <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 7 }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(234,179,8,0.7)", marginBottom: 6 }}>Próximo ajuste</div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#eab308" }}>{formatARS(proximoAjuste.montoEstimado)}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Estimado para {nombreMes(proximoAjuste.fechaAjuste)}</div>
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(234,179,8,0.8)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                      +{proximoAjuste.variacionEstimada.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabla de períodos */}
      {tablaActualizacion.length > 1 && (
        <div className="c-card">
          <div className="c-card-t">Tabla de ajustes aplicados</div>
          <div style={{ overflowX: "auto" }}>
            <table className="c-tabla">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Monto</th>
                  <th>Variación del período</th>
                  <th>Acumulado total</th>
                </tr>
              </thead>
              <tbody>
                {tablaActualizacion.map((fila, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: i === tablaActualizacion.length - 1 ? "#fff" : "rgba(255,255,255,0.6)" }}>
                      {nombreMes(fila.fecha.slice(0, 7))}
                      {i === 0 && <span style={{ fontSize: 9, marginLeft: 5, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif" }}>INICIO</span>}
                      {i === tablaActualizacion.length - 1 && i > 0 && <span style={{ fontSize: 9, marginLeft: 5, color: "#22c55e", fontFamily: "Montserrat,sans-serif" }}>ACTUAL</span>}
                    </td>
                    <td style={{ color: i === tablaActualizacion.length - 1 ? "#22c55e" : "rgba(255,255,255,0.65)", fontFamily: "Montserrat,sans-serif", fontWeight: i === tablaActualizacion.length - 1 ? 700 : 400 }}>{formatARS(fila.monto)}</td>
                    <td style={{ color: fila.variacion > 0 ? "#22c55e" : "rgba(255,255,255,0.3)" }}>{fila.variacion > 0 ? `+${fila.variacion.toFixed(2)}%` : "—"}</td>
                    <td style={{ color: fila.acumuladoPct > 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)" }}>{fila.acumuladoPct > 0 ? `+${fila.acumuladoPct.toFixed(2)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
