"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ──────────────────────────────────────────────────────────────────────

type ProvinciaId = "santa_fe" | "buenos_aires" | "caba" | "cordoba" | "mendoza" | "entre_rios" | "tucuman";
type TipoComprador = "primera_vivienda" | "inversor" | "empresa";
type TipoVendedor = "fisica" | "juridica";
type TabActivo = "compraventa" | "alquiler" | "comparativa";
type MonedaInput = "ARS" | "USD";

interface ProvinciaData {
  nombre: string;
  sellos: number;          // % impuesto sellos comprador
  honorarios: number;      // % honorarios notariales comprador
  inscripcion: number;     // % inscripción RPI comprador
  cajaNotarial: number;    // % aporte caja notarial vendedor
  sellosAlquiler: number;  // % sellado contrato alquiler sobre monto total
}

// ── Datos por provincia (2026) ─────────────────────────────────────────────────

const PROVINCIAS: Record<ProvinciaId, ProvinciaData> = {
  santa_fe:     { nombre: "Santa Fe",     sellos: 2.5,  honorarios: 1.2, inscripcion: 0.40, cajaNotarial: 0.5,  sellosAlquiler: 1.0 },
  buenos_aires: { nombre: "Buenos Aires", sellos: 2.0,  honorarios: 1.0, inscripcion: 0.30, cajaNotarial: 0.4,  sellosAlquiler: 0.8 },
  caba:         { nombre: "CABA",         sellos: 2.5,  honorarios: 1.5, inscripcion: 0.50, cajaNotarial: 0.6,  sellosAlquiler: 1.2 },
  cordoba:      { nombre: "Córdoba",      sellos: 1.5,  honorarios: 1.0, inscripcion: 0.30, cajaNotarial: 0.4,  sellosAlquiler: 0.75 },
  mendoza:      { nombre: "Mendoza",      sellos: 1.0,  honorarios: 1.2, inscripcion: 0.30, cajaNotarial: 0.3,  sellosAlquiler: 0.5 },
  entre_rios:   { nombre: "Entre Ríos",   sellos: 2.0,  honorarios: 1.0, inscripcion: 0.35, cajaNotarial: 0.4,  sellosAlquiler: 0.75 },
  tucuman:      { nombre: "Tucumán",      sellos: 1.5,  honorarios: 1.1, inscripcion: 0.30, cajaNotarial: 0.35, sellosAlquiler: 0.6 },
};

const PROVINCIA_IDS = Object.keys(PROVINCIAS) as ProvinciaId[];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  return "$ " + Math.round(n).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtUSD(n: number): string {
  return "USD " + Math.round(n).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return n.toFixed(2) + "%";
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const S = {
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid #222222",
    borderRadius: 8,
    color: "#e0e0e0",
    padding: "8px 12px",
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    boxSizing: "border-box" as const,
    outline: "none",
  },
  select: {
    width: "100%",
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 8,
    color: "#e0e0e0",
    padding: "8px 12px",
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    boxSizing: "border-box" as const,
    outline: "none",
    cursor: "pointer",
  },
  label: {
    display: "block" as const,
    fontSize: 10,
    color: "rgba(224,224,224,0.4)",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    marginBottom: 5,
  },
  card: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 10,
    color: "rgba(224,224,224,0.3)",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
  tableRow: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    padding: "7px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    fontSize: 13,
    color: "#e0e0e0",
    fontFamily: "Inter, sans-serif",
  },
  rowLabel: {
    color: "rgba(224,224,224,0.65)",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
  },
  rowValue: {
    textAlign: "right" as const,
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    color: "#e0e0e0",
  },
};

// ── Toggle switch ──────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none",
        background: value ? "#cc0000" : "rgba(255,255,255,0.15)",
        cursor: "pointer", position: "relative", flexShrink: 0,
        outline: "none",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3,
        left: value ? 23 : 3,
        transition: "left 0.2s",
      }} />
    </button>
  );
}

// ── Fila de tabla detalle ──────────────────────────────────────────────────────

interface DetalleFilaProps {
  label: string;
  nota?: string;
  ars: number;
  usd: number;
  tipoCambio: number;
  exento?: boolean;
}

function DetalleFila({ label, nota, ars, tipoCambio, exento }: DetalleFilaProps) {
  const usdVal = ars / tipoCambio;
  return (
    <div style={S.tableRow}>
      <span style={S.rowLabel}>
        {label}
        {nota && <span style={{ marginLeft: 6, fontSize: 10, color: "rgba(224,224,224,0.35)", fontStyle: "italic" }}>{nota}</span>}
      </span>
      {exento ? (
        <span style={{ color: "#4caf50", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12 }}>EXENTO</span>
      ) : (
        <div style={{ textAlign: "right" }}>
          <div style={S.rowValue}>{fmtARS(ars)}</div>
          <div style={{ fontSize: 11, color: "rgba(224,224,224,0.35)", fontFamily: "Inter, sans-serif" }}>{fmtUSD(usdVal)}</div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function CostosEscrituraPage() {

  // ── Estado global ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabActivo>("compraventa");
  const [tipoCambio, setTipoCambio] = useState(1150);

  // ── Estado Tab 1 ──────────────────────────────────────────────────────────
  const [monedaInput, setMonedaInput] = useState<MonedaInput>("USD");
  const [valorProp, setValorProp] = useState(100000);         // en la moneda seleccionada
  const [tipoComprador, setTipoComprador] = useState<TipoComprador>("inversor");
  const [tipoVendedor, setTipoVendedor] = useState<TipoVendedor>("fisica");
  const [provincia, setProvincia] = useState<ProvinciaId>("caba");
  const [tieneHipoteca, setTieneHipoteca] = useState(false);
  const [montoCredito, setMontoCredito] = useState(50000);    // USD
  const [comisionPct, setComisionPct] = useState(3.0);

  // ── Estado Tab 2 ──────────────────────────────────────────────────────────
  const [alquilerMensual, setAlquilerMensual] = useState(300000);
  const [duracionMeses, setDuracionMeses] = useState<24 | 36 | 48>(24);
  const [provinciaAlq, setProvinciaAlq] = useState<ProvinciaId>("caba");
  const [tieneGarantia, setTieneGarantia] = useState(true);
  const [comisionInmMeses, setComisionInmMeses] = useState(1);

  // ── Estado Tab 3 ──────────────────────────────────────────────────────────
  const [valorComp, setValorComp] = useState(100000); // USD

  // ── Valor en ARS ────────────────────────────────────────────────────────
  const valorARS = useMemo(
    () => monedaInput === "USD" ? valorProp * tipoCambio : valorProp,
    [monedaInput, valorProp, tipoCambio]
  );
  const valorUSD = useMemo(
    () => monedaInput === "USD" ? valorProp : valorProp / tipoCambio,
    [monedaInput, valorProp, tipoCambio]
  );
  const creditoARS = montoCredito * tipoCambio;

  // ── Cálculos Tab 1 Compraventa ─────────────────────────────────────────
  const calcCV = useMemo(() => {
    const p = PROVINCIAS[provincia];

    // VENDEDOR
    const itiExento = tipoComprador === "primera_vivienda" && tipoVendedor === "fisica";
    const itiImporte = itiExento ? 0 : valorARS * 0.015;

    const plusvaliaAplica = tipoVendedor === "juridica";
    const plusvaliaImporte = plusvaliaAplica ? valorARS * 0.15 : 0;

    const comisionTotalARS = valorARS * comisionPct / 100;
    const comisionVendedor = comisionTotalARS * 0.5;
    const comisionComprador = comisionTotalARS * 0.5;

    const cajaVendedor = valorARS * p.cajaNotarial / 100;

    const totalVendedor = itiImporte + plusvaliaImporte + comisionVendedor + cajaVendedor;

    // COMPRADOR
    const sellos = valorARS * p.sellos / 100;
    const honorarios = valorARS * p.honorarios / 100;
    const inscripcion = valorARS * p.inscripcion / 100;
    const certificados = 35000; // monto fijo estimado 2026
    const hipotecaAdicional = tieneHipoteca ? creditoARS * 0.005 : 0; // 0.5% del crédito

    const totalComprador = sellos + honorarios + inscripcion + certificados + comisionComprador + hipotecaAdicional;

    const totalOp = totalVendedor + totalComprador;
    const pctSobreValor = valorARS > 0 ? (totalOp / valorARS) * 100 : 0;

    return {
      // vendedor
      itiExento, itiImporte,
      plusvaliaAplica, plusvaliaImporte,
      comisionVendedor, cajaVendedor,
      totalVendedor,
      // comprador
      sellos, honorarios, inscripcion, certificados,
      comisionComprador, hipotecaAdicional,
      totalComprador,
      // totales
      totalOp, pctSobreValor,
    };
  }, [provincia, valorARS, tipoComprador, tipoVendedor, comisionPct, tieneHipoteca, creditoARS]);

  // ── Cálculos Tab 2 Alquiler ────────────────────────────────────────────
  const calcAlq = useMemo(() => {
    const p = PROVINCIAS[provinciaAlq];
    const montoTotal = alquilerMensual * duracionMeses;

    const selladoContrato = montoTotal * p.sellosAlquiler / 100;
    const mitadSellado = selladoContrato / 2;

    // Inmobiliaria: inquilino paga 1 mes + IVA, propietario paga según configuración sin IVA
    const comisionInquilinoBase = alquilerMensual * 1;
    const comisionInquilinoIVA = comisionInquilinoBase * 0.21;
    const comisionInquilinoTotal = comisionInquilinoBase + comisionInquilinoIVA;

    const comisionPropietarioBase = alquilerMensual * comisionInmMeses;
    const comisionPropietarioTotal = comisionPropietarioBase;

    // Garantía propietaria
    const honorariosGarantia = tieneGarantia ? montoTotal * 0.005 : 0; // 0.5% monto total
    const seguroCaucion = !tieneGarantia ? alquilerMensual * 3.5 / 100 * duracionMeses : 0; // ~3.5% mensual por duración

    const totalInquilino = mitadSellado + comisionInquilinoTotal + (!tieneGarantia ? seguroCaucion : 0);
    const totalPropietario = mitadSellado + comisionPropietarioTotal + (tieneGarantia ? honorariosGarantia : 0);

    const totalInquilinoEnMeses = alquilerMensual > 0 ? totalInquilino / alquilerMensual : 0;
    const totalPropietarioEnMeses = alquilerMensual > 0 ? totalPropietario / alquilerMensual : 0;

    return {
      montoTotal, selladoContrato, mitadSellado,
      comisionInquilinoBase, comisionInquilinoIVA, comisionInquilinoTotal,
      comisionPropietarioBase, comisionPropietarioTotal,
      honorariosGarantia, seguroCaucion,
      totalInquilino, totalPropietario,
      totalInquilinoEnMeses, totalPropietarioEnMeses,
    };
  }, [provinciaAlq, alquilerMensual, duracionMeses, tieneGarantia, comisionInmMeses]);

  // ── Cálculos Tab 3 Comparativa ─────────────────────────────────────────
  const comparativa = useMemo(() => {
    const valorARS3 = valorComp * tipoCambio;
    return PROVINCIA_IDS.map((id) => {
      const p = PROVINCIAS[id];
      const sellos = valorARS3 * p.sellos / 100;
      const honorarios = valorARS3 * p.honorarios / 100;
      const inscripcion = valorARS3 * p.inscripcion / 100;
      const totalComprador = sellos + honorarios + inscripcion + 35000;
      return { id, nombre: p.nombre, sellos, honorarios, inscripcion, totalComprador };
    });
  }, [valorComp, tipoCambio]);

  const maxTotal = Math.max(...comparativa.map((c) => c.totalComprador));
  const minTotal = Math.min(...comparativa.map((c) => c.totalComprador));

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid #222222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" as const }}>
        <Link href="/calculadoras" style={{ color: "rgba(224,224,224,0.4)", textDecoration: "none", fontSize: 12 }}>
          ← Calculadoras
        </Link>
        <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, letterSpacing: "-0.02em", color: "#e0e0e0" }}>
          Costos de Escritura
        </h1>
        {/* Tipo de cambio global */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "rgba(224,224,224,0.4)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.05em" }}>TC USD/ARS</span>
          <input
            type="number"
            value={tipoCambio}
            step={50}
            min={1}
            onChange={(e) => setTipoCambio(parseFloat(e.target.value) || 1)}
            style={{ ...S.input, width: 100, fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" as const }}>
          {(["compraventa", "alquiler", "comparativa"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 22px",
                borderRadius: 20,
                border: "none",
                background: tab === t ? "#cc0000" : "rgba(255,255,255,0.06)",
                color: tab === t ? "#fff" : "rgba(224,224,224,0.5)",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "background 0.15s, color 0.15s",
                outline: "none",
              }}
            >
              {t === "compraventa" ? "Compraventa" : t === "alquiler" ? "Alquiler" : "Comparativa provincias"}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1 — COMPRAVENTA
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "compraventa" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 300px) 1fr", gap: 20, alignItems: "start" }}>

            {/* ── Panel inputs ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={S.card}>
                <p style={S.sectionTitle}>Parámetros</p>

                {/* Moneda + Valor */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>Valor de la propiedad</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      value={monedaInput}
                      onChange={(e) => setMonedaInput(e.target.value as MonedaInput)}
                      style={{ ...S.select, width: 80, flexShrink: 0 }}
                    >
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                    </select>
                    <input
                      type="number"
                      value={valorProp}
                      step={monedaInput === "USD" ? 5000 : 1_000_000}
                      min={0}
                      onChange={(e) => setValorProp(parseFloat(e.target.value) || 0)}
                      style={S.input}
                    />
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: "rgba(224,224,224,0.35)", fontFamily: "Inter, sans-serif" }}>
                    {monedaInput === "USD" ? `= ${fmtARS(valorARS)}` : `= ${fmtUSD(valorUSD)}`}
                  </div>
                </div>

                {/* Provincia */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>Provincia</label>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
                    {PROVINCIA_IDS.map((id) => (
                      <button
                        key={id}
                        onClick={() => setProvincia(id)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 12,
                          border: `1px solid ${provincia === id ? "#cc0000" : "#222222"}`,
                          background: provincia === id ? "rgba(204,0,0,0.18)" : "transparent",
                          color: provincia === id ? "#cc0000" : "rgba(224,224,224,0.5)",
                          fontSize: 11,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        {PROVINCIAS[id].nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo comprador */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>Tipo de comprador</label>
                  <select
                    value={tipoComprador}
                    onChange={(e) => setTipoComprador(e.target.value as TipoComprador)}
                    style={S.select}
                  >
                    <option value="primera_vivienda">Primera vivienda</option>
                    <option value="inversor">Inversor</option>
                    <option value="empresa">Empresa</option>
                  </select>
                  {tipoComprador === "primera_vivienda" && (
                    <div style={{ marginTop: 5, fontSize: 11, color: "#4caf50", fontFamily: "Inter, sans-serif" }}>
                      Beneficio: ITI exento (vivienda única y familiar)
                    </div>
                  )}
                </div>

                {/* Tipo vendedor */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>Vendedor</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["fisica", "juridica"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTipoVendedor(t)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: 8,
                          border: `1px solid ${tipoVendedor === t ? "rgba(204,0,0,0.5)" : "#222222"}`,
                          background: tipoVendedor === t ? "rgba(204,0,0,0.12)" : "transparent",
                          color: tipoVendedor === t ? "#cc0000" : "rgba(224,224,224,0.4)",
                          fontSize: 11,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        {t === "fisica" ? "Persona física" : "Persona jurídica"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comisión inmobiliaria */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>Comisión inmobiliaria total (%)</label>
                  <input
                    type="number"
                    value={comisionPct}
                    step={0.5}
                    min={0}
                    max={10}
                    onChange={(e) => setComisionPct(parseFloat(e.target.value) || 0)}
                    style={S.input}
                  />
                  <div style={{ marginTop: 4, fontSize: 11, color: "rgba(224,224,224,0.35)", fontFamily: "Inter, sans-serif" }}>
                    50% vendedor / 50% comprador
                  </div>
                </div>

                {/* Hipoteca */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tieneHipoteca ? 10 : 0 }}>
                  <span style={{ fontSize: 12, color: "rgba(224,224,224,0.6)", fontFamily: "Inter, sans-serif" }}>¿Incluye hipoteca?</span>
                  <Toggle value={tieneHipoteca} onChange={setTieneHipoteca} />
                </div>
                {tieneHipoteca && (
                  <div style={{ marginTop: 8 }}>
                    <label style={S.label}>Monto del crédito hipotecario (USD)</label>
                    <input
                      type="number"
                      value={montoCredito}
                      step={5000}
                      min={0}
                      onChange={(e) => setMontoCredito(parseFloat(e.target.value) || 0)}
                      style={S.input}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Panel resultados ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* KPIs resumen */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                {[
                  { label: "Total vendedor", value: calcCV.totalVendedor, accent: false },
                  { label: "Total comprador", value: calcCV.totalComprador, accent: false },
                  { label: "Total operación", value: calcCV.totalOp, accent: true },
                ].map((kpi) => (
                  <div key={kpi.label} style={{
                    background: kpi.accent ? "rgba(204,0,0,0.08)" : "#111111",
                    border: `1px solid ${kpi.accent ? "rgba(204,0,0,0.3)" : "#222222"}`,
                    borderRadius: 12,
                    padding: "16px 18px",
                    textAlign: "center" as const,
                  }}>
                    <div style={{ fontSize: 10, color: "rgba(224,224,224,0.4)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: kpi.accent ? "#cc0000" : "#e0e0e0" }}>
                      {fmtARS(kpi.value)}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(224,224,224,0.4)", marginTop: 3, fontFamily: "Inter, sans-serif" }}>
                      {fmtUSD(kpi.value / tipoCambio)}
                    </div>
                  </div>
                ))}
                <div style={{ background: "#111111", border: "1px solid #222222", borderRadius: 12, padding: "16px 18px", textAlign: "center" as const }}>
                  <div style={{ fontSize: 10, color: "rgba(224,224,224,0.4)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    % sobre propiedad
                  </div>
                  <div style={{ fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#e0e0e0" }}>
                    {fmtPct(calcCV.pctSobreValor)}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(224,224,224,0.3)", marginTop: 3, fontFamily: "Inter, sans-serif" }}>
                    costos totales / valor
                  </div>
                </div>
              </div>

              {/* Detalle vendedor */}
              <div style={S.card}>
                <p style={{ ...S.sectionTitle, color: "rgba(224,100,100,0.6)" }}>Costos del vendedor</p>

                <DetalleFila
                  label="ITI (Impuesto Transferencia Inmuebles)"
                  nota="1.5%"
                  ars={calcCV.itiImporte}
                  usd={calcCV.itiImporte / tipoCambio}
                  tipoCambio={tipoCambio}
                  exento={calcCV.itiExento}
                />
                {calcCV.plusvaliaAplica && (
                  <DetalleFila
                    label="Plusvalía / Ganancia eventual"
                    nota="15% — persona jurídica"
                    ars={calcCV.plusvaliaImporte}
                    usd={calcCV.plusvaliaImporte / tipoCambio}
                    tipoCambio={tipoCambio}
                  />
                )}
                <DetalleFila
                  label="Comisión inmobiliaria (50%)"
                  nota={fmtPct(comisionPct / 2)}
                  ars={calcCV.comisionVendedor}
                  usd={calcCV.comisionVendedor / tipoCambio}
                  tipoCambio={tipoCambio}
                />
                <DetalleFila
                  label="Aporte caja notarial"
                  nota={fmtPct(PROVINCIAS[provincia].cajaNotarial)}
                  ars={calcCV.cajaVendedor}
                  usd={calcCV.cajaVendedor / tipoCambio}
                  tipoCambio={tipoCambio}
                />

                {/* Total vendedor */}
                <div style={{ marginTop: 12, padding: "12px 0 0", borderTop: "1px solid #222222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#e0e0e0" }}>TOTAL VENDEDOR</span>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#cc0000" }}>{fmtARS(calcCV.totalVendedor)}</div>
                    <div style={{ fontSize: 12, color: "rgba(224,224,224,0.4)", fontFamily: "Inter, sans-serif" }}>{fmtUSD(calcCV.totalVendedor / tipoCambio)}</div>
                  </div>
                </div>
              </div>

              {/* Detalle comprador */}
              <div style={S.card}>
                <p style={{ ...S.sectionTitle, color: "rgba(100,150,224,0.6)" }}>Costos del comprador</p>

                <DetalleFila
                  label="Impuesto de sellos"
                  nota={fmtPct(PROVINCIAS[provincia].sellos)}
                  ars={calcCV.sellos}
                  usd={calcCV.sellos / tipoCambio}
                  tipoCambio={tipoCambio}
                />
                <DetalleFila
                  label="Honorarios notariales (escribanía)"
                  nota={fmtPct(PROVINCIAS[provincia].honorarios)}
                  ars={calcCV.honorarios}
                  usd={calcCV.honorarios / tipoCambio}
                  tipoCambio={tipoCambio}
                />
                <DetalleFila
                  label="Inscripción Registro de la Propiedad"
                  nota={fmtPct(PROVINCIAS[provincia].inscripcion)}
                  ars={calcCV.inscripcion}
                  usd={calcCV.inscripcion / tipoCambio}
                  tipoCambio={tipoCambio}
                />
                <DetalleFila
                  label="Certificados y diligencias"
                  nota="estimado fijo"
                  ars={calcCV.certificados}
                  usd={calcCV.certificados / tipoCambio}
                  tipoCambio={tipoCambio}
                />
                <DetalleFila
                  label="Comisión inmobiliaria (50%)"
                  nota={fmtPct(comisionPct / 2)}
                  ars={calcCV.comisionComprador}
                  usd={calcCV.comisionComprador / tipoCambio}
                  tipoCambio={tipoCambio}
                />
                {tieneHipoteca && (
                  <DetalleFila
                    label="Adicional honorarios hipotecarios"
                    nota="0.5% del crédito"
                    ars={calcCV.hipotecaAdicional}
                    usd={calcCV.hipotecaAdicional / tipoCambio}
                    tipoCambio={tipoCambio}
                  />
                )}

                {/* Total comprador */}
                <div style={{ marginTop: 12, padding: "12px 0 0", borderTop: "1px solid #222222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#e0e0e0" }}>TOTAL COMPRADOR</span>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#cc0000" }}>{fmtARS(calcCV.totalComprador)}</div>
                    <div style={{ fontSize: 12, color: "rgba(224,224,224,0.4)", fontFamily: "Inter, sans-serif" }}>{fmtUSD(calcCV.totalComprador / tipoCambio)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2 — ALQUILER
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "alquiler" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 300px) 1fr", gap: 20, alignItems: "start" }}>

            {/* Inputs alquiler */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Parámetros</p>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Alquiler mensual (ARS)</label>
                <input
                  type="number"
                  value={alquilerMensual}
                  step={10000}
                  min={0}
                  onChange={(e) => setAlquilerMensual(parseFloat(e.target.value) || 0)}
                  style={S.input}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Duración del contrato</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {([24, 36, 48] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setDuracionMeses(m)}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 8,
                        border: `1px solid ${duracionMeses === m ? "rgba(204,0,0,0.5)" : "#222222"}`,
                        background: duracionMeses === m ? "rgba(204,0,0,0.12)" : "transparent",
                        color: duracionMeses === m ? "#cc0000" : "rgba(224,224,224,0.4)",
                        fontSize: 12,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Provincia</label>
                <select
                  value={provinciaAlq}
                  onChange={(e) => setProvinciaAlq(e.target.value as ProvinciaId)}
                  style={S.select}
                >
                  {PROVINCIA_IDS.map((id) => (
                    <option key={id} value={id}>{PROVINCIAS[id].nombre}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Comisión inmobiliaria (meses)</label>
                <input
                  type="number"
                  value={comisionInmMeses}
                  step={0.5}
                  min={0}
                  max={3}
                  onChange={(e) => setComisionInmMeses(parseFloat(e.target.value) || 0)}
                  style={S.input}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "rgba(224,224,224,0.6)", fontFamily: "Inter, sans-serif" }}>¿Tiene garantía propietaria?</span>
                <Toggle value={tieneGarantia} onChange={setTieneGarantia} />
              </div>
            </div>

            {/* Resultados alquiler */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* KPIs alquiler */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {[
                  { label: "Monto total contrato", value: calcAlq.montoTotal },
                  { label: "Costo total inquilino", value: calcAlq.totalInquilino },
                  { label: "Costo total propietario", value: calcAlq.totalPropietario },
                ].map((kpi) => (
                  <div key={kpi.label} style={{ background: "#111111", border: "1px solid #222222", borderRadius: 12, padding: "16px 18px", textAlign: "center" as const }}>
                    <div style={{ fontSize: 10, color: "rgba(224,224,224,0.4)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#e0e0e0" }}>
                      {fmtARS(kpi.value)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desglose inquilino */}
              <div style={S.card}>
                <p style={{ ...S.sectionTitle, color: "rgba(100,150,224,0.6)" }}>Costos del inquilino</p>

                <div style={S.tableRow}>
                  <span style={S.rowLabel}>Sellado del contrato (50%)</span>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={S.rowValue}>{fmtARS(calcAlq.mitadSellado)}</div>
                    <div style={{ fontSize: 10, color: "rgba(224,224,224,0.3)" }}>{fmtPct(PROVINCIAS[provinciaAlq].sellosAlquiler / 2)} del contrato</div>
                  </div>
                </div>
                <div style={S.tableRow}>
                  <span style={S.rowLabel}>Comisión inmobiliaria</span>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={S.rowValue}>{fmtARS(calcAlq.comisionInquilinoBase)}</div>
                    <div style={{ fontSize: 10, color: "rgba(224,224,224,0.3)" }}>1 mes de alquiler</div>
                  </div>
                </div>
                <div style={S.tableRow}>
                  <span style={S.rowLabel}>IVA 21% sobre comisión</span>
                  <div style={S.rowValue}>{fmtARS(calcAlq.comisionInquilinoIVA)}</div>
                </div>
                {!tieneGarantia && (
                  <div style={S.tableRow}>
                    <span style={S.rowLabel}>Seguro de caución</span>
                    <div style={{ textAlign: "right" as const }}>
                      <div style={S.rowValue}>{fmtARS(calcAlq.seguroCaucion)}</div>
                      <div style={{ fontSize: 10, color: "rgba(224,224,224,0.3)" }}>~3.5% mensual × duración</div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 12, padding: "12px 0 0", borderTop: "1px solid #222222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13 }}>TOTAL INQUILINO</span>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#cc0000" }}>{fmtARS(calcAlq.totalInquilino)}</div>
                    <div style={{ fontSize: 11, color: "rgba(224,224,224,0.4)" }}>
                      = {calcAlq.totalInquilinoEnMeses.toFixed(1)} meses de alquiler
                    </div>
                  </div>
                </div>
              </div>

              {/* Desglose propietario */}
              <div style={S.card}>
                <p style={{ ...S.sectionTitle, color: "rgba(224,150,100,0.6)" }}>Costos del propietario</p>

                <div style={S.tableRow}>
                  <span style={S.rowLabel}>Sellado del contrato (50%)</span>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={S.rowValue}>{fmtARS(calcAlq.mitadSellado)}</div>
                    <div style={{ fontSize: 10, color: "rgba(224,224,224,0.3)" }}>{fmtPct(PROVINCIAS[provinciaAlq].sellosAlquiler / 2)} del contrato</div>
                  </div>
                </div>
                <div style={S.tableRow}>
                  <span style={S.rowLabel}>Comisión inmobiliaria</span>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={S.rowValue}>{fmtARS(calcAlq.comisionPropietarioBase)}</div>
                    <div style={{ fontSize: 10, color: "rgba(224,224,224,0.3)" }}>{comisionInmMeses} mes(es) — sin IVA</div>
                  </div>
                </div>
                {tieneGarantia && (
                  <div style={S.tableRow}>
                    <span style={S.rowLabel}>Honorarios garantía propietaria</span>
                    <div style={{ textAlign: "right" as const }}>
                      <div style={S.rowValue}>{fmtARS(calcAlq.honorariosGarantia)}</div>
                      <div style={{ fontSize: 10, color: "rgba(224,224,224,0.3)" }}>0.5% monto total contrato</div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 12, padding: "12px 0 0", borderTop: "1px solid #222222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13 }}>TOTAL PROPIETARIO</span>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#cc0000" }}>{fmtARS(calcAlq.totalPropietario)}</div>
                    <div style={{ fontSize: 11, color: "rgba(224,224,224,0.4)" }}>
                      = {calcAlq.totalPropietarioEnMeses.toFixed(1)} meses de alquiler
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3 — COMPARATIVA PROVINCIAS
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "comparativa" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Input valor */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" as const }}>
              <div>
                <label style={S.label}>Valor de la propiedad (USD)</label>
                <input
                  type="number"
                  value={valorComp}
                  step={10000}
                  min={0}
                  onChange={(e) => setValorComp(parseFloat(e.target.value) || 0)}
                  style={{ ...S.input, width: 200 }}
                />
              </div>
              <div style={{ fontSize: 12, color: "rgba(224,224,224,0.4)", fontFamily: "Inter, sans-serif", paddingBottom: 8 }}>
                = {fmtARS(valorComp * tipoCambio)}
              </div>
            </div>

            {/* Tabla comparativa */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Costos del comprador por provincia (2026)</p>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse" as const, fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #222222" }}>
                      {["Provincia", "Sellos", "Honorarios notariales", "Inscripción RPI", "Total comprador"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: h === "Provincia" ? "left" as const : "right" as const, fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, color: "rgba(224,224,224,0.4)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparativa.map((row) => {
                      const isCheapest = row.totalComprador === minTotal;
                      const isMostExpensive = row.totalComprador === maxTotal;
                      const rowBg = isCheapest
                        ? "rgba(76,175,80,0.06)"
                        : isMostExpensive
                        ? "rgba(204,0,0,0.06)"
                        : "transparent";
                      const totalColor = isCheapest ? "#4caf50" : isMostExpensive ? "#cc0000" : "#e0e0e0";
                      return (
                        <tr key={row.id} style={{ background: rowBg, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: "10px 12px", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#e0e0e0" }}>
                            {row.nombre}
                            {isCheapest && <span style={{ marginLeft: 6, fontSize: 10, color: "#4caf50", fontWeight: 700 }}>+ barata</span>}
                            {isMostExpensive && <span style={{ marginLeft: 6, fontSize: 10, color: "#cc0000", fontWeight: 700 }}>+ cara</span>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" as const, color: "rgba(224,224,224,0.75)" }}>{fmtARS(row.sellos)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" as const, color: "rgba(224,224,224,0.75)" }}>{fmtARS(row.honorarios)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" as const, color: "rgba(224,224,224,0.75)" }}>{fmtARS(row.inscripcion)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" as const, fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, color: totalColor }}>
                            {fmtARS(row.totalComprador)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gráfico de barras SVG horizontal */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Total costos comprador — comparativa visual</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {comparativa
                  .slice()
                  .sort((a, b) => b.totalComprador - a.totalComprador)
                  .map((row) => {
                    const isCheapest = row.totalComprador === minTotal;
                    const isMostExpensive = row.totalComprador === maxTotal;
                    const barPct = maxTotal > 0 ? (row.totalComprador / maxTotal) * 100 : 0;
                    const barColor = isCheapest ? "#4caf50" : isMostExpensive ? "#cc0000" : "#555555";
                    return (
                      <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 110, flexShrink: 0, fontSize: 11, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "rgba(224,224,224,0.7)", textAlign: "right" as const }}>
                          {row.nombre}
                        </div>
                        <div style={{ flex: 1, height: 24, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" as const, position: "relative" as const }}>
                          <div style={{
                            width: `${barPct}%`,
                            height: "100%",
                            background: barColor,
                            borderRadius: 4,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <div style={{ width: 130, flexShrink: 0, fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: barColor, textAlign: "left" as const }}>
                          {fmtARS(row.totalComprador)}
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 18, flexWrap: "wrap" as const }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: "#4caf50" }} />
                  <span style={{ fontSize: 11, color: "rgba(224,224,224,0.4)", fontFamily: "Inter, sans-serif" }}>Provincia más económica</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: "#cc0000" }} />
                  <span style={{ fontSize: 11, color: "rgba(224,224,224,0.4)", fontFamily: "Inter, sans-serif" }}>Provincia más cara</span>
                </div>
              </div>
            </div>

            {/* Tasas por provincia tabla */}
            <div style={S.card}>
              <p style={S.sectionTitle}>Tasas vigentes por provincia (2026)</p>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse" as const, fontFamily: "Inter, sans-serif", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #222222" }}>
                      {["Provincia", "Sellos", "Honorarios notariales", "Inscripción RPI", "Caja notarial vendedor", "Sellado alquiler"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: h === "Provincia" ? "left" as const : "right" as const, fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, color: "rgba(224,224,224,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PROVINCIA_IDS.map((id) => {
                      const p = PROVINCIAS[id];
                      return (
                        <tr key={id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: "8px 12px", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#e0e0e0" }}>{p.nombre}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" as const, color: "rgba(224,224,224,0.65)" }}>{fmtPct(p.sellos)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" as const, color: "rgba(224,224,224,0.65)" }}>{fmtPct(p.honorarios)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" as const, color: "rgba(224,224,224,0.65)" }}>{fmtPct(p.inscripcion)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" as const, color: "rgba(224,224,224,0.65)" }}>{fmtPct(p.cajaNotarial)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" as const, color: "rgba(224,224,224,0.65)" }}>{fmtPct(p.sellosAlquiler)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
