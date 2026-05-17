"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Provincia = "santa_fe" | "buenos_aires" | "caba" | "cordoba" | "mendoza" | "entre_rios" | "tucuman";
type TipoOperacion = "compraventa" | "alquiler";
type BaseHonorarios = "comprador" | "vendedor" | "ambos";
type TabActivo = "compraventa" | "alquiler" | "comparar";

interface TasasProvincia {
  nombre: string;
  sellosCompraventa: number;
  selloBuyer: number;
  selloSeller: number;
  selloBuyerAlquiler: number;
  selloSellerAlquiler: number;
  ingresosBrutos: number;
  iva: boolean;
}

// ── Datos ─────────────────────────────────────────────────────────────────────

const PROVINCIAS: Record<Provincia, TasasProvincia> = {
  santa_fe:     { nombre: "Santa Fe",     sellosCompraventa: 2.0,  selloBuyer: 1.0,   selloSeller: 1.0,   selloBuyerAlquiler: 0.5,   selloSellerAlquiler: 0.5,   ingresosBrutos: 0, iva: true },
  buenos_aires: { nombre: "Buenos Aires", sellosCompraventa: 4.0,  selloBuyer: 2.0,   selloSeller: 2.0,   selloBuyerAlquiler: 1.0,   selloSellerAlquiler: 1.0,   ingresosBrutos: 0, iva: true },
  caba:         { nombre: "CABA",         sellosCompraventa: 3.6,  selloBuyer: 1.8,   selloSeller: 1.8,   selloBuyerAlquiler: 0.9,   selloSellerAlquiler: 0.9,   ingresosBrutos: 0, iva: true },
  cordoba:      { nombre: "Córdoba",      sellosCompraventa: 3.0,  selloBuyer: 1.5,   selloSeller: 1.5,   selloBuyerAlquiler: 0.75,  selloSellerAlquiler: 0.75,  ingresosBrutos: 0, iva: true },
  mendoza:      { nombre: "Mendoza",      sellosCompraventa: 3.0,  selloBuyer: 1.5,   selloSeller: 1.5,   selloBuyerAlquiler: 0.5,   selloSellerAlquiler: 0.5,   ingresosBrutos: 0, iva: true },
  entre_rios:   { nombre: "Entre Ríos",   sellosCompraventa: 3.0,  selloBuyer: 1.5,   selloSeller: 1.5,   selloBuyerAlquiler: 0.75,  selloSellerAlquiler: 0.75,  ingresosBrutos: 0, iva: true },
  tucuman:      { nombre: "Tucumán",      sellosCompraventa: 2.5,  selloBuyer: 1.25,  selloSeller: 1.25,  selloBuyerAlquiler: 0.625, selloSellerAlquiler: 0.625, ingresosBrutos: 0, iva: true },
};

const PROVINCIA_IDS = Object.keys(PROVINCIAS) as Provincia[];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtUSD(n: number): string {
  return "USD " + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return n.toFixed(2) + "%";
}

// ── Estilos base ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  padding: "8px 12px",
  fontFamily: "Inter, sans-serif",
  fontSize: 13,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "rgba(255,255,255,0.4)",
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 5,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: 20,
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function ImpuestoSellosPage() {
  // ── Estado ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabActivo>("compraventa");
  const [provincia, setProvincia] = useState<Provincia>("santa_fe");

  // Compraventa
  const [valorEscritura, setValorEscritura] = useState(50_000_000);
  const [tipoCambio, setTipoCambio] = useState(1300);
  const [honorariosInmobiliaria, setHonorariosInmobiliaria] = useState(3.0);
  const [baseHonorarios, setBaseHonorarios] = useState<BaseHonorarios>("ambos");
  const [incluyeIVA, setIncluyeIVA] = useState(true);

  // Alquiler
  const [alquilerMensual, setAlquilerMensual] = useState(200_000);
  const [mesesComision, setMesesComision] = useState<1 | 2>(1);
  const [incluyeIVAAlq, setIncluyeIVAAlq] = useState(true);

  // ── Cálculos compraventa ───────────────────────────────────────────────────
  const calcCompraventa = useMemo(() => {
    const tasas = PROVINCIAS[provincia];

    // Comprador
    const selloComprador = valorEscritura * tasas.selloBuyer / 100;
    const honorariosCompradorBase = baseHonorarios !== "vendedor"
      ? valorEscritura * honorariosInmobiliaria / 100
      : 0;
    const ivaComprador = incluyeIVA ? honorariosCompradorBase * 0.21 : 0;
    const honorariosCompradorTotal = honorariosCompradorBase + ivaComprador;
    const escribaniaComprador = valorEscritura * 0.015;
    const totalComprador = selloComprador + honorariosCompradorTotal + escribaniaComprador;

    // Vendedor
    const selloVendedor = valorEscritura * tasas.selloSeller / 100;
    const honorariosVendedorBase = baseHonorarios !== "comprador"
      ? valorEscritura * honorariosInmobiliaria / 100
      : 0;
    const ivaVendedor = incluyeIVA ? honorariosVendedorBase * 0.21 : 0;
    const honorariosVendedorTotal = honorariosVendedorBase + ivaVendedor;
    const iti = valorEscritura * 0.015;
    const totalVendedor = selloVendedor + honorariosVendedorTotal + iti;

    const totalOperacion = totalComprador + totalVendedor;

    return {
      selloComprador, honorariosCompradorBase, ivaComprador,
      honorariosCompradorTotal, escribaniaComprador, totalComprador,
      selloVendedor, honorariosVendedorBase, ivaVendedor,
      honorariosVendedorTotal, iti, totalVendedor, totalOperacion,
    };
  }, [provincia, valorEscritura, honorariosInmobiliaria, baseHonorarios, incluyeIVA]);

  // ── Cálculos alquiler ─────────────────────────────────────────────────────
  const calcAlquiler = useMemo(() => {
    const tasas = PROVINCIAS[provincia];
    const valorContrato = alquilerMensual * 12;

    const selloInquilino = valorContrato * tasas.selloBuyerAlquiler / 100;
    const selloPropietario = valorContrato * tasas.selloSellerAlquiler / 100;

    const comisionBaseInquilino = alquilerMensual * mesesComision;
    const ivaInquilino = incluyeIVAAlq ? comisionBaseInquilino * 0.21 : 0;
    const comisionInquilinoTotal = comisionBaseInquilino + ivaInquilino;

    const comisionBasePropietario = alquilerMensual * mesesComision;
    const ivaPropietario = incluyeIVAAlq ? comisionBasePropietario * 0.21 : 0;
    const comisionPropietarioTotal = comisionBasePropietario + ivaPropietario;

    const totalInquilino = selloInquilino + comisionInquilinoTotal;
    const totalPropietario = selloPropietario + comisionPropietarioTotal;

    return {
      valorContrato,
      selloInquilino, comisionBaseInquilino, ivaInquilino, comisionInquilinoTotal, totalInquilino,
      selloPropietario, comisionBasePropietario, ivaPropietario, comisionPropietarioTotal, totalPropietario,
    };
  }, [provincia, alquilerMensual, mesesComision, incluyeIVAAlq]);

  // ── Cálculos comparativa ──────────────────────────────────────────────────
  const comparativa = useMemo(() => {
    return PROVINCIA_IDS.map((id) => {
      const tasas = PROVINCIAS[id];
      const selloBuyer = valorEscritura * tasas.selloBuyer / 100;
      const selloSeller = valorEscritura * tasas.selloSeller / 100;
      const totalSellos = selloBuyer + selloSeller;

      const honBase = valorEscritura * honorariosInmobiliaria / 100;
      const iva = incluyeIVA ? honBase * 0.21 : 0;
      const honTotal = (honBase + iva) * 2; // ambos
      const escribania = valorEscritura * 0.015;
      const iti = valorEscritura * 0.015;
      const totalEst = totalSellos + honTotal + escribania + iti;

      return { id, tasas, selloBuyer, selloSeller, totalSellos, totalEst };
    }).sort((a, b) => a.totalSellos - b.totalSellos);
  }, [valorEscritura, honorariosInmobiliaria, incluyeIVA]);

  const maxTotalSellos = Math.max(...comparativa.map((c) => c.totalSellos));

  // ── Renderizado ───────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>
          ← Calculadoras
        </Link>
        <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Gastos de Escritura y Sellos
        </h1>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {(["compraventa", "alquiler", "comparar"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 20px",
                borderRadius: 20,
                border: "none",
                background: tab === t ? "#cc0000" : "rgba(255,255,255,0.06)",
                color: tab === t ? "#fff" : "rgba(255,255,255,0.5)",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                letterSpacing: "0.04em",
                textTransform: "capitalize",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {t === "comparar" ? "Comparar provincias" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ─── TAB COMPRAVENTA ──────────────────────────────────────────────── */}
        {tab === "compraventa" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>

            {/* Panel inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ ...cardStyle }}>
                <p style={{ margin: "0 0 16px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Parámetros
                </p>

                {/* Provincia */}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Provincia</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {PROVINCIA_IDS.map((id) => (
                      <button
                        key={id}
                        onClick={() => setProvincia(id)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 12,
                          border: `1px solid ${provincia === id ? "#cc0000" : "rgba(255,255,255,0.12)"}`,
                          background: provincia === id ? "rgba(204,0,0,0.18)" : "transparent",
                          color: provincia === id ? "#cc0000" : "rgba(255,255,255,0.5)",
                          fontSize: 11,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.12s",
                        }}
                      >
                        {PROVINCIAS[id].nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Valor escritura */}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Valor escritura (ARS)</label>
                  <input
                    type="number"
                    value={valorEscritura}
                    step={1_000_000}
                    min={0}
                    onChange={(e) => setValorEscritura(parseFloat(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </div>

                {/* Tipo cambio */}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Tipo de cambio (ARS/USD)</label>
                  <input
                    type="number"
                    value={tipoCambio}
                    step={50}
                    min={1}
                    onChange={(e) => setTipoCambio(parseFloat(e.target.value) || 1)}
                    style={inputStyle}
                  />
                </div>

                {/* Honorarios */}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Honorarios inmobiliaria (%)</label>
                  <input
                    type="number"
                    value={honorariosInmobiliaria}
                    step={0.5}
                    min={0}
                    max={10}
                    onChange={(e) => setHonorariosInmobiliaria(parseFloat(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </div>

                {/* Base honorarios */}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Comisión a cargo de</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["comprador", "vendedor", "ambos"] as const).map((b) => (
                      <button
                        key={b}
                        onClick={() => setBaseHonorarios(b)}
                        style={{
                          flex: 1,
                          padding: "6px 0",
                          borderRadius: 8,
                          border: `1px solid ${baseHonorarios === b ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                          background: baseHonorarios === b ? "rgba(204,0,0,0.12)" : "transparent",
                          color: baseHonorarios === b ? "#cc0000" : "rgba(255,255,255,0.4)",
                          fontSize: 10,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* IVA toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>IVA 21% sobre honorarios</span>
                  <button
                    onClick={() => setIncluyeIVA((v) => !v)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: "none",
                      background: incluyeIVA ? "#cc0000" : "rgba(255,255,255,0.15)",
                      cursor: "pointer", position: "relative", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: incluyeIVA ? 23 : 3,
                      transition: "left 0.2s",
                    }} />
                  </button>
                </div>
              </div>

              {/* KPI valor USD */}
              <div style={{ ...cardStyle, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                  Equiv. en USD
                </div>
                <div style={{ fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff" }}>
                  {fmtUSD(valorEscritura / tipoCambio)}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                  TC: ${tipoCambio.toLocaleString("es-AR")}
                </div>
              </div>
            </div>

            {/* Panel resultados */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* KPI Total Operación */}
              <div style={{ background: "rgba(204,0,0,0.06)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 14, padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                  Total Operación (comprador + vendedor)
                </div>
                <div style={{ fontSize: 36, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000", lineHeight: 1 }}>
                  {fmtARS(calcCompraventa.totalOperacion)}
                </div>
                <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", marginTop: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
                  {fmtUSD(calcCompraventa.totalOperacion / tipoCambio)}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                  {fmtPct((calcCompraventa.totalOperacion / valorEscritura) * 100)} del valor escritura
                </div>
              </div>

              {/* 2 columnas: Comprador | Vendedor */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

                {/* Comprador */}
                <div style={{ ...cardStyle, border: "1px solid rgba(59,130,246,0.15)" }}>
                  <p style={{ margin: "0 0 14px", fontSize: 11, color: "#3b82f6", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Comprador
                  </p>
                  <DesgloseFila
                    label={`Sellado provincial (${PROVINCIAS[provincia].selloBuyer}%)`}
                    ars={calcCompraventa.selloComprador}
                    total={valorEscritura}
                  />
                  <DesgloseFila
                    label={`Honorarios inmobiliaria (${honorariosInmobiliaria}%)`}
                    ars={calcCompraventa.honorariosCompradorBase}
                    total={valorEscritura}
                    dimmed={baseHonorarios === "vendedor"}
                  />
                  <DesgloseFila
                    label="IVA sobre honorarios (21%)"
                    ars={calcCompraventa.ivaComprador}
                    total={valorEscritura}
                    dimmed={!incluyeIVA || baseHonorarios === "vendedor"}
                  />
                  <DesgloseFila
                    label="Escribanía estimada (1.5%)"
                    ars={calcCompraventa.escribaniaComprador}
                    total={valorEscritura}
                  />
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12 }}>TOTAL</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#3b82f6" }}>{fmtARS(calcCompraventa.totalComprador)}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{fmtPct((calcCompraventa.totalComprador / valorEscritura) * 100)}</div>
                    </div>
                  </div>
                </div>

                {/* Vendedor */}
                <div style={{ ...cardStyle, border: "1px solid rgba(204,0,0,0.15)" }}>
                  <p style={{ margin: "0 0 14px", fontSize: 11, color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Vendedor
                  </p>
                  <DesgloseFila
                    label={`Sellado provincial (${PROVINCIAS[provincia].selloSeller}%)`}
                    ars={calcCompraventa.selloVendedor}
                    total={valorEscritura}
                  />
                  <DesgloseFila
                    label={`Honorarios inmobiliaria (${honorariosInmobiliaria}%)`}
                    ars={calcCompraventa.honorariosVendedorBase}
                    total={valorEscritura}
                    dimmed={baseHonorarios === "comprador"}
                  />
                  <DesgloseFila
                    label="IVA sobre honorarios (21%)"
                    ars={calcCompraventa.ivaVendedor}
                    total={valorEscritura}
                    dimmed={!incluyeIVA || baseHonorarios === "comprador"}
                  />
                  <DesgloseFila
                    label="ITI / Plusvalía (1.5% est.)"
                    ars={calcCompraventa.iti}
                    total={valorEscritura}
                  />
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12 }}>TOTAL</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000" }}>{fmtARS(calcCompraventa.totalVendedor)}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{fmtPct((calcCompraventa.totalVendedor / valorEscritura) * 100)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nota */}
              <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 16px" }}>
                <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>Estimación orientativa — </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>La escribanía y el ITI pueden variar según el caso. Verificar con el escribano interviniente. Tasas actualizadas a 2026.</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB ALQUILER ─────────────────────────────────────────────────── */}
        {tab === "alquiler" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>

            {/* Panel inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ ...cardStyle }}>
                <p style={{ margin: "0 0 16px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Parámetros
                </p>

                {/* Provincia */}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Provincia</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {PROVINCIA_IDS.map((id) => (
                      <button
                        key={id}
                        onClick={() => setProvincia(id)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 12,
                          border: `1px solid ${provincia === id ? "#cc0000" : "rgba(255,255,255,0.12)"}`,
                          background: provincia === id ? "rgba(204,0,0,0.18)" : "transparent",
                          color: provincia === id ? "#cc0000" : "rgba(255,255,255,0.5)",
                          fontSize: 11,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {PROVINCIAS[id].nombre}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Alquiler mensual (ARS)</label>
                  <input
                    type="number"
                    value={alquilerMensual}
                    step={10_000}
                    min={0}
                    onChange={(e) => setAlquilerMensual(parseFloat(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Meses de comisión</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([1, 2] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMesesComision(m)}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          borderRadius: 8,
                          border: `1px solid ${mesesComision === m ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                          background: mesesComision === m ? "rgba(204,0,0,0.12)" : "transparent",
                          color: mesesComision === m ? "#cc0000" : "rgba(255,255,255,0.4)",
                          fontSize: 13,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {m} {m === 1 ? "mes" : "meses"}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>IVA 21% sobre comisión</span>
                  <button
                    onClick={() => setIncluyeIVAAlq((v) => !v)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: "none",
                      background: incluyeIVAAlq ? "#cc0000" : "rgba(255,255,255,0.15)",
                      cursor: "pointer", position: "relative", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: incluyeIVAAlq ? 23 : 3,
                      transition: "left 0.2s",
                    }} />
                  </button>
                </div>
              </div>

              {/* Info contrato anual */}
              <div style={{ ...cardStyle }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Contrato anual
                </div>
                <div style={{ fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff" }}>
                  {fmtARS(calcAlquiler.valorContrato)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                  Base de cálculo del sellado
                </div>
              </div>
            </div>

            {/* Panel resultados */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* 2 columnas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

                {/* Inquilino */}
                <div style={{ ...cardStyle, border: "1px solid rgba(59,130,246,0.15)" }}>
                  <p style={{ margin: "0 0 14px", fontSize: 11, color: "#3b82f6", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Inquilino
                  </p>
                  <DesgloseFila
                    label={`Sellado provincial (${PROVINCIAS[provincia].selloBuyerAlquiler}% s/ contrato anual)`}
                    ars={calcAlquiler.selloInquilino}
                    total={calcAlquiler.valorContrato}
                  />
                  <DesgloseFila
                    label={`Comisión inmobiliaria (${mesesComision} mes${mesesComision > 1 ? "es" : ""})`}
                    ars={calcAlquiler.comisionBaseInquilino}
                    total={calcAlquiler.valorContrato}
                  />
                  <DesgloseFila
                    label="IVA sobre comisión (21%)"
                    ars={calcAlquiler.ivaInquilino}
                    total={calcAlquiler.valorContrato}
                    dimmed={!incluyeIVAAlq}
                  />
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12 }}>TOTAL</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#3b82f6" }}>{fmtARS(calcAlquiler.totalInquilino)}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{fmtPct((calcAlquiler.totalInquilino / alquilerMensual) * 100)} del alq. mensual</div>
                    </div>
                  </div>
                </div>

                {/* Propietario */}
                <div style={{ ...cardStyle, border: "1px solid rgba(204,0,0,0.15)" }}>
                  <p style={{ margin: "0 0 14px", fontSize: 11, color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Propietario
                  </p>
                  <DesgloseFila
                    label={`Sellado provincial (${PROVINCIAS[provincia].selloSellerAlquiler}% s/ contrato anual)`}
                    ars={calcAlquiler.selloPropietario}
                    total={calcAlquiler.valorContrato}
                  />
                  <DesgloseFila
                    label={`Comisión inmobiliaria (${mesesComision} mes${mesesComision > 1 ? "es" : ""})`}
                    ars={calcAlquiler.comisionBasePropietario}
                    total={calcAlquiler.valorContrato}
                  />
                  <DesgloseFila
                    label="IVA sobre comisión (21%)"
                    ars={calcAlquiler.ivaPropietario}
                    total={calcAlquiler.valorContrato}
                    dimmed={!incluyeIVAAlq}
                  />
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12 }}>TOTAL</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000" }}>{fmtARS(calcAlquiler.totalPropietario)}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{fmtPct((calcAlquiler.totalPropietario / alquilerMensual) * 100)} del alq. mensual</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nota sellado */}
              <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "12px 16px" }}>
                <span style={{ fontSize: 11, color: "#818cf8", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>Nota: </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>El sellado de alquiler se calcula sobre el valor del contrato anual ({fmtARS(calcAlquiler.valorContrato)}). Tasas provinciales actualizadas a 2026.</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB COMPARAR ─────────────────────────────────────────────────── */}
        {tab === "comparar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Inputs globales */}
            <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <div>
                <label style={labelStyle}>Valor escritura (ARS)</label>
                <input
                  type="number"
                  value={valorEscritura}
                  step={1_000_000}
                  min={0}
                  onChange={(e) => setValorEscritura(parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Honorarios inmobiliaria (%)</label>
                <input
                  type="number"
                  value={honorariosInmobiliaria}
                  step={0.5}
                  min={0}
                  max={10}
                  onChange={(e) => setHonorariosInmobiliaria(parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tipo de cambio (ARS/USD)</label>
                <input
                  type="number"
                  value={tipoCambio}
                  step={50}
                  min={1}
                  onChange={(e) => setTipoCambio(parseFloat(e.target.value) || 1)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Tabla comparativa */}
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Provincia", "Sello comprador", "Sello vendedor", "Total sellos", "Total op. (est.)"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparativa.map((row, i) => {
                    const isActive = row.id === provincia;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setProvincia(row.id)}
                        style={{
                          background: isActive ? "rgba(204,0,0,0.07)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                      >
                        <td style={{ padding: "12px 16px", fontFamily: "Montserrat, sans-serif", fontWeight: isActive ? 800 : 600, fontSize: 13, color: isActive ? "#cc0000" : "#fff" }}>
                          {row.tasas.nombre}
                          {isActive && <span style={{ marginLeft: 6, fontSize: 9, background: "#cc0000", color: "#fff", padding: "2px 6px", borderRadius: 4, verticalAlign: "middle" }}>ACTIVA</span>}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                          {fmtARS(row.selloBuyer)} <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>({row.tasas.selloBuyer}%)</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                          {fmtARS(row.selloSeller)} <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>({row.tasas.selloSeller}%)</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: isActive ? "#cc0000" : "#fff" }}>
                          {fmtARS(row.totalSellos)} <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>({row.tasas.sellosCompraventa}%)</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                          {fmtARS(row.totalEst)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Gráfico de barras horizontales SVG */}
            <div style={{ ...cardStyle }}>
              <p style={{ margin: "0 0 16px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Comparativa visual — Total sellos por provincia
              </p>
              <svg width="100%" height={comparativa.length * 40} style={{ display: "block" }}>
                {comparativa.map((row, i) => {
                  const isActive = row.id === provincia;
                  const barMaxWidth = 520;
                  const barWidth = maxTotalSellos > 0 ? (row.totalSellos / maxTotalSellos) * barMaxWidth : 0;
                  const y = i * 40;
                  const labelW = 110;
                  const barX = labelW + 8;

                  return (
                    <g key={row.id} onClick={() => setProvincia(row.id)} style={{ cursor: "pointer" }}>
                      <text
                        x={labelW}
                        y={y + 20}
                        textAnchor="end"
                        fill={isActive ? "#cc0000" : "rgba(255,255,255,0.55)"}
                        fontSize={11}
                        fontFamily="Montserrat, sans-serif"
                        fontWeight={isActive ? 700 : 500}
                        dominantBaseline="middle"
                      >
                        {row.tasas.nombre}
                      </text>
                      {/* fondo barra */}
                      <rect x={barX} y={y + 12} width={barMaxWidth} height={16} rx={4} fill="rgba(255,255,255,0.04)" />
                      {/* barra activa */}
                      <rect
                        x={barX}
                        y={y + 12}
                        width={barWidth}
                        height={16}
                        rx={4}
                        fill={isActive ? "#cc0000" : "rgba(255,255,255,0.2)"}
                        style={{ transition: "width 0.3s" }}
                      />
                      {/* label monto */}
                      <text
                        x={barX + barWidth + 8}
                        y={y + 20}
                        fill={isActive ? "#cc0000" : "rgba(255,255,255,0.4)"}
                        fontSize={10}
                        fontFamily="Montserrat, sans-serif"
                        fontWeight={isActive ? 700 : 400}
                        dominantBaseline="middle"
                      >
                        {row.tasas.sellosCompraventa}%
                      </text>
                    </g>
                  );
                })}
              </svg>
              <p style={{ margin: "12px 0 0", fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "Montserrat, sans-serif" }}>
                Haz clic en una provincia para seleccionarla en los otros tabs.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componente fila de desglose ──────────────────────────────────────────

interface DesgloseFilaProps {
  label: string;
  ars: number;
  total: number;
  dimmed?: boolean;
}

function DesgloseFila({ label, ars, total, dimmed = false }: DesgloseFilaProps) {
  const pct = total > 0 ? (ars / total) * 100 : 0;
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "7px 0",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      opacity: dimmed ? 0.3 : 1,
    }}>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", flex: 1, paddingRight: 8, lineHeight: 1.3 }}>{label}</span>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: dimmed ? "rgba(255,255,255,0.3)" : "#fff" }}>
          {fmtARS(ars)}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
          {fmtPct(pct)}
        </div>
      </div>
    </div>
  );
}
