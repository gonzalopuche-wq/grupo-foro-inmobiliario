"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Datos por provincia ──────────────────────────────────────────────────────

interface ProvinciaData {
  nombre: string;
  sellos: number;          // % total (cada parte paga la mitad)
  honorariosComp: number;  // % escribano comprador
  honorariosVend: number;  // % escribano vendedor
  registro: number;        // % inscripción registro
}

const PROVINCIAS: Record<string, ProvinciaData> = {
  caba:          { nombre: "CABA",           sellos: 2.50, honorariosComp: 1.50, honorariosVend: 0.75, registro: 0.30 },
  buenos_aires:  { nombre: "Buenos Aires",   sellos: 4.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.35 },
  cordoba:       { nombre: "Córdoba",         sellos: 2.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.25 },
  santa_fe:      { nombre: "Santa Fe",        sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.25 },
  mendoza:       { nombre: "Mendoza",         sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  tucuman:       { nombre: "Tucumán",         sellos: 1.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  entre_rios:    { nombre: "Entre Ríos",      sellos: 2.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.25 },
  salta:         { nombre: "Salta",           sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  neuquen:       { nombre: "Neuquén",         sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.25 },
  rio_negro:     { nombre: "Río Negro",       sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  chaco:         { nombre: "Chaco",           sellos: 2.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.25 },
  misiones:      { nombre: "Misiones",        sellos: 1.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  corrientes:    { nombre: "Corrientes",      sellos: 2.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  san_luis:      { nombre: "San Luis",        sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  la_pampa:      { nombre: "La Pampa",        sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  chubut:        { nombre: "Chubut",          sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  santa_cruz:    { nombre: "Santa Cruz",      sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  jujuy:         { nombre: "Jujuy",           sellos: 1.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  formosa:       { nombre: "Formosa",         sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  catamarca:     { nombre: "Catamarca",       sellos: 1.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  la_rioja:      { nombre: "La Rioja",        sellos: 1.50, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  san_juan:      { nombre: "San Juan",        sellos: 2.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  santiago:      { nombre: "Stgo. del Estero",sellos: 1.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
  tierra_fuego:  { nombre: "Tierra del Fuego",sellos: 1.00, honorariosComp: 1.00, honorariosVend: 0.50, registro: 0.20 },
};

const usd = (n: number) => `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const ars = (n: number) => `ARS ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${n.toFixed(2)}%`;

interface Concepto { label: string; pctBase: number; valorUSD: number; valorARS: number; nota?: string }

export default function CalculadoraEscritura() {
  const [precioUSD, setPrecioUSD] = useState<string>("100000");
  const [tc, setTc] = useState<string>("1200");
  const [provincia, setProvincia] = useState<string>("caba");
  const [vendedorTipo, setVendedorTipo] = useState<"fisica_exenta" | "fisica_iti" | "empresa">("fisica_exenta");
  const [hipoteca, setHipoteca] = useState(false);
  const [hipMonto, setHipMonto] = useState<string>("50000");
  const [coti, setCoti] = useState(true);

  const calc = useMemo(() => {
    const precio = parseFloat(precioUSD) || 0;
    const cambio = parseFloat(tc) || 1;
    const precioARS = precio * cambio;
    const prov = PROVINCIAS[provincia];
    const sellosParteUSD = precio * (prov.sellos / 2 / 100);
    const hipMontoUSD = parseFloat(hipMonto) || 0;

    // ── COMPRADOR ──
    const comprador: Concepto[] = [
      {
        label: "Impuesto de sellos (50%)",
        pctBase: prov.sellos / 2,
        valorUSD: sellosParteUSD,
        valorARS: sellosParteUSD * cambio,
        nota: `${pct(prov.sellos / 2)} sobre precio escritura`,
      },
      {
        label: "Honorarios escribano",
        pctBase: prov.honorariosComp,
        valorUSD: precio * (prov.honorariosComp / 100),
        valorARS: precio * (prov.honorariosComp / 100) * cambio,
        nota: `${pct(prov.honorariosComp)} (regulado por Colegio de Escribanos)`,
      },
      {
        label: "Inscripción Registro Propiedad",
        pctBase: prov.registro,
        valorUSD: precio * (prov.registro / 100),
        valorARS: precio * (prov.registro / 100) * cambio,
      },
    ];

    if (coti) {
      const cotiUSD = Math.max(precio * 0.0005, 50);
      comprador.push({
        label: "Certificado COTI",
        pctBase: 0,
        valorUSD: cotiUSD,
        valorARS: cotiUSD * cambio,
        nota: "~0.05% o mín. $50 (obligatorio si precio > base imponible)",
      });
    }

    if (hipoteca && hipMontoUSD > 0) {
      comprador.push({
        label: "Escribanía hipoteca (banco)",
        pctBase: 0,
        valorUSD: hipMontoUSD * 0.015,
        valorARS: hipMontoUSD * 0.015 * cambio,
        nota: "~1.5% del monto hipotecario",
      });
      comprador.push({
        label: "Impuesto sellos hipoteca",
        pctBase: 0,
        valorUSD: hipMontoUSD * (prov.sellos / 100) * 0.5,
        valorARS: hipMontoUSD * (prov.sellos / 100) * 0.5 * cambio,
        nota: `${pct(prov.sellos / 2)} del monto hipotecario`,
      });
    }

    // ── VENDEDOR ──
    const vendedor: Concepto[] = [
      {
        label: "Impuesto de sellos (50%)",
        pctBase: prov.sellos / 2,
        valorUSD: sellosParteUSD,
        valorARS: sellosParteUSD * cambio,
        nota: `${pct(prov.sellos / 2)} sobre precio escritura`,
      },
      {
        label: "Honorarios escribano",
        pctBase: prov.honorariosVend,
        valorUSD: precio * (prov.honorariosVend / 100),
        valorARS: precio * (prov.honorariosVend / 100) * cambio,
        nota: `${pct(prov.honorariosVend)} (regulado por Colegio)`,
      },
      {
        label: "Diligencias y certificados",
        pctBase: 0.10,
        valorUSD: precio * 0.001,
        valorARS: precio * 0.001 * cambio,
        nota: "AFIP, certificados dominiales, libre inhibición, etc.",
      },
    ];

    if (vendedorTipo === "fisica_iti") {
      vendedor.push({
        label: "ITI — Impuesto Transferencia Inmuebles",
        pctBase: 1.50,
        valorUSD: precio * 0.015,
        valorARS: precio * 0.015 * cambio,
        nota: "1.5% — persona física no inscripta en Ganancias",
      });
    } else if (vendedorTipo === "fisica_exenta") {
      vendedor.push({
        label: "ITI / Ganancias",
        pctBase: 0,
        valorUSD: 0,
        valorARS: 0,
        nota: "EXENTO — única vivienda y casa-habitación (art. 14 Ley 23.905)",
      });
    } else {
      vendedor.push({
        label: "Impuesto a las Ganancias",
        pctBase: 0,
        valorUSD: 0,
        valorARS: 0,
        nota: "Variable — empresa debe consultar con contador (no calculado automáticamente)",
      });
    }

    const totalCompUSD = comprador.reduce((s, c) => s + c.valorUSD, 0);
    const totalVendUSD = vendedor.reduce((s, c) => s + c.valorUSD, 0);
    const totalCompARS = totalCompUSD * cambio;
    const totalVendARS = totalVendUSD * cambio;

    return {
      precio, precioARS, cambio, prov, comprador, vendedor,
      totalCompUSD, totalVendUSD, totalCompARS, totalVendARS,
      totalUSD: totalCompUSD + totalVendUSD,
      pctComp: precio > 0 ? (totalCompUSD / precio) * 100 : 0,
      pctVend: precio > 0 ? (totalVendUSD / precio) * 100 : 0,
    };
  }, [precioUSD, tc, provincia, vendedorTipo, hipoteca, hipMonto, coti]);

  const inputStyle = {
    background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 14, padding: "8px 12px", width: "100%",
  };
  const labelStyle = {
    fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.4)", marginBottom: 5,
  };
  const cardStyle = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10, padding: "20px 22px",
  };

  function renderConceptos(conceptos: Concepto[], color: string) {
    return conceptos.map((c, i) => {
      const isZero = c.valorUSD === 0 && c.pctBase === 0 && c.nota?.startsWith("EXENTO") === false && !c.nota?.startsWith("Variable");
      return (
        <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "10px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{c.label}</div>
              {c.nota && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{c.nota}</div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
              {c.valorUSD > 0 ? (
                <>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 700, color }}>{usd(c.valorUSD)}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{ars(c.valorARS)}</div>
                </>
              ) : (
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                  {c.nota?.startsWith("EXENTO") ? "EXENTO" : c.nota?.startsWith("Variable") ? "VER CONT." : "—"}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  }

  const maxBar = Math.max(calc.totalCompUSD, calc.totalVendUSD, 1);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Gastos de Escritura</h1>
        <span style={{ background: "#cc0000", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>ARG</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        {/* Panel izquierdo — inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>Datos de la operación</h3>

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Precio escritura (USD)</div>
              <input style={inputStyle} type="number" value={precioUSD} onChange={e => setPrecioUSD(e.target.value)} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Tipo de cambio (ARS / USD)</div>
              <input style={inputStyle} type="number" value={tc} onChange={e => setTc(e.target.value)} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                Precio ARS: {ars(calc.precioARS)}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Provincia</div>
              <select style={inputStyle} value={provincia} onChange={e => setProvincia(e.target.value)}>
                {Object.entries(PROVINCIAS).sort((a,b) => a[1].nombre.localeCompare(b[1].nombre)).map(([k,v]) => (
                  <option key={k} value={k}>{v.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>Situación del vendedor</h3>

            {(["fisica_exenta","fisica_iti","empresa"] as const).map(tipo => (
              <label key={tipo} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, cursor: "pointer" }}>
                <input type="radio" name="vendedor" checked={vendedorTipo === tipo} onChange={() => setVendedorTipo(tipo)} style={{ marginTop: 3, accentColor: "#cc0000" }} />
                <div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                    {tipo === "fisica_exenta" && "Persona física — exento ITI"}
                    {tipo === "fisica_iti" && "Persona física — paga ITI (1.5%)"}
                    {tipo === "empresa" && "Persona jurídica / empresa"}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                    {tipo === "fisica_exenta" && "Única vivienda y casa-habitación (art. 14 Ley 23.905)"}
                    {tipo === "fisica_iti" && "No inscripto en Ganancias / no exento"}
                    {tipo === "empresa" && "Ganancias variable — consultar contador"}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>Opciones adicionales</h3>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={coti} onChange={e => setCoti(e.target.checked)} style={{ accentColor: "#cc0000" }} />
              <div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Incluir COTI</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Código de oferta de transferencia inmobiliaria</div>
              </div>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: hipoteca ? 12 : 0, cursor: "pointer" }}>
              <input type="checkbox" checked={hipoteca} onChange={e => setHipoteca(e.target.checked)} style={{ accentColor: "#cc0000" }} />
              <div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>El comprador financia con hipoteca</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Agrega costos bancarios y sellos hipoteca</div>
              </div>
            </label>

            {hipoteca && (
              <div style={{ marginTop: 8 }}>
                <div style={labelStyle}>Monto hipoteca (USD)</div>
                <input style={inputStyle} type="number" value={hipMonto} onChange={e => setHipMonto(e.target.value)} />
              </div>
            )}
          </div>

          {/* Nota legal */}
          <div style={{ background: "#0d0d0d", border: "1px solid rgba(255,165,0,0.2)", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", marginBottom: 4 }}>AVISO LEGAL</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
              Los valores son estimativos. Los aranceles de escribanos y registros pueden variar según el colegio jurisdiccional. Consultar con profesionales habilitados antes de formalizar operaciones.
            </div>
          </div>
        </div>

        {/* Panel derecho — resultados */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "Gasto comprador", val: usd(calc.totalCompUSD), sub: pct(calc.pctComp) + " del precio", color: "#3b82f6" },
              { label: "Gasto vendedor", val: usd(calc.totalVendUSD), sub: pct(calc.pctVend) + " del precio", color: "#cc0000" },
              { label: "Total transacción", val: usd(calc.totalUSD), sub: ars(calc.totalUSD * calc.cambio), color: "#22c55e" },
            ].map((k, i) => (
              <div key={i} style={{ ...cardStyle, textAlign: "center" }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{k.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Barra comparativa */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Comparación de gastos</div>
            {[
              { label: "Comprador", val: calc.totalCompUSD, color: "#3b82f6", pct: calc.pctComp },
              { label: "Vendedor", val: calc.totalVendUSD, color: "#cc0000", pct: calc.pctVend },
            ].map(b => (
              <div key={b.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{b.label}</span>
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: b.color }}>{usd(b.val)} · {pct(b.pct)}</span>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(b.val / maxBar) * 100}%`, background: b.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}

            {/* Desglose de sellos por provincia */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>Info provincia — {calc.prov.nombre}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { k: "Sellos totales", v: pct(calc.prov.sellos) },
                  { k: "Cada parte", v: pct(calc.prov.sellos / 2) },
                  { k: "Escribano comprador", v: pct(calc.prov.honorariosComp) },
                  { k: "Escribano vendedor", v: pct(calc.prov.honorariosVend) },
                ].map(r => (
                  <div key={r.k} style={{ background: "#111", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{r.k}</div>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detalle comprador y vendedor */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Comprador */}
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3b82f6" }}>Comprador</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: "#3b82f6" }}>{usd(calc.totalCompUSD)}</div>
              </div>
              {renderConceptos(calc.comprador, "#3b82f6")}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>TOTAL</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: "#3b82f6" }}>{usd(calc.totalCompUSD)}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{ars(calc.totalCompARS)}</div>
                </div>
              </div>
            </div>

            {/* Vendedor */}
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#cc0000" }}>Vendedor</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: "#cc0000" }}>{usd(calc.totalVendUSD)}</div>
              </div>
              {renderConceptos(calc.vendedor, "#cc0000")}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>TOTAL</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: "#cc0000" }}>{usd(calc.totalVendUSD)}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{ars(calc.totalVendARS)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Botón PDF */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                const win = window.open("", "_blank");
                if (!win) return;
                const rows = (items: Concepto[]) => items.map(c => `
                  <tr>
                    <td>${c.label}</td>
                    <td style="text-align:right">${c.valorUSD > 0 ? usd(c.valorUSD) : (c.nota?.startsWith("EXENTO") ? "EXENTO" : "—")}</td>
                    <td style="color:#aaa;text-align:right">${c.valorUSD > 0 ? ars(c.valorARS) : ""}</td>
                  </tr>`).join("");
                win.document.write(`<!doctype html><html><head><title>Gastos Escritura</title>
                  <style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px}
                  h1{font-size:18px}h2{font-size:14px;margin-top:20px}
                  table{width:100%;border-collapse:collapse;margin-top:8px}
                  td,th{padding:6px 8px;border-bottom:1px solid #eee}
                  th{background:#f5f5f5;font-weight:bold}
                  .kpi{display:inline-block;background:#f5f5f5;border-radius:6px;padding:10px 16px;margin:4px;min-width:160px}
                  .kpi-val{font-size:18px;font-weight:bold}
                  </style></head><body>
                  <h1>Gastos de Escritura</h1>
                  <p>Precio: ${usd(calc.precio)} · TC: $${calc.cambio} · Provincia: ${calc.prov.nombre}</p>
                  <div>
                    <div class="kpi"><div class="kpi-val">${usd(calc.totalCompUSD)}</div><div>Gasto Comprador</div></div>
                    <div class="kpi"><div class="kpi-val">${usd(calc.totalVendUSD)}</div><div>Gasto Vendedor</div></div>
                    <div class="kpi"><div class="kpi-val">${usd(calc.totalUSD)}</div><div>Total Transacción</div></div>
                  </div>
                  <h2>Gastos Comprador</h2>
                  <table><thead><tr><th>Concepto</th><th>USD</th><th>ARS</th></tr></thead><tbody>${rows(calc.comprador)}</tbody></table>
                  <h2>Gastos Vendedor</h2>
                  <table><thead><tr><th>Concepto</th><th>USD</th><th>ARS</th></tr></thead><tbody>${rows(calc.vendedor)}</tbody></table>
                  <p style="margin-top:20px;font-size:10px;color:#777">Valores estimativos. Consultar con escribano habilitado.</p>
                  </body></html>`);
                setTimeout(() => win.print(), 400);
              }}
              style={{ background: "#cc0000", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}
            >
              Exportar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
