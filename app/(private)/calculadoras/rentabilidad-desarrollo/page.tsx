"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function usd(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function pct(n: number, dec = 1): string {
  return `${n.toFixed(dec)}%`;
}

function num(s: string): number {
  const cleaned = s.replace(/[^\d.,-]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "estructura" | "flujo" | "sensibilidad";
type FinanciacionTipo = "propio" | "credito";

interface Inputs {
  // Terreno
  terrenoCompra: string;
  terrenoGastosPct: string;
  // Construcción
  m2Construir: string;
  costoM2: string;
  imprevistoPct: string;
  // Honorarios
  arquitectoPct: string;
  ingenierosPct: string;
  gestoriaFijo: string;
  // Comercialización
  comisionPct: string;
  publicidadFijo: string;
  // Financiación
  financiacion: FinanciacionTipo;
  tasaAnual: string;
  plazoMeses: string;
  // Ingresos
  numUnidades: string;
  precioVentaUni: string;
  absorcionMeses: string;
  descuentoPozoPct: string;
}

interface FaseFlujo {
  nombre: string;
  mesInicio: number;
  mesFin: number;
  pctConstruccion: number;
  incluyeTerreno: boolean;
  incluyeComercializacion: boolean;
}

interface FilaFlujo {
  mes: number;
  fase: string;
  egresos: number;
  ingresos: number;
  flujoNeto: number;
  flujoAcum: number;
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid #222222",
  borderRadius: 6,
  color: "#e0e0e0",
  fontFamily: "Inter, sans-serif",
  fontSize: 14,
  padding: "8px 10px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(224,224,224,0.4)",
  marginBottom: 5,
  display: "block",
};

const cardStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #222222",
  borderRadius: 10,
  padding: "18px 20px",
  marginBottom: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 9,
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 800,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(224,224,224,0.2)",
  marginBottom: 14,
};

// ── Fases fijas (ponderación editable) ───────────────────────────────────────

const FASES_DEFAULT: FaseFlujo[] = [
  { nombre: "Lanzamiento",    mesInicio: 1,  mesFin: 3,  pctConstruccion: 20, incluyeTerreno: true,  incluyeComercializacion: false },
  { nombre: "Estructura",     mesInicio: 4,  mesFin: 8,  pctConstruccion: 35, incluyeTerreno: false, incluyeComercializacion: false },
  { nombre: "Terminaciones",  mesInicio: 9,  mesFin: 14, pctConstruccion: 35, incluyeTerreno: false, incluyeComercializacion: false },
  { nombre: "Ventas/Entrega", mesInicio: 15, mesFin: 18, pctConstruccion: 10, incluyeTerreno: false, incluyeComercializacion: true  },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function RentabilidadDesarrolloPage() {
  const [tab, setTab] = useState<TabId>("estructura");
  const [inputs, setInputs] = useState<Inputs>({
    terrenoCompra:   "300000",
    terrenoGastosPct: "4",
    m2Construir:     "800",
    costoM2:         "1200",
    imprevistoPct:   "10",
    arquitectoPct:   "3",
    ingenierosPct:   "2",
    gestoriaFijo:    "8000",
    comisionPct:     "3",
    publicidadFijo:  "5000",
    financiacion:    "propio",
    tasaAnual:       "12",
    plazoMeses:      "18",
    numUnidades:     "8",
    precioVentaUni:  "180000",
    absorcionMeses:  "18",
    descuentoPozoPct: "15",
  });

  const [fases, setFases] = useState<FaseFlujo[]>(FASES_DEFAULT);

  // Slider sensibilidad
  const [sliderUnidades, setSliderUnidades] = useState(8);
  const [sliderPrecio, setSliderPrecio] = useState(180000);

  const set = (k: keyof Inputs) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setInputs(prev => ({ ...prev, [k]: e.target.value }));

  const setFinanciacion = (v: FinanciacionTipo) =>
    setInputs(prev => ({ ...prev, financiacion: v }));

  const updateFasePct = (idx: number, val: string) => {
    setFases(prev => prev.map((f, i) => i === idx ? { ...f, pctConstruccion: num(val) } : f));
  };

  // ── Cálculo base ────────────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const terrenoCompra    = num(inputs.terrenoCompra);
    const terrenoGastosPct = num(inputs.terrenoGastosPct) / 100;
    const m2               = num(inputs.m2Construir);
    const costoM2          = num(inputs.costoM2);
    const imprevisto       = num(inputs.imprevistoPct) / 100;
    const arquitectoPct    = num(inputs.arquitectoPct) / 100;
    const ingenierosPct    = num(inputs.ingenierosPct) / 100;
    const gestoriaFijo     = num(inputs.gestoriaFijo);
    const comisionPct      = num(inputs.comisionPct) / 100;
    const publicidad       = num(inputs.publicidadFijo);
    const numUnidades      = Math.max(1, Math.round(num(inputs.numUnidades)));
    const precioVentaUni   = num(inputs.precioVentaUni);
    const absorcion        = Math.max(1, num(inputs.absorcionMeses));
    const descuento        = num(inputs.descuentoPozoPct) / 100;
    const tasaAnual        = num(inputs.tasaAnual) / 100;
    const plazoMeses       = Math.max(1, num(inputs.plazoMeses));

    // Costos
    const costoTerreno         = terrenoCompra * (1 + terrenoGastosPct);
    const costoConstrBase      = m2 * costoM2;
    const costoImprevistos     = costoConstrBase * imprevisto;
    const costoConstrTotal     = costoConstrBase + costoImprevistos;
    const honorariosArquit     = costoConstrBase * arquitectoPct;
    const honorariosIngenieros = costoConstrBase * ingenierosPct;
    const totalHonorarios      = honorariosArquit + honorariosIngenieros + gestoriaFijo;

    const ingresosTotales        = precioVentaUni * numUnidades;
    const costoComercializacion  = ingresosTotales * comisionPct + publicidad;

    // Costo financiero: solo si crédito
    const costoFinanciero =
      inputs.financiacion === "credito"
        ? (costoTerreno + costoConstrTotal + totalHonorarios) * tasaAnual * (plazoMeses / 12)
        : 0;

    const costoTotal =
      costoTerreno +
      costoConstrTotal +
      totalHonorarios +
      costoComercializacion +
      costoFinanciero;

    // Ingresos
    const precioEnPozo = precioVentaUni * (1 - descuento);
    const ingresosPozo = precioEnPozo * numUnidades;

    const gananciaBruta = ingresosTotales - costoTotal;
    const margenNeto    = ingresosTotales > 0 ? (gananciaBruta / ingresosTotales) * 100 : 0;

    // Capital propio invertido
    const capitalPropio =
      inputs.financiacion === "propio"
        ? costoTotal
        : costoTotal * 0.3; // asumiendo 30% propio si hay crédito

    const roi = capitalPropio > 0 ? (gananciaBruta / capitalPropio) * 100 : 0;

    // Punto de equilibrio: precio mínimo por unidad
    const puntoEquilibrio = numUnidades > 0 ? costoTotal / numUnidades : 0;

    // Período de recupero estimado (meses)
    const ingresoMensual = ingresosTotales / absorcion;
    let acum = -costoTotal;
    let mesRecupero = -1;
    for (let m = 1; m <= absorcion + 12; m++) {
      acum += ingresoMensual;
      if (acum >= 0 && mesRecupero < 0) {
        mesRecupero = m;
        break;
      }
    }

    return {
      costoTerreno,
      costoConstrBase,
      costoImprevistos,
      costoConstrTotal,
      totalHonorarios,
      costoComercializacion,
      costoFinanciero,
      costoTotal,
      ingresosTotales,
      ingresosPozo,
      precioEnPozo,
      gananciaBruta,
      margenNeto,
      roi,
      puntoEquilibrio,
      mesRecupero,
      numUnidades,
      capitalPropio,
    };
  }, [inputs]);

  // ── Flujo de caja por mes ───────────────────────────────────────────────────

  const flujoData = useMemo((): FilaFlujo[] => {
    const { costoTerreno, costoConstrTotal, totalHonorarios, costoComercializacion, ingresosTotales } = calc;
    const absorcion   = Math.max(1, num(inputs.absorcionMeses));
    const plazoMeses  = Math.max(1, num(inputs.plazoMeses));
    const totalMeses  = Math.max(plazoMeses, absorcion, 18);

    // Meses de ingreso: distribuidos uniformemente desde mes 1 hasta absorcion
    const ingresoMensual = ingresosTotales / absorcion;

    // Calcular duración real del proyecto según fases
    const ultimoMes = Math.max(...fases.map(f => f.mesFin), totalMeses);

    const rows: FilaFlujo[] = [];
    let acum = 0;

    for (let mes = 1; mes <= ultimoMes; mes++) {
      const fase = fases.find(f => mes >= f.mesInicio && mes <= f.mesFin);
      const faseNombre = fase?.nombre ?? "Post-entrega";

      let egresosMes = 0;

      if (fase) {
        const duracionFase = fase.mesFin - fase.mesInicio + 1;
        // Construcción prorrateada en la fase
        const constrFase = (costoConstrTotal * (fase.pctConstruccion / 100)) / duracionFase;
        egresosMes += constrFase;
        // Honorarios proporcionales a construcción de esta fase
        egresosMes += (totalHonorarios * (fase.pctConstruccion / 100)) / duracionFase;
        // Terreno y permisos en lanzamiento
        if (fase.incluyeTerreno) {
          egresosMes += costoTerreno / duracionFase;
        }
        // Comercialización en ventas/entrega
        if (fase.incluyeComercializacion) {
          egresosMes += costoComercializacion / duracionFase;
        }
      }

      const ingresosMes = mes <= absorcion ? ingresoMensual : 0;
      const flujoNeto = ingresosMes - egresosMes;
      acum += flujoNeto;

      rows.push({ mes, fase: faseNombre, egresos: egresosMes, ingresos: ingresosMes, flujoNeto, flujoAcum: acum });
    }

    return rows;
  }, [calc, inputs, fases]);

  const mesBreakeven = useMemo(() => {
    const row = flujoData.find(r => r.flujoAcum >= 0);
    return row?.mes ?? -1;
  }, [flujoData]);

  // ── Sensibilidad ────────────────────────────────────────────────────────────

  type SensCell = { roi: number; label: string; color: string };
  type SensMatrix = SensCell[][];

  const sensibilidadMatrix = useMemo((): SensMatrix => {
    const pctVariaciones = [-20, -10, 0, 10, 20];
    const precioBase  = num(inputs.precioVentaUni);
    const costoM2Base = num(inputs.costoM2);

    return pctVariaciones.map(yPct => {
      return pctVariaciones.map(xPct => {
        const precioVenta  = precioBase * (1 + xPct / 100);
        const costoM2Var   = costoM2Base * (1 + yPct / 100);

        const m2             = num(inputs.m2Construir);
        const imprevisto     = num(inputs.imprevistoPct) / 100;
        const arquitectoPct  = num(inputs.arquitectoPct) / 100;
        const ingenierosPct  = num(inputs.ingenierosPct) / 100;
        const gestoriaFijo   = num(inputs.gestoriaFijo);
        const comisionPct    = num(inputs.comisionPct) / 100;
        const publicidad     = num(inputs.publicidadFijo);
        const numUnidades    = Math.max(1, Math.round(num(inputs.numUnidades)));
        const terrenoCompra  = num(inputs.terrenoCompra);
        const terrenoGastosPct = num(inputs.terrenoGastosPct) / 100;
        const tasaAnual      = num(inputs.tasaAnual) / 100;
        const plazoMeses     = Math.max(1, num(inputs.plazoMeses));

        const costoTerreno     = terrenoCompra * (1 + terrenoGastosPct);
        const costoConstrBase  = m2 * costoM2Var;
        const costoConstrTotal = costoConstrBase * (1 + imprevisto);
        const totalHonorarios  = costoConstrBase * (arquitectoPct + ingenierosPct) + gestoriaFijo;
        const ingresos         = precioVenta * numUnidades;
        const comercializacion = ingresos * comisionPct + publicidad;
        const costoFinanciero  =
          inputs.financiacion === "credito"
            ? (costoTerreno + costoConstrTotal + totalHonorarios) * tasaAnual * (plazoMeses / 12)
            : 0;

        const costoTotal = costoTerreno + costoConstrTotal + totalHonorarios + comercializacion + costoFinanciero;
        const ganancia   = ingresos - costoTotal;
        const capital    = inputs.financiacion === "propio" ? costoTotal : costoTotal * 0.3;
        const roiVal     = capital > 0 ? (ganancia / capital) * 100 : 0;

        const color =
          roiVal > 15 ? "#16a34a" :
          roiVal > 5  ? "#ca8a04" :
                        "#cc0000";

        return { roi: roiVal, label: pct(roiVal, 1), color };
      });
    });
  }, [inputs]);

  // ROI con slider de unidades
  const roiSliderUnidades = useMemo(() => {
    const n = sliderUnidades;
    const precioVenta = num(inputs.precioVentaUni);
    const m2          = num(inputs.m2Construir);
    const costoM2Val  = num(inputs.costoM2);
    const imprevisto  = num(inputs.imprevistoPct) / 100;
    const arquitectoPct = num(inputs.arquitectoPct) / 100;
    const ingenierosPct = num(inputs.ingenierosPct) / 100;
    const gestoriaFijo  = num(inputs.gestoriaFijo);
    const comisionPct   = num(inputs.comisionPct) / 100;
    const publicidad    = num(inputs.publicidadFijo);
    const terrenoCompra = num(inputs.terrenoCompra);
    const terrenoGastosPct = num(inputs.terrenoGastosPct) / 100;
    const tasaAnual    = num(inputs.tasaAnual) / 100;
    const plazoMeses   = Math.max(1, num(inputs.plazoMeses));

    const costoTerreno     = terrenoCompra * (1 + terrenoGastosPct);
    const costoConstrBase  = m2 * costoM2Val;
    const costoConstrTotal = costoConstrBase * (1 + imprevisto);
    const totalHonorarios  = costoConstrBase * (arquitectoPct + ingenierosPct) + gestoriaFijo;
    const ingresos         = precioVenta * n;
    const comercializacion = ingresos * comisionPct + publicidad;
    const costoFinanciero  =
      inputs.financiacion === "credito"
        ? (costoTerreno + costoConstrTotal + totalHonorarios) * tasaAnual * (plazoMeses / 12)
        : 0;
    const costoTotal = costoTerreno + costoConstrTotal + totalHonorarios + comercializacion + costoFinanciero;
    const ganancia   = ingresos - costoTotal;
    const capital    = inputs.financiacion === "propio" ? costoTotal : costoTotal * 0.3;
    return capital > 0 ? (ganancia / capital) * 100 : 0;
  }, [sliderUnidades, inputs]);

  // Punto de equilibrio con slider de precio
  const peSliderPrecio = useMemo(() => {
    const n = Math.max(1, Math.round(num(inputs.numUnidades)));
    const m2          = num(inputs.m2Construir);
    const costoM2Val  = num(inputs.costoM2);
    const imprevisto  = num(inputs.imprevistoPct) / 100;
    const arquitectoPct = num(inputs.arquitectoPct) / 100;
    const ingenierosPct = num(inputs.ingenierosPct) / 100;
    const gestoriaFijo  = num(inputs.gestoriaFijo);
    const comisionPct   = num(inputs.comisionPct) / 100;
    const publicidad    = num(inputs.publicidadFijo);
    const terrenoCompra = num(inputs.terrenoCompra);
    const terrenoGastosPct = num(inputs.terrenoGastosPct) / 100;
    const tasaAnual    = num(inputs.tasaAnual) / 100;
    const plazoMeses   = Math.max(1, num(inputs.plazoMeses));

    const costoTerreno     = terrenoCompra * (1 + terrenoGastosPct);
    const costoConstrBase  = m2 * costoM2Val;
    const costoConstrTotal = costoConstrBase * (1 + imprevisto);
    const totalHonorarios  = costoConstrBase * (arquitectoPct + ingenierosPct) + gestoriaFijo;

    // Comercialización depende del precio slider
    const ingresos         = sliderPrecio * n;
    const comercializacion = ingresos * comisionPct + publicidad;
    const costoFinanciero  =
      inputs.financiacion === "credito"
        ? (costoTerreno + costoConstrTotal + totalHonorarios) * tasaAnual * (plazoMeses / 12)
        : 0;
    const costoTotal = costoTerreno + costoConstrTotal + totalHonorarios + comercializacion + costoFinanciero;
    return n > 0 ? costoTotal / n : 0;
  }, [sliderPrecio, inputs]);

  // ── Gráfico SVG ─────────────────────────────────────────────────────────────

  const SVG_W = 700;
  const SVG_H = 300;
  const PAD_L = 80;
  const PAD_R = 20;
  const PAD_T = 20;
  const PAD_B = 40;

  const svgData = useMemo(() => {
    if (flujoData.length === 0) return null;

    const maxEgreso = Math.max(...flujoData.map(r => r.egresos));
    const maxIngreso = Math.max(...flujoData.map(r => r.ingresos));
    const maxBar = Math.max(maxEgreso, maxIngreso, 1);

    const acumValues = flujoData.map(r => r.flujoAcum);
    const minAcum = Math.min(...acumValues);
    const maxAcum = Math.max(...acumValues);
    const rangeAcum = maxAcum - minAcum || 1;

    const n = flujoData.length;
    const innerW = SVG_W - PAD_L - PAD_R;
    const innerH = SVG_H - PAD_T - PAD_B;
    const barW = Math.max(2, (innerW / n) * 0.35);

    const xOf = (i: number) => PAD_L + (i + 0.5) * (innerW / n);
    const yBar = (val: number) => PAD_T + innerH - (val / maxBar) * innerH;
    const yLine = (val: number) => PAD_T + innerH - ((val - minAcum) / rangeAcum) * innerH;

    const zeroY = yLine(0);

    const linePts = flujoData
      .map((r, i) => `${xOf(i).toFixed(1)},${yLine(r.flujoAcum).toFixed(1)}`)
      .join(" ");

    return { flujoData, maxBar, n, innerW, innerH, barW, xOf, yBar, yLine, zeroY, linePts, acumValues, minAcum, maxAcum };
  }, [flujoData]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  const KpiCard = ({
    label,
    value,
    sub,
    color = "#cc0000",
  }: {
    label: string;
    value: string;
    sub?: string;
    color?: string;
  }) => (
    <div
      style={{
        ...cardStyle,
        flex: 1,
        minWidth: 130,
        marginBottom: 0,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 9, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(224,224,224,0.3)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontFamily: "'Montserrat', sans-serif", fontWeight: 900, color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "rgba(224,224,224,0.25)", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
          {sub}
        </div>
      )}
    </div>
  );

  const Row = ({ label, val, color, bold, sub }: { label: string; val: string; color?: string; bold?: boolean; sub?: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 13, color: "rgba(224,224,224,0.55)", fontFamily: "Inter, sans-serif" }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 900 : 600, fontFamily: "'Montserrat', sans-serif", color: color ?? "rgba(224,224,224,0.8)" }}>{val}</span>
    </div>
  );

  // ── Tab: Estructura ─────────────────────────────────────────────────────────

  const renderEstructura = () => (
    <div style={{ display: "grid", gridTemplateColumns: "clamp(280px,35%,360px) 1fr", gap: 20 }}>
      {/* Columna inputs */}
      <div>

        {/* Terreno */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Terreno</div>
          <div style={{ marginBottom: 12 }}>
            <span style={labelStyle}>Precio de compra (USD)</span>
            <input style={inputStyle} value={inputs.terrenoCompra} onChange={set("terrenoCompra")} inputMode="decimal" />
          </div>
          <div>
            <span style={labelStyle}>Gastos escritura / comisiones (%)</span>
            <input style={inputStyle} value={inputs.terrenoGastosPct} onChange={set("terrenoGastosPct")} inputMode="decimal" />
          </div>
        </div>

        {/* Construcción */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Construcción</div>
          <div style={{ marginBottom: 12 }}>
            <span style={labelStyle}>m² a construir</span>
            <input style={inputStyle} value={inputs.m2Construir} onChange={set("m2Construir")} inputMode="decimal" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={labelStyle}>Costo por m² (USD)</span>
            <input style={inputStyle} value={inputs.costoM2} onChange={set("costoM2")} inputMode="decimal" />
          </div>
          <div>
            <span style={labelStyle}>Imprevistos (%)</span>
            <input style={inputStyle} value={inputs.imprevistoPct} onChange={set("imprevistoPct")} inputMode="decimal" />
          </div>
        </div>

        {/* Honorarios */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Honorarios profesionales</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <span style={labelStyle}>Arquitecto (% constr.)</span>
              <input style={inputStyle} value={inputs.arquitectoPct} onChange={set("arquitectoPct")} inputMode="decimal" />
            </div>
            <div>
              <span style={labelStyle}>Ing. / Dirección (% constr.)</span>
              <input style={inputStyle} value={inputs.ingenierosPct} onChange={set("ingenierosPct")} inputMode="decimal" />
            </div>
          </div>
          <div>
            <span style={labelStyle}>Gestoría y permisos (USD fijo)</span>
            <input style={inputStyle} value={inputs.gestoriaFijo} onChange={set("gestoriaFijo")} inputMode="decimal" />
          </div>
        </div>

        {/* Comercialización */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Comercialización</div>
          <div style={{ marginBottom: 10 }}>
            <span style={labelStyle}>Comisión inmobiliaria (% precio venta)</span>
            <input style={inputStyle} value={inputs.comisionPct} onChange={set("comisionPct")} inputMode="decimal" />
          </div>
          <div>
            <span style={labelStyle}>Publicidad y marketing (USD)</span>
            <input style={inputStyle} value={inputs.publicidadFijo} onChange={set("publicidadFijo")} inputMode="decimal" />
          </div>
        </div>

        {/* Financiación */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Financiación</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["propio", "credito"] as const).map(v => (
              <button
                key={v}
                onClick={() => setFinanciacion(v)}
                style={{
                  background: inputs.financiacion === v ? "rgba(204,0,0,0.2)" : "none",
                  border: `1px solid ${inputs.financiacion === v ? "#cc0000" : "#333"}`,
                  borderRadius: 20,
                  color: inputs.financiacion === v ? "#cc0000" : "rgba(224,224,224,0.3)",
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  padding: "5px 14px",
                  cursor: "pointer",
                }}
              >
                {v === "propio" ? "Capital Propio" : "Crédito"}
              </button>
            ))}
          </div>
          {inputs.financiacion === "credito" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={labelStyle}>Tasa anual (%)</span>
                <input style={inputStyle} value={inputs.tasaAnual} onChange={set("tasaAnual")} inputMode="decimal" />
              </div>
              <div>
                <span style={labelStyle}>Plazo construcción (meses)</span>
                <input style={inputStyle} value={inputs.plazoMeses} onChange={set("plazoMeses")} inputMode="decimal" />
              </div>
            </div>
          )}
        </div>

        {/* Ingresos */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Ingresos — Unidades</div>
          <div style={{ marginBottom: 10 }}>
            <span style={labelStyle}>Número de unidades</span>
            <input style={inputStyle} value={inputs.numUnidades} onChange={set("numUnidades")} inputMode="numeric" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={labelStyle}>Precio de venta promedio por unidad (USD)</span>
            <input style={inputStyle} value={inputs.precioVentaUni} onChange={set("precioVentaUni")} inputMode="decimal" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={labelStyle}>Absorción de mercado (meses)</span>
              <input style={inputStyle} value={inputs.absorcionMeses} onChange={set("absorcionMeses")} inputMode="decimal" />
            </div>
            <div>
              <span style={labelStyle}>Desc. venta en pozo (%)</span>
              <input style={inputStyle} value={inputs.descuentoPozoPct} onChange={set("descuentoPozoPct")} inputMode="decimal" />
            </div>
          </div>
          <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid #222" }}>
            <span style={{ fontSize: 11, color: "rgba(224,224,224,0.35)", fontFamily: "Inter, sans-serif" }}>
              Precio en pozo: {usd(calc.precioEnPozo)} / unidad
            </span>
          </div>
        </div>
      </div>

      {/* Columna resultados */}
      <div>
        {/* KPIs */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <KpiCard label="Costo total" value={usd(calc.costoTotal)} color="#cc0000" sub="proyecto" />
          <KpiCard label="Ingresos totales" value={usd(calc.ingresosTotales)} color="#22c55e" sub="proyectados" />
          <KpiCard label="Ganancia bruta" value={usd(calc.gananciaBruta)} color={calc.gananciaBruta >= 0 ? "#a78bfa" : "#ef4444"} sub={pct(calc.gananciaBruta / (calc.ingresosTotales || 1) * 100)} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <KpiCard label="ROI cap. propio" value={pct(calc.roi)} color={calc.roi > 15 ? "#22c55e" : calc.roi > 5 ? "#ca8a04" : "#ef4444"} />
          <KpiCard label="Margen neto" value={pct(calc.margenNeto)} color="#60a5fa" />
          <KpiCard label="Recupero" value={calc.mesRecupero > 0 ? `${calc.mesRecupero} meses` : "N/A"} color="#f97316" sub="estimado" />
        </div>

        {/* Desglose costos */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Desglose de costos</div>
          <Row label="Terreno (compra + gastos)" val={usd(calc.costoTerreno)} />
          <Row label={`Construcción base (${inputs.m2Construir} m² × USD ${inputs.costoM2})`} val={usd(calc.costoConstrBase)} />
          <Row label={`Imprevistos (${inputs.imprevistoPct}%)`} val={usd(calc.costoImprevistos)} />
          <Row label="Honorarios profesionales" val={usd(calc.totalHonorarios)} />
          <Row label="Comercialización" val={usd(calc.costoComercializacion)} />
          {inputs.financiacion === "credito" && (
            <Row label={`Costo financiero (${inputs.tasaAnual}% × ${inputs.plazoMeses}m)`} val={usd(calc.costoFinanciero)} color="#f97316" />
          )}
          <Row label="COSTO TOTAL" val={usd(calc.costoTotal)} bold color="#cc0000" />
        </div>

        {/* Desglose ingresos */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Desglose de ingresos</div>
          <Row label={`${calc.numUnidades} unidades × USD ${num(inputs.precioVentaUni).toLocaleString("es-AR")}`} val={usd(calc.ingresosTotales)} color="#22c55e" />
          <Row label={`Precio en pozo (−${inputs.descuentoPozoPct}%)`} val={usd(calc.ingresosPozo)} color="#86efac" sub="si se vende en pozo" />
          <Row label="Ganancia bruta" val={usd(calc.gananciaBruta)} bold color={calc.gananciaBruta >= 0 ? "#a78bfa" : "#ef4444"} />
          <Row label="Margen neto" val={pct(calc.margenNeto)} />
        </div>

        {/* Punto de equilibrio */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Punto de equilibrio</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "rgba(224,224,224,0.55)", fontFamily: "Inter, sans-serif" }}>
              Precio mínimo de venta por unidad para no perder
            </span>
            <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Montserrat', sans-serif", color: "#f97316" }}>
              {usd(calc.puntoEquilibrio)}
            </span>
          </div>
          {num(inputs.precioVentaUni) > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(224,224,224,0.3)", marginBottom: 4 }}>
                <span>Breakeven</span>
                <span>Precio actual: {usd(num(inputs.precioVentaUni))}</span>
              </div>
              <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min((calc.puntoEquilibrio / num(inputs.precioVentaUni)) * 100, 100)}%`,
                  background: "linear-gradient(to right, #cc0000, #f97316)",
                  borderRadius: 4,
                }} />
              </div>
              <div style={{ fontSize: 10, color: "rgba(224,224,224,0.25)", marginTop: 4, textAlign: "right", fontFamily: "Inter, sans-serif" }}>
                Margen sobre breakeven: {pct(((num(inputs.precioVentaUni) - calc.puntoEquilibrio) / (num(inputs.precioVentaUni) || 1)) * 100)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Tab: Flujo de caja ───────────────────────────────────────────────────────

  const renderFlujo = () => (
    <div>
      {/* Fases editables */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Ponderación de fases (% construcción — debe sumar 100%)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {fases.map((fase, idx) => (
            <div key={fase.nombre}>
              <span style={labelStyle}>{fase.nombre} (mes {fase.mesInicio}–{fase.mesFin})</span>
              <input
                style={inputStyle}
                value={fase.pctConstruccion}
                onChange={e => updateFasePct(idx, e.target.value)}
                inputMode="decimal"
                type="number"
                min="0"
                max="100"
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: fases.reduce((s, f) => s + f.pctConstruccion, 0) === 100 ? "#22c55e" : "#cc0000", fontFamily: "Inter, sans-serif" }}>
          Total: {fases.reduce((s, f) => s + f.pctConstruccion, 0)}% {fases.reduce((s, f) => s + f.pctConstruccion, 0) !== 100 && "⚠ Debe ser 100%"}
        </div>
      </div>

      {/* Breakeven info */}
      {mesBreakeven > 0 && (
        <div style={{ ...cardStyle, borderColor: "#16a34a", background: "rgba(22,163,74,0.06)", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 28, fontFamily: "'Montserrat', sans-serif", fontWeight: 900, color: "#22c55e" }}>
            Mes {mesBreakeven}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", color: "#22c55e" }}>Breakeven del flujo acumulado</div>
            <div style={{ fontSize: 11, color: "rgba(224,224,224,0.4)", fontFamily: "Inter, sans-serif" }}>El flujo acumulado pasa a positivo en el mes {mesBreakeven}</div>
          </div>
        </div>
      )}

      {/* Gráfico SVG */}
      <div style={{ ...cardStyle, overflowX: "auto" }}>
        <div style={sectionTitleStyle}>Egresos vs Ingresos por mes — Flujo acumulado</div>
        {svgData && (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, background: "#cc0000", borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "rgba(224,224,224,0.4)", fontFamily: "Inter, sans-serif" }}>Egresos</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, background: "#22c55e", borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "rgba(224,224,224,0.4)", fontFamily: "Inter, sans-serif" }}>Ingresos</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 2, background: "#60a5fa" }} />
                <span style={{ fontSize: 10, color: "rgba(224,224,224,0.4)", fontFamily: "Inter, sans-serif" }}>Flujo acumulado</span>
              </div>
            </div>
            <svg
              width={SVG_W}
              height={SVG_H}
              style={{ maxWidth: "100%", display: "block" }}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Eje Y labels */}
              {[0, 0.25, 0.5, 0.75, 1].map(t => {
                const y = PAD_T + (1 - t) * (SVG_H - PAD_T - PAD_B);
                const val = svgData.maxBar * t;
                return (
                  <g key={t}>
                    <line x1={PAD_L} y1={y} x2={SVG_W - PAD_R} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                    <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={9} fill="rgba(224,224,224,0.25)" fontFamily="Inter,sans-serif">
                      {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                    </text>
                  </g>
                );
              })}

              {/* Línea cero del flujo acumulado */}
              <line
                x1={PAD_L}
                y1={svgData.zeroY}
                x2={SVG_W - PAD_R}
                y2={svgData.zeroY}
                stroke="rgba(96,165,250,0.3)"
                strokeWidth={1}
                strokeDasharray="4 3"
              />

              {/* Barras */}
              {svgData.flujoData.map((row, i) => {
                const x = svgData.xOf(i);
                const bw = svgData.barW;
                const baseY = PAD_T + (SVG_H - PAD_T - PAD_B);
                const eH = row.egresos > 0 ? ((row.egresos / svgData.maxBar) * (SVG_H - PAD_T - PAD_B)) : 0;
                const iH = row.ingresos > 0 ? ((row.ingresos / svgData.maxBar) * (SVG_H - PAD_T - PAD_B)) : 0;
                return (
                  <g key={i}>
                    {/* Egreso */}
                    {eH > 0 && (
                      <rect x={x - bw - 1} y={baseY - eH} width={bw} height={eH} fill="#cc0000" opacity={0.75} rx={1} />
                    )}
                    {/* Ingreso */}
                    {iH > 0 && (
                      <rect x={x + 1} y={baseY - iH} width={bw} height={iH} fill="#22c55e" opacity={0.75} rx={1} />
                    )}
                    {/* Etiqueta mes */}
                    {(i === 0 || (i + 1) % 3 === 0 || i === svgData.n - 1) && (
                      <text x={x} y={SVG_H - PAD_B + 14} textAnchor="middle" fontSize={8} fill="rgba(224,224,224,0.25)" fontFamily="Inter,sans-serif">
                        {row.mes}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Línea flujo acumulado */}
              <polyline
                points={svgData.linePts}
                fill="none"
                stroke="#60a5fa"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Punto breakeven */}
              {mesBreakeven > 0 && (() => {
                const beRow = flujoData.find(r => r.mes === mesBreakeven);
                if (!beRow) return null;
                const beIdx = flujoData.indexOf(beRow);
                const bx = svgData.xOf(beIdx);
                const by = svgData.yLine(beRow.flujoAcum);
                return (
                  <g>
                    <circle cx={bx} cy={by} r={5} fill="#22c55e" stroke="#0a0a0a" strokeWidth={2} />
                    <text x={bx + 8} y={by - 4} fontSize={9} fill="#22c55e" fontFamily="'Montserrat',sans-serif" fontWeight="bold">
                      BE m.{mesBreakeven}
                    </text>
                  </g>
                );
              })()}

              {/* Eje X label */}
              <text x={(PAD_L + SVG_W - PAD_R) / 2} y={SVG_H - 2} textAnchor="middle" fontSize={9} fill="rgba(224,224,224,0.2)" fontFamily="Inter,sans-serif">
                Mes
              </text>
            </svg>
          </>
        )}
      </div>

      {/* Tabla de flujo */}
      <div style={{ ...cardStyle, overflowX: "auto" }}>
        <div style={sectionTitleStyle}>Tabla de flujo de caja mensual</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
          <thead>
            <tr>
              {["Mes", "Fase", "Egresos", "Ingresos", "Flujo neto", "Acumulado"].map(h => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "right", fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(224,224,224,0.2)", borderBottom: "1px solid #222" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flujoData.map(row => (
              <tr key={row.mes} style={{ background: row.mes === mesBreakeven ? "rgba(22,163,74,0.08)" : "transparent" }}>
                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, color: "rgba(224,224,224,0.4)", fontSize: 11 }}>{row.mes}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "Inter, sans-serif", color: "rgba(224,224,224,0.4)", fontSize: 11 }}>{row.fase}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: "#cc0000", fontFamily: "Inter, sans-serif" }}>{row.egresos > 0 ? usd(row.egresos) : "—"}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: "#22c55e", fontFamily: "Inter, sans-serif" }}>{row.ingresos > 0 ? usd(row.ingresos) : "—"}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, color: row.flujoNeto >= 0 ? "#22c55e" : "#cc0000", fontSize: 12 }}>{usd(row.flujoNeto)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, color: row.flujoAcum >= 0 ? "#60a5fa" : "#f97316", fontSize: 12 }}>{usd(row.flujoAcum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Tab: Sensibilidad ────────────────────────────────────────────────────────

  const renderSensibilidad = () => {
    const variaciones = [-20, -10, 0, 10, 20];
    const precioBase  = num(inputs.precioVentaUni);
    const costoM2Base = num(inputs.costoM2);

    return (
      <div>
        {/* Tabla doble entrada */}
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          <div style={sectionTitleStyle}>
            ROI (%) — Precio de venta (eje X) vs Costo de construcción/m² (eje Y)
          </div>
          <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 500 }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 12px", fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, color: "rgba(224,224,224,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #222" }}>
                  Costo m² ↓ / Precio ↑
                </th>
                {variaciones.map(xPct => (
                  <th key={xPct} style={{ padding: "8px 10px", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 800, color: "rgba(224,224,224,0.5)", textAlign: "center", borderBottom: "1px solid #222" }}>
                    {xPct > 0 ? `+${xPct}%` : `${xPct}%`}<br />
                    <span style={{ fontSize: 8, fontWeight: 400, color: "rgba(224,224,224,0.25)" }}>{usd(precioBase * (1 + xPct / 100))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variaciones.map((yPct, yIdx) => (
                <tr key={yPct}>
                  <td style={{ padding: "8px 12px", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 800, color: "rgba(224,224,224,0.5)", borderRight: "1px solid #222", whiteSpace: "nowrap" }}>
                    {yPct > 0 ? `+${yPct}%` : `${yPct}%`}<br />
                    <span style={{ fontSize: 8, fontWeight: 400, color: "rgba(224,224,224,0.25)" }}>{usd(costoM2Base * (1 + yPct / 100))}/m²</span>
                  </td>
                  {variaciones.map((xPct, xIdx) => {
                    const cell = sensibilidadMatrix[yIdx][xIdx];
                    const isBase = xPct === 0 && yPct === 0;
                    return (
                      <td
                        key={xPct}
                        style={{
                          padding: "8px 10px",
                          textAlign: "center",
                          fontFamily: "'Montserrat', sans-serif",
                          fontWeight: 900,
                          fontSize: 13,
                          color: cell.color,
                          background: isBase ? "rgba(255,255,255,0.05)" : `${cell.color}14`,
                          border: isBase ? `1px solid ${cell.color}40` : "1px solid transparent",
                          borderRadius: 4,
                        }}
                      >
                        {cell.label}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { color: "#16a34a", label: "ROI > 15% — Excelente" },
              { color: "#ca8a04", label: "ROI 5–15% — Aceptable" },
              { color: "#cc0000", label: "ROI < 5% — Bajo / Pérdida" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "rgba(224,224,224,0.35)", fontFamily: "Inter, sans-serif" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Slider unidades */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>ROI según número de unidades</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(224,224,224,0.5)", fontFamily: "Inter, sans-serif" }}>Unidades:</span>
              <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Montserrat', sans-serif", color: "#e0e0e0" }}>{sliderUnidades}</span>
            </div>
            <input
              type="range"
              min={4}
              max={20}
              value={sliderUnidades}
              onChange={e => setSliderUnidades(parseInt(e.target.value))}
              style={{ width: "100%", accentColor: "#cc0000" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(224,224,224,0.2)", marginBottom: 16 }}>
              <span>4</span><span>20</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 6, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(Math.max((roiSliderUnidades / 30) * 100, 0), 100)}%`,
                  background: roiSliderUnidades > 15 ? "#22c55e" : roiSliderUnidades > 5 ? "#ca8a04" : "#cc0000",
                  borderRadius: 3,
                  transition: "width 0.2s ease",
                }} />
              </div>
              <span style={{
                fontSize: 22,
                fontWeight: 900,
                fontFamily: "'Montserrat', sans-serif",
                color: roiSliderUnidades > 15 ? "#22c55e" : roiSliderUnidades > 5 ? "#ca8a04" : "#cc0000",
                minWidth: 70,
                textAlign: "right",
              }}>
                {pct(roiSliderUnidades)}
              </span>
            </div>
            <div style={{ fontSize: 10, color: "rgba(224,224,224,0.2)", marginTop: 6, fontFamily: "Inter, sans-serif" }}>
              ROI sobre capital propio con {sliderUnidades} unidades a {usd(num(inputs.precioVentaUni))}
            </div>
          </div>

          {/* Slider precio venta */}
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>Punto de equilibrio según precio de venta</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(224,224,224,0.5)", fontFamily: "Inter, sans-serif" }}>Precio/unidad:</span>
              <span style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Montserrat', sans-serif", color: "#e0e0e0" }}>{usd(sliderPrecio)}</span>
            </div>
            <input
              type="range"
              min={Math.max(1, Math.round(num(inputs.precioVentaUni) * 0.5))}
              max={Math.round(num(inputs.precioVentaUni) * 1.5)}
              step={1000}
              value={sliderPrecio}
              onChange={e => setSliderPrecio(parseInt(e.target.value))}
              style={{ width: "100%", accentColor: "#cc0000" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(224,224,224,0.2)", marginBottom: 16 }}>
              <span>−50%</span><span>+50%</span>
            </div>
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid #222" }}>
              <div style={{ fontSize: 9, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(224,224,224,0.25)", marginBottom: 4 }}>
                Punto de equilibrio por unidad
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Montserrat', sans-serif", color: "#f97316" }}>
                {usd(peSliderPrecio)}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, fontFamily: "Inter, sans-serif", color: sliderPrecio >= peSliderPrecio ? "#22c55e" : "#cc0000" }}>
                {sliderPrecio >= peSliderPrecio
                  ? `✓ Precio cubre costos (+${usd(sliderPrecio - peSliderPrecio)} de margen)`
                  : `✗ Precio por debajo del breakeven (−${usd(peSliderPrecio - sliderPrecio)})`}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "Inter, sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@300;400;500;600&display=swap');
        input[type="text"]:focus,
        input[type="number"]:focus,
        input:not([type]):focus { border-color: rgba(204,0,0,0.5) !important; box-shadow: 0 0 0 2px rgba(204,0,0,0.1); }
        select { appearance: none; }
        tr:hover td { background: rgba(255,255,255,0.02) !important; }
        @media (max-width: 680px) {
          .rd-grid { grid-template-columns: 1fr !important; }
          .rd-sliders { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #222222", padding: "16px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/calculadoras" style={{ fontSize: 9, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(224,224,224,0.3)", textDecoration: "none" }}>
          ← CALCULADORAS
        </Link>
        <div style={{ marginTop: 6, fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: "0.04em" }}>
          Rentabilidad de <span style={{ color: "#cc0000" }}>Desarrollo Inmobiliario</span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(224,224,224,0.3)", marginTop: 2 }}>
          Análisis financiero completo para proyectos de construcción y venta de unidades
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #222222", maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", gap: 0 }}>
        {([
          ["estructura", "Estructura del Proyecto"],
          ["flujo",      "Flujo de Caja"],
          ["sensibilidad", "Sensibilidad"],
        ] as [TabId, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === id ? "2px solid #cc0000" : "2px solid transparent",
              color: tab === id ? "#e0e0e0" : "rgba(224,224,224,0.3)",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "14px 18px",
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px" }}>
        {tab === "estructura"   && renderEstructura()}
        {tab === "flujo"        && renderFlujo()}
        {tab === "sensibilidad" && renderSensibilidad()}
      </div>
    </div>
  );
}
