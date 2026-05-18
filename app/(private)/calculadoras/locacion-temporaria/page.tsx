"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtUSD(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n: number, d = 1): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TipoPropiedad = "monoambiente" | "1dorm" | "2dorm" | "3dorm" | "casa";
type TipoZona = "centrica" | "turistica" | "residencial" | "playa_montana";
type Tab = "config" | "mensual" | "viabilidad";

interface InputsPropiedad {
  precioUSD: number;
  tipo: TipoPropiedad;
  zona: TipoZona;
}

interface InputsTemporario {
  precioNocheUSD: number;
  ocupacionPct: number;
  comisionPct: number;
  limpiezaPorNocheARS: number;
  serviciosMensualesARS: number;
  conserjeriaPct: number;
  menajePctAnual: number;
  inversionEquipUSD: number;
  decorFotoUSD: number;
}

interface InputsTradicional {
  alquilerMensualUSD: number;
  gastosNoTrasladadosARS: number;
}

interface MesEstacionalidad {
  nombre: string;
  corto: string;
  diasMes: number;
  ocupacionPct: number;
}

// ── Estacionalidad base (Rosario/Interior) ────────────────────────────────────

const MESES_BASE: MesEstacionalidad[] = [
  { nombre: "Enero",      corto: "Ene", diasMes: 31, ocupacionPct: 85 },
  { nombre: "Febrero",    corto: "Feb", diasMes: 28, ocupacionPct: 80 },
  { nombre: "Marzo",      corto: "Mar", diasMes: 31, ocupacionPct: 70 },
  { nombre: "Abril",      corto: "Abr", diasMes: 30, ocupacionPct: 65 },
  { nombre: "Mayo",       corto: "May", diasMes: 31, ocupacionPct: 55 },
  { nombre: "Junio",      corto: "Jun", diasMes: 30, ocupacionPct: 50 },
  { nombre: "Julio",      corto: "Jul", diasMes: 31, ocupacionPct: 60 },
  { nombre: "Agosto",     corto: "Ago", diasMes: 31, ocupacionPct: 55 },
  { nombre: "Septiembre", corto: "Sep", diasMes: 30, ocupacionPct: 65 },
  { nombre: "Octubre",    corto: "Oct", diasMes: 31, ocupacionPct: 70 },
  { nombre: "Noviembre",  corto: "Nov", diasMes: 30, ocupacionPct: 75 },
  { nombre: "Diciembre",  corto: "Dic", diasMes: 31, ocupacionPct: 80 },
];

// ── Precios sugeridos ─────────────────────────────────────────────────────────

const PRECIOS_SUGERIDOS: Record<TipoPropiedad, Record<TipoZona, string>> = {
  monoambiente: { centrica: "USD 40–60",  turistica: "USD 45–70",  residencial: "USD 30–45",  playa_montana: "USD 50–80"  },
  "1dorm":      { centrica: "USD 55–80",  turistica: "USD 60–90",  residencial: "USD 40–60",  playa_montana: "USD 65–100" },
  "2dorm":      { centrica: "USD 70–100", turistica: "USD 80–120", residencial: "USD 55–80",  playa_montana: "USD 90–140" },
  "3dorm":      { centrica: "USD 90–130", turistica: "USD 100–150",residencial: "USD 70–100", playa_montana: "USD 120–180"},
  casa:         { centrica: "USD 100–150",turistica: "USD 110–160",residencial: "USD 80–120", playa_montana: "USD 100–180"},
};

// ── Estilos comunes ───────────────────────────────────────────────────────────

const S = {
  input: {
    width: "100%",
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 8,
    color: "#e0e0e0",
    padding: "8px 10px",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    boxSizing: "border-box" as const,
  },
  label: {
    display: "block",
    fontSize: 10,
    color: "#666",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700 as const,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    marginBottom: 4,
  },
  card: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    margin: "0 0 14px 0",
    fontSize: 10,
    color: "#555",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800 as const,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
};

// ── Componente InputField ─────────────────────────────────────────────────────

function InputField({
  label, value, onChange, type = "number", min, max, step, prefix, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  type?: "number";
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={S.label}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {prefix && (
          <span style={{ background: "#1a1a1a", border: "1px solid #222222", borderRight: "none", borderRadius: "8px 0 0 8px", padding: "8px 8px", color: "#555", fontSize: 12 }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            ...S.input,
            borderRadius: prefix ? "0 8px 8px 0" : suffix ? "8px 0 0 8px" : 8,
          }}
        />
        {suffix && (
          <span style={{ background: "#1a1a1a", border: "1px solid #222222", borderLeft: "none", borderRadius: "0 8px 8px 0", padding: "8px 8px", color: "#555", fontSize: 12, whiteSpace: "nowrap" as const }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={S.label}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{ ...S.input }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function LocacionTemporariaPage() {
  const [tab, setTab] = useState<Tab>("config");
  const [tc, setTc] = useState(1150);

  // Propiedad
  const [prop, setProp] = useState<InputsPropiedad>({
    precioUSD: 120000,
    tipo: "2dorm",
    zona: "centrica",
  });

  // Temporario
  const [temp, setTemp] = useState<InputsTemporario>({
    precioNocheUSD: 75,
    ocupacionPct: 65,
    comisionPct: 15,
    limpiezaPorNocheARS: 8000,
    serviciosMensualesARS: 45000,
    conserjeriaPct: 10,
    menajePctAnual: 5,
    inversionEquipUSD: 3000,
    decorFotoUSD: 800,
  });

  // Tradicional
  const [trad, setTrad] = useState<InputsTradicional>({
    alquilerMensualUSD: Math.round(120000 * 0.004),
    gastosNoTrasladadosARS: 30000,
  });

  // Estacionalidad personalizable
  const [meses, setMeses] = useState<MesEstacionalidad[]>(MESES_BASE);

  function updateMesOcupacion(idx: number, val: number) {
    setMeses((prev) => prev.map((m, i) => (i === idx ? { ...m, ocupacionPct: val } : m)));
  }

  // ── Cálculos base ──

  const calcs = useMemo(() => {
    const precioUSD = prop.precioUSD;

    // --- TEMPORARIO ---
    const diasAnio = 365;
    const nochesOcupadas = diasAnio * (temp.ocupacionPct / 100);
    const ingresosBrutosAnualUSD = nochesOcupadas * temp.precioNocheUSD;

    const comisionUSD = ingresosBrutosAnualUSD * (temp.comisionPct / 100);
    const comisionARS = comisionUSD * tc;

    // Gastos en ARS convertidos a USD
    const limpiezaAnualARS = temp.limpiezaPorNocheARS * nochesOcupadas;
    const limpiezaAnualUSD = limpiezaAnualARS / tc;

    const serviciosAnualARS = temp.serviciosMensualesARS * 12;
    const serviciosAnualUSD = serviciosAnualARS / tc;

    const conserjeriaUSD = ingresosBrutosAnualUSD * (temp.conserjeriaPct / 100);

    // Menaje: % anual sobre inversión en equip
    const menajeAnualUSD = temp.inversionEquipUSD * (temp.menajePctAnual / 100);

    const gastosTotalesUSD =
      comisionUSD + limpiezaAnualUSD + serviciosAnualUSD + conserjeriaUSD + menajeAnualUSD;

    const ingresoNetoAnualUSD = ingresosBrutosAnualUSD - gastosTotalesUSD;
    const yieldNetoTemp = precioUSD > 0 ? (ingresoNetoAnualUSD / precioUSD) * 100 : 0;

    const inversionInicialUSD = temp.inversionEquipUSD + temp.decorFotoUSD;
    const ingresoNetoMensualUSD = ingresoNetoAnualUSD / 12;
    const recuperoEquipMeses =
      ingresoNetoMensualUSD > 0 ? inversionInicialUSD / ingresoNetoMensualUSD : 0;

    // --- TRADICIONAL ---
    const ingresoBrutoTradAnualUSD = trad.alquilerMensualUSD * 12;
    const gastosNTAnualUSD = (trad.gastosNoTrasladadosARS * 12) / tc;
    const ingresoNetoTradAnualUSD = ingresoBrutoTradAnualUSD - gastosNTAnualUSD;
    const yieldNetoTrad = precioUSD > 0 ? (ingresoNetoTradAnualUSD / precioUSD) * 100 : 0;

    // --- COMPARATIVA ---
    const diferenciaUSD = ingresoNetoAnualUSD - ingresoNetoTradAnualUSD;
    const temporarioGana = diferenciaUSD >= 0;

    // Break-even de ocupación
    // Neto temp = dias*ocu/100*precio*(1-com%) - limpieza*dias*ocu/100/tc - servicios - conserj*dias*ocu/100*precio*(1-com%)/100 - menaje
    // Para simplificar: neto_temp(ocu) = ingresoNetoTradAnualUSD
    // ingresos_brutos = dias*ocu*precioNoche
    // neto_temp = bruto - bruto*com - limpiezaUSD*ocu/100*dias - serviciosUSD - conserj*bruto - menaje
    // neto_temp = bruto*(1 - com - conserj) - limpiezaUSD*ocu/100*dias - serviciosUSD - menaje
    // dias*ocu*precioNoche*(1-com-conserj) - limpiezaARS/tc*dias*ocu - serviciosUSD - menaje = tradNeto
    // ocu * [dias*precioNoche*(1-com-conserj) - limpiezaARS/tc*dias] = tradNeto + serviciosUSD + menaje
    const factorA =
      diasAnio *
        temp.precioNocheUSD *
        (1 - temp.comisionPct / 100 - temp.conserjeriaPct / 100) -
      (temp.limpiezaPorNocheARS / tc) * diasAnio;
    const breakEvenOcuFrac =
      factorA > 0
        ? (ingresoNetoTradAnualUSD + serviciosAnualUSD + menajeAnualUSD) / factorA
        : 1;
    const breakEvenOcuPct = Math.min(100, Math.max(0, breakEvenOcuFrac * 100));

    return {
      nochesOcupadas,
      ingresosBrutosAnualUSD,
      comisionUSD,
      comisionARS,
      limpiezaAnualUSD,
      serviciosAnualUSD,
      conserjeriaUSD,
      menajeAnualUSD,
      gastosTotalesUSD,
      ingresoNetoAnualUSD,
      yieldNetoTemp,
      recuperoEquipMeses,
      inversionInicialUSD,
      ingresoBrutoTradAnualUSD,
      ingresoNetoTradAnualUSD,
      yieldNetoTrad,
      diferenciaUSD,
      temporarioGana,
      breakEvenOcuPct,
      gastosNTAnualUSD,
    };
  }, [prop, temp, trad, tc]);

  // ── Proyección mensual ──

  const proyeccionMensual = useMemo(() => {
    let acumulado = 0;
    return meses.map((m) => {
      const nochesDisp = m.diasMes;
      const nochesOcup = Math.round(nochesDisp * (m.ocupacionPct / 100));
      const bruto = nochesOcup * temp.precioNocheUSD;
      const comision = bruto * (temp.comisionPct / 100);
      const limpieza = (temp.limpiezaPorNocheARS / tc) * nochesOcup;
      const servicios = temp.serviciosMensualesARS / tc;
      const conserjeria = bruto * (temp.conserjeriaPct / 100);
      const menaje = (temp.inversionEquipUSD * (temp.menajePctAnual / 100)) / 12;
      const gastos = comision + limpieza + servicios + conserjeria + menaje;
      const neto = bruto - gastos;
      acumulado += neto;
      return {
        ...m,
        nochesDisp,
        nochesOcup,
        bruto,
        gastos,
        neto,
        acumulado,
      };
    });
  }, [meses, temp, tc]);

  // ── Sensibilidad ──

  const ocupaciones = [40, 50, 60, 70, 80];
  const preciosVariacion = [-0.2, -0.1, 0, 0.1, 0.2];

  const sensibilidad = useMemo(() => {
    return ocupaciones.map((ocuPct) =>
      preciosVariacion.map((delta) => {
        const precio = temp.precioNocheUSD * (1 + delta);
        const noches = 365 * (ocuPct / 100);
        const bruto = noches * precio;
        const com = bruto * (temp.comisionPct / 100);
        const limp = (temp.limpiezaPorNocheARS / tc) * noches;
        const serv = (temp.serviciosMensualesARS * 12) / tc;
        const cons = bruto * (temp.conserjeriaPct / 100);
        const menaje = temp.inversionEquipUSD * (temp.menajePctAnual / 100);
        const neto = bruto - com - limp - serv - cons - menaje;
        const yield_ = prop.precioUSD > 0 ? (neto / prop.precioUSD) * 100 : 0;
        return yield_;
      })
    );
  }, [temp, prop.precioUSD, tc]);

  // ── Render helpers ──

  const maxNetoMensual = Math.max(
    ...proyeccionMensual.map((m) => Math.abs(m.neto)),
    trad.alquilerMensualUSD,
    1
  );

  const CHART_W = 720;
  const CHART_H = 280;
  const PAD_L = 60;
  const PAD_R = 20;
  const PAD_T = 20;
  const PAD_B = 40;
  const chartW = CHART_W - PAD_L - PAD_R;
  const chartH = CHART_H - PAD_T - PAD_B;
  const barW = Math.floor(chartW / 12) - 4;

  const yScale = (val: number) =>
    PAD_T + chartH - (val / maxNetoMensual) * chartH;

  const tradLineY = yScale(trad.alquilerMensualUSD);

  // ── Inline tab styles ──

  function tabBtn(active: boolean): React.CSSProperties {
    return {
      padding: "8px 20px",
      borderRadius: 8,
      border: active ? "1px solid #cc0000" : "1px solid #222222",
      background: active ? "rgba(204,0,0,0.12)" : "#111111",
      color: active ? "#cc0000" : "#666",
      cursor: "pointer",
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: "0.07em",
      textTransform: "uppercase" as const,
    };
  }

  function kpiCard(
    label: string,
    value: string,
    sub?: string,
    accent?: string
  ) {
    return (
      <div style={{ ...S.card, marginBottom: 0 }}>
        <p style={{ margin: "0 0 4px 0", fontSize: 9, color: "#555", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: 20, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: accent ?? "#e0e0e0" }}>
          {value}
        </p>
        {sub && (
          <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#555" }}>{sub}</p>
        )}
      </div>
    );
  }

  const yieldColor = (y: number) =>
    y >= 6 ? "#22c55e" : y >= 4 ? "#f59e0b" : "#cc0000";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e0e0e0",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#111111",
          borderBottom: "1px solid #222222",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap" as const,
        }}
      >
        <Link
          href="/calculadoras"
          style={{ color: "#555", textDecoration: "none", fontSize: 12 }}
        >
          ← Calculadoras
        </Link>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#e0e0e0",
          }}
        >
          Locación Temporaria
        </h1>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "#555",
            fontFamily: "'Montserrat',sans-serif",
          }}
        >
          Airbnb / Booking
        </span>
      </div>

      {/* Tipo de cambio */}
      <div
        style={{
          background: "#111111",
          borderBottom: "1px solid #222222",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 11, color: "#555", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Tipo de cambio USD →
        </span>
        <input
          type="number"
          value={tc}
          onChange={(e) => setTc(parseFloat(e.target.value) || 1150)}
          style={{ ...S.input, width: 110, padding: "5px 8px", fontSize: 13 }}
        />
        <span style={{ fontSize: 11, color: "#555" }}>ARS</span>
      </div>

      {/* Tabs */}
      <div
        style={{
          padding: "16px 24px 0",
          display: "flex",
          gap: 8,
          borderBottom: "1px solid #222222",
        }}
      >
        <button onClick={() => setTab("config")} style={tabBtn(tab === "config")}>
          Configuración y Resultados
        </button>
        <button onClick={() => setTab("mensual")} style={tabBtn(tab === "mensual")}>
          Proyección Mensual
        </button>
        <button onClick={() => setTab("viabilidad")} style={tabBtn(tab === "viabilidad")}>
          Análisis de Viabilidad
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1 — CONFIGURACIÓN Y RESULTADOS
          ═══════════════════════════════════════════════════════════════════ */}
      {tab === "config" && (
        <div
          style={{
            padding: 24,
            maxWidth: 1280,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "320px 1fr",
            gap: 24,
          }}
        >
          {/* ─── Panel inputs ─── */}
          <div>
            {/* Propiedad */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Propiedad</p>
              <InputField
                label="Precio de la propiedad (USD)"
                value={prop.precioUSD}
                onChange={(v) => {
                  setProp((p) => ({ ...p, precioUSD: v }));
                  setTrad((t) => ({ ...t, alquilerMensualUSD: Math.round(v * 0.004) }));
                }}
                prefix="USD"
              />
              <SelectField<TipoPropiedad>
                label="Tipo de propiedad"
                value={prop.tipo}
                onChange={(v) => setProp((p) => ({ ...p, tipo: v }))}
                options={[
                  { value: "monoambiente", label: "Monoambiente" },
                  { value: "1dorm", label: "1 Dormitorio" },
                  { value: "2dorm", label: "2 Dormitorios" },
                  { value: "3dorm", label: "3 Dormitorios" },
                  { value: "casa", label: "Casa" },
                ]}
              />
              <SelectField<TipoZona>
                label="Zona"
                value={prop.zona}
                onChange={(v) => setProp((p) => ({ ...p, zona: v }))}
                options={[
                  { value: "centrica", label: "Céntrica" },
                  { value: "turistica", label: "Turística" },
                  { value: "residencial", label: "Residencial" },
                  { value: "playa_montana", label: "Playa / Montaña" },
                ]}
              />
              <div style={{ background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 8, padding: "8px 12px", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "#888", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Precio sugerido/noche:{" "}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#cc0000" }}>
                  {PRECIOS_SUGERIDOS[prop.tipo][prop.zona]}
                </span>
              </div>
            </div>

            {/* Alquiler temporario */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Alquiler Temporario (Airbnb/Booking)</p>
              <InputField
                label="Precio por noche (USD)"
                value={temp.precioNocheUSD}
                onChange={(v) => setTemp((t) => ({ ...t, precioNocheUSD: v }))}
                prefix="USD"
              />
              <div style={{ marginBottom: 10 }}>
                <label style={S.label}>
                  Ocupación promedio anual — {temp.ocupacionPct}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={temp.ocupacionPct}
                  onChange={(e) =>
                    setTemp((t) => ({ ...t, ocupacionPct: parseInt(e.target.value) }))
                  }
                  style={{ width: "100%", accentColor: "#cc0000" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#444" }}>
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>
              <InputField
                label="Comisión de plataforma (%)"
                value={temp.comisionPct}
                onChange={(v) => setTemp((t) => ({ ...t, comisionPct: v }))}
                suffix="%"
                min={0}
                max={100}
                step={0.5}
              />
              <InputField
                label="Limpieza por noche (ARS)"
                value={temp.limpiezaPorNocheARS}
                onChange={(v) => setTemp((t) => ({ ...t, limpiezaPorNocheARS: v }))}
                prefix="$"
              />
              <InputField
                label="Servicios mensuales — luz/gas/internet (ARS/mes)"
                value={temp.serviciosMensualesARS}
                onChange={(v) => setTemp((t) => ({ ...t, serviciosMensualesARS: v }))}
                prefix="$"
              />
              <InputField
                label="Conserjería / gestión (%)"
                value={temp.conserjeriaPct}
                onChange={(v) => setTemp((t) => ({ ...t, conserjeriaPct: v }))}
                suffix="%"
                min={0}
                max={50}
                step={0.5}
              />
              <InputField
                label="Suplantación de menaje anual (% sobre equip.)"
                value={temp.menajePctAnual}
                onChange={(v) => setTemp((t) => ({ ...t, menajePctAnual: v }))}
                suffix="%"
                min={0}
                max={50}
                step={0.5}
              />
              <InputField
                label="Inversión inicial en equipamiento (USD)"
                value={temp.inversionEquipUSD}
                onChange={(v) => setTemp((t) => ({ ...t, inversionEquipUSD: v }))}
                prefix="USD"
              />
              <InputField
                label="Decoración y fotografía (USD)"
                value={temp.decorFotoUSD}
                onChange={(v) => setTemp((t) => ({ ...t, decorFotoUSD: v }))}
                prefix="USD"
              />
            </div>

            {/* Alquiler tradicional */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Alquiler Tradicional (comparativa)</p>
              <InputField
                label="Alquiler mensual equivalente (USD)"
                value={trad.alquilerMensualUSD}
                onChange={(v) => setTrad((t) => ({ ...t, alquilerMensualUSD: v }))}
                prefix="USD"
              />
              <p style={{ margin: "-4px 0 10px", fontSize: 10, color: "#444" }}>
                Sugerencia automática: USD {fmtUSD(prop.precioUSD * 0.004)}/mes (0.4% del valor)
              </p>
              <InputField
                label="Gastos no trasladables al inquilino — ABL, expensas (ARS/mes)"
                value={trad.gastosNoTrasladadosARS}
                onChange={(v) => setTrad((t) => ({ ...t, gastosNoTrasladadosARS: v }))}
                prefix="$"
              />
            </div>
          </div>

          {/* ─── Panel resultados ─── */}
          <div>
            {/* Badge comparativo */}
            <div
              style={{
                background: calcs.temporarioGana
                  ? "rgba(34,197,94,0.06)"
                  : "rgba(59,130,246,0.06)",
                border: `1px solid ${calcs.temporarioGana ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)"}`,
                borderRadius: 14,
                padding: "20px 24px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap" as const,
                gap: 12,
              }}
            >
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: "#555", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Mejor opción
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 28,
                    fontFamily: "'Montserrat',sans-serif",
                    fontWeight: 800,
                    color: calcs.temporarioGana ? "#22c55e" : "#3b82f6",
                  }}
                >
                  {calcs.temporarioGana ? "TEMPORARIO GANA" : "TRADICIONAL GANA"}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#777" }}>
                  Diferencia:{" "}
                  <strong style={{ color: calcs.temporarioGana ? "#22c55e" : "#3b82f6" }}>
                    {calcs.diferenciaUSD >= 0 ? "+" : ""}USD {fmtUSD(calcs.diferenciaUSD)}
                    /año
                  </strong>{" "}
                  a favor del{" "}
                  {calcs.temporarioGana ? "temporario" : "tradicional"}
                </p>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: "#555", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Break-even de ocupación
                </p>
                <p style={{ margin: 0, fontSize: 24, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#e0e0e0" }}>
                  {fmtPct(calcs.breakEvenOcuPct, 1)}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "#555" }}>
                  A partir de este % el temporario supera al tradicional
                </p>
              </div>
            </div>

            {/* KPIs — Temporario */}
            <p style={{ ...S.sectionTitle, marginBottom: 10 }}>Resultados — Temporario</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              {kpiCard(
                "Ingresos brutos anuales",
                `USD ${fmtUSD(calcs.ingresosBrutosAnualUSD)}`,
                `${Math.round(calcs.nochesOcupadas)} noches × USD ${fmtUSD(temp.precioNocheUSD)}`,
                "#e0e0e0"
              )}
              {kpiCard(
                "Comisión plataforma",
                `USD ${fmtUSD(calcs.comisionUSD)}`,
                `ARS ${fmtARS(calcs.comisionARS)}`,
                "#cc0000"
              )}
              {kpiCard(
                "Gastos totales anuales",
                `USD ${fmtUSD(calcs.gastosTotalesUSD)}`,
                `${fmtPct((calcs.gastosTotalesUSD / Math.max(calcs.ingresosBrutosAnualUSD, 1)) * 100)} de ingresos brutos`,
                "#f97316"
              )}
              {kpiCard(
                "Ingreso neto anual",
                `USD ${fmtUSD(calcs.ingresoNetoAnualUSD)}`,
                undefined,
                "#22c55e"
              )}
              {kpiCard(
                "Yield neto anual",
                fmtPct(calcs.yieldNetoTemp),
                `sobre USD ${fmtUSD(prop.precioUSD)}`,
                yieldColor(calcs.yieldNetoTemp)
              )}
              {kpiCard(
                "Recupero de equipamiento",
                `${calcs.recuperoEquipMeses > 0 ? calcs.recuperoEquipMeses.toFixed(1) : "—"} meses`,
                `Inversión inicial: USD ${fmtUSD(calcs.inversionInicialUSD)}`,
                "#a78bfa"
              )}
            </div>

            {/* KPIs — Tradicional */}
            <p style={{ ...S.sectionTitle, marginBottom: 10 }}>Resultados — Tradicional</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
              {kpiCard(
                "Ingreso neto anual",
                `USD ${fmtUSD(calcs.ingresoNetoTradAnualUSD)}`,
                `Bruto USD ${fmtUSD(calcs.ingresoBrutoTradAnualUSD)} − gastos USD ${fmtUSD(calcs.gastosNTAnualUSD)}`,
                "#3b82f6"
              )}
              {kpiCard(
                "Yield neto anual",
                fmtPct(calcs.yieldNetoTrad),
                `sobre USD ${fmtUSD(prop.precioUSD)}`,
                yieldColor(calcs.yieldNetoTrad)
              )}
            </div>

            {/* Desglose gastos temporario */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Desglose de gastos anuales — Temporario</p>
              {[
                { label: "Comisión plataforma", val: calcs.comisionUSD },
                { label: "Limpieza entre huéspedes", val: calcs.limpiezaAnualUSD },
                { label: "Servicios (luz/gas/internet)", val: calcs.serviciosAnualUSD },
                { label: "Conserjería/gestión", val: calcs.conserjeriaUSD },
                { label: "Suplantación de menaje", val: calcs.menajeAnualUSD },
              ].map((g) => {
                const pct =
                  calcs.gastosTotalesUSD > 0
                    ? (g.val / calcs.gastosTotalesUSD) * 100
                    : 0;
                return (
                  <div key={g.label} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: "#aaa" }}>{g.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0" }}>
                        USD {fmtUSD(g.val)}
                      </span>
                    </div>
                    <div style={{ background: "#1a1a1a", borderRadius: 4, height: 4 }}>
                      <div
                        style={{
                          background: "#cc0000",
                          borderRadius: 4,
                          height: 4,
                          width: `${Math.min(100, pct)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2 — PROYECCIÓN MENSUAL
          ═══════════════════════════════════════════════════════════════════ */}
      {tab === "mensual" && (
        <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
          <p style={{ ...S.sectionTitle, fontSize: 12, marginBottom: 20 }}>
            Proyección mensual con estacionalidad — ajustá la ocupación por mes
          </p>

          {/* Gráfico SVG */}
          <div style={{ ...S.card, overflowX: "auto" as const }}>
            <p style={S.sectionTitle}>Ingreso neto mensual (USD)</p>
            <svg
              width={CHART_W}
              height={CHART_H}
              style={{ display: "block", minWidth: CHART_W }}
            >
              {/* Grilla horizontal */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = PAD_T + frac * chartH;
                const val = maxNetoMensual * (1 - frac);
                return (
                  <g key={frac}>
                    <line
                      x1={PAD_L}
                      y1={y}
                      x2={CHART_W - PAD_R}
                      y2={y}
                      stroke="#1e1e1e"
                      strokeWidth={1}
                    />
                    <text
                      x={PAD_L - 6}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={9}
                      fill="#444"
                    >
                      {fmtUSD(val)}
                    </text>
                  </g>
                );
              })}

              {/* Barras rojas — ingreso neto mensual */}
              {proyeccionMensual.map((m, idx) => {
                const x = PAD_L + idx * (chartW / 12) + (chartW / 12 - barW) / 2;
                const barH = Math.max(
                  0,
                  (Math.max(0, m.neto) / maxNetoMensual) * chartH
                );
                const y = PAD_T + chartH - barH;
                return (
                  <g key={m.corto}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      fill={m.neto >= 0 ? "#cc0000" : "#333"}
                      rx={2}
                    />
                    <text
                      x={x + barW / 2}
                      y={PAD_T + chartH + 14}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#555"
                    >
                      {m.corto}
                    </text>
                    <text
                      x={x + barW / 2}
                      y={PAD_T + chartH + 26}
                      textAnchor="middle"
                      fontSize={8}
                      fill="#444"
                    >
                      {m.ocupacionPct}%
                    </text>
                  </g>
                );
              })}

              {/* Línea azul — tradicional constante */}
              <line
                x1={PAD_L}
                y1={tradLineY}
                x2={CHART_W - PAD_R}
                y2={tradLineY}
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="5,3"
              />
              <text
                x={CHART_W - PAD_R + 2}
                y={tradLineY + 4}
                fontSize={9}
                fill="#3b82f6"
              >
                Trad.
              </text>
            </svg>

            {/* Leyenda */}
            <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, background: "#cc0000", borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "#555" }}>Ingreso neto mensual (temporario)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 16, height: 2, background: "#3b82f6" }} />
                <span style={{ fontSize: 10, color: "#555" }}>Alquiler tradicional</span>
              </div>
            </div>
          </div>

          {/* Tabla mensual */}
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#161616" }}>
                  {[
                    "Mes",
                    "Ocupación",
                    "Noches disp.",
                    "Noches ocup.",
                    "Ingresos brutos",
                    "Gastos",
                    "Ingreso neto",
                    "Acumulado",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 12px",
                        textAlign: "right" as const,
                        fontSize: 9,
                        color: "#555",
                        fontFamily: "'Montserrat',sans-serif",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase" as const,
                        borderBottom: "1px solid #222222",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proyeccionMensual.map((m, idx) => (
                  <tr
                    key={m.nombre}
                    style={{
                      background: idx % 2 === 0 ? "transparent" : "#0f0f0f",
                      borderBottom: "1px solid #1a1a1a",
                    }}
                  >
                    <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#e0e0e0", textAlign: "left" as const }}>
                      {m.nombre}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" as const }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={m.ocupacionPct}
                        onChange={(e) =>
                          updateMesOcupacion(idx, parseInt(e.target.value) || 0)
                        }
                        style={{
                          width: 58,
                          background: "#1a1a1a",
                          border: "1px solid #222222",
                          borderRadius: 6,
                          color: "#e0e0e0",
                          padding: "4px 6px",
                          fontSize: 12,
                          textAlign: "center" as const,
                        }}
                      />
                      <span style={{ fontSize: 11, color: "#555", marginLeft: 2 }}>%</span>
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#666", textAlign: "right" as const }}>
                      {m.nochesDisp}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#aaa", textAlign: "right" as const }}>
                      {m.nochesOcup}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, textAlign: "right" as const }}>
                      USD {fmtUSD(m.bruto)}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: "#cc0000", textAlign: "right" as const }}>
                      −USD {fmtUSD(m.gastos)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        textAlign: "right" as const,
                        color: m.neto >= trad.alquilerMensualUSD ? "#22c55e" : m.neto >= 0 ? "#f59e0b" : "#cc0000",
                      }}
                    >
                      USD {fmtUSD(m.neto)}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, textAlign: "right" as const, color: "#777" }}>
                      USD {fmtUSD(m.acumulado)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "#161616", fontWeight: 700 }}>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>TOTAL AÑO</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#555", textAlign: "center" as const }}>
                    {fmtPct(
                      proyeccionMensual.reduce((s, m) => s + m.ocupacionPct, 0) / 12
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#555", textAlign: "right" as const }}>
                    {proyeccionMensual.reduce((s, m) => s + m.nochesDisp, 0)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, textAlign: "right" as const }}>
                    {proyeccionMensual.reduce((s, m) => s + m.nochesOcup, 0)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 800, textAlign: "right" as const }}>
                    USD {fmtUSD(proyeccionMensual.reduce((s, m) => s + m.bruto, 0))}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#cc0000", textAlign: "right" as const }}>
                    −USD {fmtUSD(proyeccionMensual.reduce((s, m) => s + m.gastos, 0))}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 800, color: "#22c55e", textAlign: "right" as const }}>
                    USD {fmtUSD(proyeccionMensual.reduce((s, m) => s + m.neto, 0))}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3 — ANÁLISIS DE VIABILIDAD
          ═══════════════════════════════════════════════════════════════════ */}
      {tab === "viabilidad" && (
        <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Tabla de sensibilidad */}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #222222" }}>
                  <p style={{ ...S.sectionTitle, marginBottom: 4 }}>Tabla de Sensibilidad 5×5 — Yield neto anual</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
                    Eje X: precio por noche (variación sobre base USD {fmtUSD(temp.precioNocheUSD)}) ·
                    Eje Y: ocupación anual
                  </p>
                  <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                    {[
                      { bg: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", label: "≥ 6% — Excelente" },
                      { bg: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", label: "4–6% — Aceptable" },
                      { bg: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", label: "< 4% — Bajo" },
                    ].map((l) => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 14, height: 14, background: l.bg, border: l.border, borderRadius: 3 }} />
                        <span style={{ fontSize: 10, color: l.color }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ overflowX: "auto" as const }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#161616" }}>
                        <th style={{ padding: "10px 16px", fontSize: 10, color: "#555", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, borderBottom: "1px solid #222222", textAlign: "left" as const }}>
                          Ocupación ↓ / Precio →
                        </th>
                        {preciosVariacion.map((delta) => (
                          <th
                            key={delta}
                            style={{
                              padding: "10px 16px",
                              fontSize: 10,
                              color: delta === 0 ? "#cc0000" : "#555",
                              fontFamily: "'Montserrat',sans-serif",
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase" as const,
                              borderBottom: "1px solid #222222",
                              textAlign: "center" as const,
                              whiteSpace: "nowrap" as const,
                            }}
                          >
                            {delta === 0
                              ? `Base USD ${fmtUSD(temp.precioNocheUSD)}`
                              : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}% USD ${fmtUSD(temp.precioNocheUSD * (1 + delta))}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ocupaciones.map((ocu, iRow) => (
                        <tr key={ocu} style={{ background: iRow % 2 === 0 ? "transparent" : "#0f0f0f" }}>
                          <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#e0e0e0", borderRight: "1px solid #222222" }}>
                            {ocu}% de ocupación
                          </td>
                          {sensibilidad[iRow].map((y, iCol) => {
                            const bg =
                              y >= 6
                                ? "rgba(34,197,94,0.12)"
                                : y >= 4
                                ? "rgba(245,158,11,0.10)"
                                : "rgba(204,0,0,0.10)";
                            const border =
                              y >= 6
                                ? "1px solid rgba(34,197,94,0.2)"
                                : y >= 4
                                ? "1px solid rgba(245,158,11,0.2)"
                                : "1px solid rgba(204,0,0,0.2)";
                            const color = yieldColor(y);
                            const isBase =
                              preciosVariacion[iCol] === 0 &&
                              ocu === Math.round(temp.ocupacionPct / 10) * 10;
                            return (
                              <td
                                key={iCol}
                                style={{
                                  padding: "10px 16px",
                                  textAlign: "center" as const,
                                }}
                              >
                                <div
                                  style={{
                                    background: bg,
                                    border: isBase ? "2px solid " + color : border,
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    display: "inline-block",
                                    minWidth: 60,
                                  }}
                                >
                                  <span style={{ fontSize: 14, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color }}>
                                    {fmtPct(y)}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Reglas de oro */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Reglas de oro del alquiler temporario</p>
              {[
                {
                  ok: true,
                  title: "Ubicación estratégica",
                  desc: "Cerca de centros comerciales, turismo, transporte público. Es el factor #1 de éxito.",
                },
                {
                  ok: true,
                  title: "WiFi de alta velocidad",
                  desc: "Imprescindible para nómades digitales. Velocidad mínima recomendada: 50 Mbps.",
                },
                {
                  ok: true,
                  title: "Fotos profesionales",
                  desc: "Inversión de USD 150–400 que puede aumentar la ocupación un 20–30%.",
                },
                {
                  ok: true,
                  title: "Gestión activa de reviews",
                  desc: "Responder siempre, pedir feedback. Las propiedades con +20 reviews tienen 40% más reservas.",
                },
                {
                  ok: true,
                  title: "Precio dinámico",
                  desc: "Usar herramientas de pricing dinámico (PriceLabs, Wheelhouse) para maximizar ingresos.",
                },
                {
                  ok: true,
                  title: "Equipamiento completo",
                  desc: "Smart TV, cocina equipada, ropa de cama de calidad. Permite cobrar precio premium.",
                },
                {
                  ok: false,
                  title: "Evitar zonas con restricciones",
                  desc: "Algunas ciudades limitan los días por año o requieren licencia. Verificar normativa local.",
                },
                {
                  ok: false,
                  title: "No subestimar los gastos",
                  desc: "Limpieza, plataformas, reposición de menaje y desgaste son costos reales y recurrentes.",
                },
              ].map((r) => (
                <div
                  key={r.title}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: r.ok ? "rgba(34,197,94,0.15)" : "rgba(204,0,0,0.15)",
                      border: `1px solid ${r.ok ? "rgba(34,197,94,0.3)" : "rgba(204,0,0,0.3)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: r.ok ? "#22c55e" : "#cc0000",
                      fontWeight: 800,
                      marginTop: 1,
                    }}
                  >
                    {r.ok ? "✓" : "✕"}
                  </div>
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "#e0e0e0" }}>
                      {r.title}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "#666", lineHeight: 1.5 }}>
                      {r.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Estimador de precio por zona/tipo */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Estimador de precio sugerido — Argentina 2026</p>
              <p style={{ fontSize: 11, color: "#555", marginBottom: 16, lineHeight: 1.5 }}>
                Rango orientativo según tipo y zona. Los precios son en USD por noche para propiedades
                con buen equipamiento y fotos profesionales.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 2, fontSize: 10, marginBottom: 8 }}>
                <div style={{ padding: "6px 8px", background: "#161616", color: "#555", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, borderRadius: "6px 0 0 0" }} />
                {(["centrica", "turistica", "residencial", "playa_montana"] as TipoZona[]).map((z) => (
                  <div
                    key={z}
                    style={{
                      padding: "6px 8px",
                      background: "#161616",
                      color: "#555",
                      fontFamily: "'Montserrat',sans-serif",
                      fontWeight: 700,
                      fontSize: 9,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase" as const,
                      textAlign: "center" as const,
                    }}
                  >
                    {z === "centrica" ? "Céntrica" : z === "turistica" ? "Turística" : z === "residencial" ? "Residencial" : "Playa/Mtn"}
                  </div>
                ))}
              </div>
              {(["monoambiente", "1dorm", "2dorm", "3dorm", "casa"] as TipoPropiedad[]).map((t, idx) => (
                <div
                  key={t}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    gap: 2,
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 8px",
                      background: "#111111",
                      fontSize: 11,
                      color: "#aaa",
                      fontWeight: 600,
                      borderRadius: idx === 4 ? "0 0 0 6px" : 0,
                    }}
                  >
                    {t === "monoambiente" ? "Monoamb." : t === "1dorm" ? "1 Dorm." : t === "2dorm" ? "2 Dorm." : t === "3dorm" ? "3 Dorm." : "Casa"}
                  </div>
                  {(["centrica", "turistica", "residencial", "playa_montana"] as TipoZona[]).map((z) => {
                    const isActive = prop.tipo === t && prop.zona === z;
                    return (
                      <div
                        key={z}
                        style={{
                          padding: "8px 6px",
                          background: isActive ? "rgba(204,0,0,0.12)" : "#0f0f0f",
                          border: isActive ? "1px solid rgba(204,0,0,0.35)" : "1px solid transparent",
                          fontSize: 11,
                          color: isActive ? "#cc0000" : "#777",
                          fontWeight: isActive ? 700 : 400,
                          textAlign: "center" as const,
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                        onClick={() => setProp((p) => ({ ...p, tipo: t, zona: z }))}
                      >
                        {PRECIOS_SUGERIDOS[t][z]}
                      </div>
                    );
                  })}
                </div>
              ))}
              <p style={{ margin: "12px 0 0", fontSize: 10, color: "#444" }}>
                Clic en una celda para actualizar tipo y zona. Precios base sin diferenciación estacional ni servicios extra.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #1a1a1a",
          padding: "16px 24px",
          textAlign: "center" as const,
          fontSize: 10,
          color: "#333",
          marginTop: 40,
        }}
      >
        Calculadora de Locación Temporaria · Grupo Foro Inmobiliario · Los valores son estimaciones orientativas.
      </div>
    </div>
  );
}
