"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

type RegimeType = "iti" | "ganancias";
type PersonaType = "fisica_residente" | "fisica_no_residente" | "juridica";
type BienType = "unica_vivienda" | "segunda_propiedad" | "inversion";

// ── Constantes ───────────────────────────────────────────────────────────────

// Variación acumulada aproximada del RIPTE/IPIM por año (para ajuste impositivo)
// Datos históricos anuales simplificados (inflación acumulada por año)
const INFLACION_ANUAL: Record<number, number> = {
  2010: 0.26, 2011: 0.24, 2012: 0.25, 2013: 0.26, 2014: 0.38,
  2015: 0.27, 2016: 0.40, 2017: 0.25, 2018: 0.48, 2019: 0.54,
  2020: 0.36, 2021: 0.51, 2022: 0.95, 2023: 2.11, 2024: 1.17,
  2025: 0.35, 2026: 0.18,
};

const MESES_NOMBRE = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function calcularCoeficienteActualizacion(anioCompra: number, mesCompra: number, anioVenta: number, mesVenta: number): number {
  let coef = 1;
  for (let anio = anioCompra; anio <= anioVenta; anio++) {
    const inf = INFLACION_ANUAL[anio] ?? 0.35;
    if (anio === anioCompra) {
      const mesesRestantes = 12 - mesCompra;
      coef *= (1 + inf * (mesesRestantes / 12));
    } else if (anio === anioVenta) {
      coef *= (1 + inf * (mesVenta / 12));
    } else {
      coef *= (1 + inf);
    }
  }
  return coef;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function CalculadoraGanancia() {
  const [persona, setPersona] = useState<PersonaType>("fisica_residente");
  const [bien, setBien] = useState<BienType>("unica_vivienda");
  const [anioCompra, setAnioCompra] = useState(2018);
  const [mesCompra, setMesCompra] = useState(1);
  const [precioCompraUSD, setPrecioCompraUSD] = useState(120000);
  const [precioVentaUSD, setPrecioVentaUSD] = useState(180000);
  const [tcCompra, setTcCompra] = useState(38);
  const [tcVenta, setTcVenta] = useState(1200);
  const [gastosCompra, setGastosCompra] = useState(4500);
  const [gastosVenta, setGastosVenta] = useState(3000);
  const [honorariosCompra, setHonorariosCompra] = useState(3.0);
  const [honorariosVenta, setHonorariosVenta] = useState(3.0);
  const [reinversion, setReinversion] = useState(false);
  const [montoReinversion, setMontoReinversion] = useState(0);
  const [anioVenta] = useState(2026);
  const [mesVenta] = useState(5);

  const resultado = useMemo(() => {
    const aniosDesdeCompra = anioVenta - anioCompra + (mesVenta - mesCompra) / 12;

    // Régimen aplicable
    let regimen: RegimeType;
    if (anioCompra < 2018) {
      regimen = "iti";
    } else if (persona === "juridica") {
      regimen = "ganancias";
    } else if (persona === "fisica_no_residente") {
      regimen = "ganancias";
    } else {
      regimen = "ganancias";
    }

    // Exención única vivienda (persona física residente, habitada ≥2 años)
    const exencionUnicaVivienda =
      bien === "unica_vivienda" &&
      persona === "fisica_residente" &&
      aniosDesdeCompra >= 2 &&
      anioCompra >= 2018;

    // ── RÉGIMEN ITI ──────────────────────────────────────────────────────────
    if (regimen === "iti" || anioCompra < 2018) {
      const mayorValor = Math.max(precioCompraUSD * tcCompra, precioVentaUSD * tcVenta);
      const baseITI = precioVentaUSD * tcVenta;
      const iti = baseITI * 0.015;
      const netoVendedor = precioVentaUSD * tcVenta
        - iti
        - (gastosVenta + honorariosVenta / 100 * precioVentaUSD * tcVenta);

      return {
        regimen: "ITI" as const,
        exento: false,
        baseImponible: baseITI,
        impuesto: iti,
        tasaEfectiva: 1.5,
        gananciaReal: (precioVentaUSD - precioCompraUSD) * tcVenta,
        gananciaUSD: precioVentaUSD - precioCompraUSD,
        netoVendedor,
        coefActualizacion: 1,
        costoActualizado: precioCompraUSD * tcCompra,
        mayorValor,
        exencionUnicaVivienda: false,
        montoExento: 0,
        impuestoFinal: iti,
        recomendacion: "Régimen ITI (adquisición anterior a 2018). Tasa fija 1.5% sobre precio de venta.",
      };
    }

    // ── RÉGIMEN GANANCIAS (Ley 27.430) ──────────────────────────────────────
    const coef = calcularCoeficienteActualizacion(anioCompra, mesCompra, anioVenta, mesVenta);
    const costoCompraARS = precioCompraUSD * tcCompra;
    const costoCompraAjustado = costoCompraARS * coef;
    const gastosCompraAjustados = (gastosCompra + honorariosCompra / 100 * precioCompraUSD * tcCompra) * coef;
    const costoTotalAjustado = costoCompraAjustado + gastosCompraAjustados;

    const ingresoVenta = precioVentaUSD * tcVenta;
    const gastosVentaTotal = gastosVenta + honorariosVenta / 100 * precioVentaUSD * tcVenta;
    const gananciaReal = ingresoVenta - gastosVentaTotal - costoTotalAjustado;

    const gananciaUSD = precioVentaUSD - precioCompraUSD;

    if (exencionUnicaVivienda) {
      const netoVendedor = ingresoVenta - gastosVentaTotal;
      return {
        regimen: "Ganancias" as const,
        exento: true,
        baseImponible: 0,
        impuesto: 0,
        tasaEfectiva: 0,
        gananciaReal,
        gananciaUSD,
        netoVendedor,
        coefActualizacion: coef,
        costoActualizado: costoTotalAjustado,
        mayorValor: ingresoVenta,
        exencionUnicaVivienda: true,
        montoExento: gananciaReal > 0 ? gananciaReal : 0,
        impuestoFinal: 0,
        recomendacion: "Exento por única vivienda habitada ≥ 2 años (art. 26 LIG, inc. l). No tributa Impuesto a las Ganancias.",
      };
    }

    // Tasa: personas físicas 15% sobre ganancia neta ajustada
    // Personas jurídicas: 35%
    // No residentes: 17.5%
    let tasa = 0.15;
    if (persona === "juridica") tasa = 0.35;
    if (persona === "fisica_no_residente") tasa = 0.175;

    const gananciaGravada = Math.max(0, gananciaReal);

    // Reinversión: reduce base proporcional
    let baseGravada = gananciaGravada;
    let montoExento = 0;
    if (reinversion && montoReinversion > 0) {
      const pctReinversion = Math.min(montoReinversion * tcVenta / ingresoVenta, 1);
      montoExento = gananciaGravada * pctReinversion;
      baseGravada = gananciaGravada - montoExento;
    }

    const impuesto = baseGravada * tasa;
    const tasaEfectiva = ingresoVenta > 0 ? (impuesto / ingresoVenta) * 100 : 0;
    const netoVendedor = ingresoVenta - gastosVentaTotal - impuesto;

    return {
      regimen: "Ganancias" as const,
      exento: false,
      baseImponible: gananciaGravada,
      impuesto: impuesto,
      tasaEfectiva,
      gananciaReal,
      gananciaUSD,
      netoVendedor,
      coefActualizacion: coef,
      costoActualizado: costoTotalAjustado,
      mayorValor: ingresoVenta,
      exencionUnicaVivienda: false,
      montoExento,
      impuestoFinal: impuesto,
      recomendacion: gananciaReal <= 0
        ? "No hay ganancia imponible — la operación arroja quebranto fiscal."
        : `Impuesto a las Ganancias cedular al ${(tasa * 100).toFixed(1)}% sobre la ganancia real ajustada por inflación.`,
    };
  }, [persona, bien, anioCompra, mesCompra, precioCompraUSD, precioVentaUSD, tcCompra, tcVenta, gastosCompra, gastosVenta, honorariosCompra, honorariosVenta, reinversion, montoReinversion, anioVenta, mesVenta]);

  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const fmtUSD = (n: number) => `USD ${fmt(n)}`;
  const fmtARS = (n: number) => `$ ${fmt(n)}`;

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 14, width: "100%", fontFamily: "Inter, sans-serif",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block" };
  const sectionStyle: React.CSSProperties = { background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" };
  const kpiStyle = (color: string): React.CSSProperties => ({
    background: "#111", border: `1px solid ${color}33`, borderRadius: 10, padding: "16px 20px",
    display: "flex", flexDirection: "column", gap: 4,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff" }}>
            💸 Ganancia en Venta
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>ITI vs Impuesto a las Ganancias — Régimen cedular Ley 27.430</p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Configuración */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Datos del vendedor */}
          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: 14, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000", textTransform: "uppercase" }}>Vendedor</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Tipo de persona</label>
                <select value={persona} onChange={e => setPersona(e.target.value as PersonaType)} style={inputStyle}>
                  <option value="fisica_residente">Persona física residente</option>
                  <option value="fisica_no_residente">Persona física no residente</option>
                  <option value="juridica">Persona jurídica (empresa)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo de bien</label>
                <select value={bien} onChange={e => setBien(e.target.value as BienType)} style={inputStyle}>
                  <option value="unica_vivienda">Única vivienda (habitada)</option>
                  <option value="segunda_propiedad">Segunda propiedad</option>
                  <option value="inversion">Propiedad de inversión</option>
                </select>
              </div>
            </div>
          </div>

          {/* Datos de compra */}
          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: 14, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#3b82f6", textTransform: "uppercase" }}>Adquisición</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Año compra</label>
                  <input type="number" value={anioCompra} min={1990} max={2026}
                    onChange={e => setAnioCompra(+e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Mes compra</label>
                  <select value={mesCompra} onChange={e => setMesCompra(+e.target.value)} style={inputStyle}>
                    {MESES_NOMBRE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Precio de compra (USD)</label>
                <input type="number" value={precioCompraUSD} onChange={e => setPrecioCompraUSD(+e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TC al momento de compra (ARS/USD)</label>
                <input type="number" value={tcCompra} onChange={e => setTcCompra(+e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Gastos escritura compra (ARS)</label>
                  <input type="number" value={gastosCompra} onChange={e => setGastosCompra(+e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Honorarios compra (%)</label>
                  <input type="number" step={0.1} value={honorariosCompra} onChange={e => setHonorariosCompra(+e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Datos de venta */}
        <div style={sectionStyle}>
          <h2 style={{ margin: "0 0 16px", fontSize: 14, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#22c55e", textTransform: "uppercase" }}>Venta (May 2026)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            <div>
              <label style={labelStyle}>Precio de venta (USD)</label>
              <input type="number" value={precioVentaUSD} onChange={e => setPrecioVentaUSD(+e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>TC actual (ARS/USD)</label>
              <input type="number" value={tcVenta} onChange={e => setTcVenta(+e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Gastos escritura venta (ARS)</label>
              <input type="number" value={gastosVenta} onChange={e => setGastosVenta(+e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Honorarios venta (%)</label>
              <input type="number" step={0.1} value={honorariosVenta} onChange={e => setHonorariosVenta(+e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" id="reinversion" checked={reinversion} onChange={e => setReinversion(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#cc0000" }} />
            <label htmlFor="reinversion" style={{ fontSize: 13, color: "#ccc" }}>Reinversión en otra propiedad (reduce base imponible)</label>
          </div>
          {reinversion && (
            <div style={{ marginTop: 8, maxWidth: 300 }}>
              <label style={labelStyle}>Monto reinversión (USD)</label>
              <input type="number" value={montoReinversion} onChange={e => setMontoReinversion(+e.target.value)} style={inputStyle} />
            </div>
          )}
        </div>

        {/* Régimen detectado */}
        <div style={{
          background: anioCompra < 2018 ? "#3b82f610" : resultado.exento ? "#22c55e10" : "#cc000010",
          border: `1px solid ${anioCompra < 2018 ? "#3b82f6" : resultado.exento ? "#22c55e" : "#cc0000"}`,
          borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>{resultado.exento ? "✅" : anioCompra < 2018 ? "📋" : "⚠️"}</span>
          <div>
            <div style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: resultado.exento ? "#22c55e" : anioCompra < 2018 ? "#3b82f6" : "#cc0000" }}>
              RÉGIMEN: {resultado.regimen}
              {resultado.exento && " — EXENTO"}
              {!resultado.exento && anioCompra < 2018 && " (adquisición pre-2018)"}
            </div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{resultado.recomendacion}</div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <div style={kpiStyle("#22c55e")}>
            <span style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>GANANCIA USD</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: resultado.gananciaUSD >= 0 ? "#22c55e" : "#ef4444" }}>
              {fmtUSD(resultado.gananciaUSD)}
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>Sin ajustar por inflación</span>
          </div>
          <div style={kpiStyle("#a78bfa")}>
            <span style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>COEF. ACTUALIZACIÓN</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#a78bfa" }}>×{resultado.coefActualizacion.toFixed(2)}</span>
            <span style={{ fontSize: 11, color: "#666" }}>Inflación acum. {((resultado.coefActualizacion - 1) * 100).toFixed(0)}%</span>
          </div>
          <div style={kpiStyle("#3b82f6")}>
            <span style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>COSTO AJUSTADO</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6" }}>{fmtARS(resultado.costoActualizado)}</span>
            <span style={{ fontSize: 11, color: "#666" }}>Base imponible ajustada</span>
          </div>
          <div style={kpiStyle(resultado.impuestoFinal > 0 ? "#cc0000" : "#22c55e")}>
            <span style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>IMPUESTO</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: resultado.impuestoFinal > 0 ? "#cc0000" : "#22c55e" }}>
              {resultado.impuestoFinal > 0 ? fmtARS(resultado.impuestoFinal) : "EXENTO"}
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>
              {resultado.impuestoFinal > 0 ? `Tasa efectiva ${resultado.tasaEfectiva.toFixed(2)}%` : "No tributa"}
            </span>
          </div>
          <div style={kpiStyle("#f59e0b")}>
            <span style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>NETO VENDEDOR</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{fmtARS(resultado.netoVendedor)}</span>
            <span style={{ fontSize: 11, color: "#666" }}>Después de impuesto y gastos</span>
          </div>
        </div>

        {/* Desglose */}
        <div style={sectionStyle}>
          <h2 style={{ margin: "0 0 16px", fontSize: 14, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>Desglose del cálculo</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { label: "Precio de venta", val: fmtARS(precioVentaUSD * tcVenta), sub: fmtUSD(precioVentaUSD), color: "#22c55e" },
              { label: "− Gastos de escritura (venta)", val: fmtARS(gastosVenta), sub: "", color: "#ef4444" },
              { label: `− Honorarios inmobiliaria (${honorariosVenta}%)`, val: fmtARS(honorariosVenta / 100 * precioVentaUSD * tcVenta), sub: "", color: "#ef4444" },
              { label: "Precio de compra (ajustado)", val: fmtARS(resultado.costoActualizado), sub: `Coef. ×${resultado.coefActualizacion.toFixed(2)}`, color: "#3b82f6" },
              { label: "Ganancia real (ARS)", val: fmtARS(resultado.gananciaReal), sub: "", color: resultado.gananciaReal >= 0 ? "#22c55e" : "#ef4444" },
              ...(resultado.montoExento > 0 ? [{ label: "Exención por reinversión", val: fmtARS(resultado.montoExento), sub: `${(resultado.montoExento / resultado.gananciaReal * 100).toFixed(0)}% de la ganancia`, color: "#22c55e" }] : []),
              { label: "Base imponible", val: fmtARS(resultado.baseImponible - (resultado.montoExento ?? 0)), sub: "", color: "#f59e0b" },
              { label: "Impuesto determinado", val: resultado.exento ? "EXENTO" : fmtARS(resultado.impuestoFinal), sub: resultado.exento ? "" : `Tasa ${resultado.tasaEfectiva.toFixed(2)}% sobre precio`, color: resultado.exento ? "#22c55e" : "#cc0000" },
              { label: "Neto del vendedor", val: fmtARS(resultado.netoVendedor), sub: `≈ ${fmtUSD(resultado.netoVendedor / tcVenta)}`, color: "#a78bfa" },
            ].map((row, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: "1px solid #1a1a1a",
              }}>
                <div style={{ fontSize: 13, color: "#ccc" }}>{row.label}</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: row.color }}>{row.val}</div>
                  {row.sub && <div style={{ fontSize: 11, color: "#666" }}>{row.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info normativa */}
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: 10, padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#666", textTransform: "uppercase" }}>Marco normativo</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { norma: "Ley 27.430 (Dic 2017)", desc: "Reemplaza ITI por Impuesto a las Ganancias cedular para inmuebles adquiridos desde 01/01/2018." },
              { norma: "Disposición transitoria", desc: "Inmuebles adquiridos antes de 2018 tributan ITI (1.5%) según Ley 23.905." },
              { norma: "Tasa cedular", desc: "Personas físicas residentes: 15%. No residentes: 17.5% (retención del comprador). Empresas: 35%." },
              { norma: "Exención única vivienda", desc: "Art. 26 inc. l) LIG: exentas las ventas de inmueble que constituye única vivienda habitada por el vendedor, siempre que destine el producido a la adquisición de otro inmueble." },
              { norma: "Ajuste por inflación", desc: "El costo de adquisición se actualiza por el índice IPIM desde la fecha de compra hasta la de venta." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, fontSize: 12 }}>
                <span style={{ color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, minWidth: 180, flexShrink: 0 }}>{item.norma}</span>
                <span style={{ color: "#888" }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
