"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Moneda = "USD" | "ARS";

interface Inputs {
  fechaAdquisicion: string;
  precioCompra: number;
  precioVenta: number;
  moneda: Moneda;
  tipoCambio: number;
  gastosCompra: number;   // % del precio compra
  gastosVenta: number;    // % del precio venta
  mejoras: number;        // en USD
  esCasaHabitacion: boolean;
  esHerencia: boolean;
  valorFiscalHerencia: number;
  actualizacionBCRA: number; // % acumulado de actualización
}

interface Resultado {
  esRegCedular: boolean;
  exento: boolean;
  precioVentaUSD: number;
  precioCompraUSD: number;
  gastosVentaMonto: number;
  gastosCompraMonto: number;
  costoActualizado: number;
  ingresoNetoVenta: number;
  gananciaNetaCedular: number;
  impuestoCedular: number;
  impuestoITI: number;
  impuestoFinal: number;
  utilidadNeta: number;
  rentabilidadPct: number;
  requiereCOTI: boolean;
  precioVentaARS: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtN = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

const fmtUSD = (n: number) => `USD ${fmtN(n)}`;
const fmtARS = (n: number) => `$ ${fmtN(n)}`;

const fmtPct = (n: number) =>
  `${n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

// ── Estilos base ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#fff",
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  fontFamily: "Inter, sans-serif",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
  display: "block",
};

const sectionStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 10,
  padding: "20px 24px",
};

const kpiCard = (color: string): React.CSSProperties => ({
  background: "#111",
  border: `1px solid ${color}33`,
  borderRadius: 10,
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
});

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      id={id}
      role="switch"
      aria-checked={checked}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? "#cc0000" : "#333",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
        }}
      />
    </div>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ── Cálculos ──────────────────────────────────────────────────────────────────

function calcular(inp: Inputs): Resultado {
  const tc = inp.tipoCambio > 0 ? inp.tipoCambio : 1;

  // Convertir todo a USD para el cálculo interno
  const toUSD = (v: number) =>
    inp.moneda === "ARS" ? v / tc : v;

  const precioVentaUSD = toUSD(inp.precioVenta);
  const precioVentaARS = precioVentaUSD * tc;

  // Costo base de compra
  const precioCompraBase = inp.esHerencia
    ? toUSD(inp.valorFiscalHerencia)
    : toUSD(inp.precioCompra);

  const esRegCedular = inp.fechaAdquisicion >= "2018-01-01";

  // Gastos de venta (% sobre precio venta)
  const gastosVentaMonto = precioVentaUSD * (inp.gastosVenta / 100);

  // Gastos de compra (% sobre precio compra base)
  const gastosCompraMonto = precioCompraBase * (inp.gastosCompra / 100);

  // Costo actualizado (solo régimen cedular)
  const costoActualizado = esRegCedular
    ? precioCompraBase * (1 + inp.actualizacionBCRA / 100) +
      inp.mejoras +
      gastosCompraMonto
    : precioCompraBase + gastosCompraMonto;

  const ingresoNetoVenta = precioVentaUSD - gastosVentaMonto;

  // Ganancia neta cedular
  const gananciaNetaCedular = ingresoNetoVenta - costoActualizado;

  // Impuesto cedular 15%
  const impuestoCedular =
    gananciaNetaCedular > 0 ? gananciaNetaCedular * 0.15 : 0;

  // ITI 1.5% sobre precio bruto de venta
  const impuestoITI = precioVentaUSD * 0.015;

  // Impuesto final
  let impuestoFinal: number;
  if (inp.esCasaHabitacion) {
    impuestoFinal = 0;
  } else if (esRegCedular) {
    impuestoFinal = impuestoCedular;
  } else {
    impuestoFinal = impuestoITI;
  }

  const exento = inp.esCasaHabitacion || impuestoFinal === 0;

  // Utilidad neta
  const costoTotalVendedor = costoActualizado + gastosVentaMonto;
  const utilidadNeta = precioVentaUSD - costoTotalVendedor - impuestoFinal;

  const costoTotalCompra = costoActualizado;
  const rentabilidadPct =
    costoTotalCompra > 0 ? (utilidadNeta / costoTotalCompra) * 100 : 0;

  // COTI si precio venta ARS >= 7.000.000
  const requiereCOTI = precioVentaARS >= 7_000_000;

  return {
    esRegCedular,
    exento,
    precioVentaUSD,
    precioCompraUSD: precioCompraBase,
    gastosVentaMonto,
    gastosCompraMonto,
    costoActualizado,
    ingresoNetoVenta,
    gananciaNetaCedular,
    impuestoCedular,
    impuestoITI,
    impuestoFinal,
    utilidadNeta,
    rentabilidadPct,
    requiereCOTI,
    precioVentaARS,
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function GananciasVentaPage() {
  const [fechaAdquisicion, setFechaAdquisicion] = useState("2020-06-01");
  const [precioCompra, setPrecioCompra] = useState(100000);
  const [precioVenta, setPrecioVenta] = useState(200000);
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [tipoCambio, setTipoCambio] = useState(1300);
  const [gastosCompra, setGastosCompra] = useState(4);
  const [gastosVenta, setGastosVenta] = useState(3.5);
  const [mejoras, setMejoras] = useState(0);
  const [esCasaHabitacion, setEsCasaHabitacion] = useState(false);
  const [esHerencia, setEsHerencia] = useState(false);
  const [valorFiscalHerencia, setValorFiscalHerencia] = useState(0);
  const [actualizacionBCRA, setActualizacionBCRA] = useState(800);

  const res = useMemo<Resultado>(
    () =>
      calcular({
        fechaAdquisicion,
        precioCompra,
        precioVenta,
        moneda,
        tipoCambio,
        gastosCompra,
        gastosVenta,
        mejoras,
        esCasaHabitacion,
        esHerencia,
        valorFiscalHerencia,
        actualizacionBCRA,
      }),
    [
      fechaAdquisicion,
      precioCompra,
      precioVenta,
      moneda,
      tipoCambio,
      gastosCompra,
      gastosVenta,
      mejoras,
      esCasaHabitacion,
      esHerencia,
      valorFiscalHerencia,
      actualizacionBCRA,
    ]
  );

  // ── Régimen badge ───────────────────────────────────────────────────────────

  const regimeBadgeColor = res.exento
    ? "#22c55e"
    : res.esRegCedular
    ? "#3b82f6"
    : "#f59e0b";

  const regimeBadgeLabel = res.exento
    ? "EXENTO"
    : res.esRegCedular
    ? "Régimen Cedular 15%"
    : "Régimen ITI 1.5%";

  const regimeDesc = res.exento
    ? "Casa-habitación única y permanente — sin impuesto (art. 26 inc. l) LIG)"
    : res.esRegCedular
    ? "Adquisición desde 01/01/2018 — Impuesto cedular 15% sobre ganancia neta (Ley 27.430)"
    : "Adquisición previa a 2018 — ITI 1.5% sobre precio bruto de venta (Ley 23.905)";

  // ── PDF export ──────────────────────────────────────────────────────────────

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;

    const tasaLabel = res.esRegCedular ? "15% (cedular)" : "1.5% (ITI)";
    const tc = tipoCambio;
    const toARS = (usd: number) => fmtARS(usd * tc);

    const tableRows = [
      [
        "Precio de venta",
        fmtUSD(res.precioVentaUSD),
        toARS(res.precioVentaUSD),
      ],
      [
        `− Gastos de venta (${gastosVenta}%)`,
        fmtUSD(res.gastosVentaMonto),
        toARS(res.gastosVentaMonto),
      ],
      [
        "= Ingreso neto de venta",
        fmtUSD(res.ingresoNetoVenta),
        toARS(res.ingresoNetoVenta),
      ],
      [
        "− Costo de adquisición actualizado",
        fmtUSD(res.costoActualizado),
        toARS(res.costoActualizado),
      ],
      [
        `− Gastos de compra originales (${gastosCompra}%)`,
        fmtUSD(res.gastosCompraMonto),
        toARS(res.gastosCompraMonto),
      ],
      [
        "− Mejoras declaradas",
        fmtUSD(mejoras),
        toARS(mejoras),
      ],
      [
        "= Ganancia neta computable",
        fmtUSD(res.gananciaNetaCedular),
        toARS(res.gananciaNetaCedular),
      ],
      [
        `Impuesto (${tasaLabel})`,
        res.exento ? "EXENTO" : fmtUSD(res.impuestoFinal),
        res.exento ? "" : toARS(res.impuestoFinal),
      ],
      [
        "= Utilidad neta después de impuesto",
        fmtUSD(res.utilidadNeta),
        toARS(res.utilidadNeta),
      ],
    ]
      .map(
        ([c, u, a]) =>
          `<tr><td>${c}</td><td style="text-align:right">${u}</td><td style="text-align:right;color:#555">${a}</td></tr>`
      )
      .join("");

    win.document.write(`<!doctype html><html><head><title>Ganancias en Venta de Inmueble</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;max-width:800px;margin:0 auto}
        h1{font-size:18px;margin-bottom:4px}
        h2{font-size:13px;margin-top:20px;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px}
        p{margin:2px 0;color:#555;font-size:11px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        td,th{padding:7px 10px;border-bottom:1px solid #eee}
        th{background:#f5f5f5;font-weight:bold;text-align:left}
        .badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:bold;margin-bottom:8px}
        .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
        .kpi{background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:10px 12px}
        .kpi-val{font-size:16px;font-weight:bold}
        .kpi-lbl{font-size:10px;color:#777;margin-top:2px}
        .disclaimer{font-size:9px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:8px;font-style:italic}
        .highlight{font-weight:bold}
      </style></head><body>
      <h1>Calculadora — Impuesto a las Ganancias por Venta de Inmueble</h1>
      <p>Fecha de adquisición: ${fechaAdquisicion} · Moneda: ${moneda} · TC: $${fmtN(tipoCambio)}</p>
      <span class="badge" style="background:${res.exento ? "#d1fae5" : res.esRegCedular ? "#dbeafe" : "#fef3c7"};color:${res.exento ? "#065f46" : res.esRegCedular ? "#1e40af" : "#92400e"}">${regimeBadgeLabel}</span>
      <p>${regimeDesc}</p>
      <h2>Resumen</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val">${res.exento ? "EXENTO" : fmtUSD(res.impuestoFinal)}</div><div class="kpi-lbl">Impuesto final</div></div>
        <div class="kpi"><div class="kpi-val">${fmtUSD(res.gananciaNetaCedular)}</div><div class="kpi-lbl">Ganancia neta antes de impuesto</div></div>
        <div class="kpi"><div class="kpi-val">${fmtUSD(res.utilidadNeta)}</div><div class="kpi-lbl">Utilidad neta después de impuesto</div></div>
        <div class="kpi"><div class="kpi-val">${fmtPct(res.rentabilidadPct)}</div><div class="kpi-lbl">Rentabilidad % neta</div></div>
      </div>
      <h2>Desglose detallado</h2>
      <table>
        <thead><tr><th>Concepto</th><th style="text-align:right">USD</th><th style="text-align:right">ARS</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      ${res.requiereCOTI ? `<p style="margin-top:12px;background:#fff3cd;padding:8px 12px;border-radius:4px;color:#856404;font-weight:bold">COTI obligatorio: el precio de venta supera $7.000.000 ARS</p>` : ""}
      <p class="disclaimer">Esta calculadora tiene carácter meramente orientativo y no constituye asesoramiento fiscal, legal ni contable. Los resultados son estimaciones basadas en los datos ingresados y la normativa vigente al momento del cálculo. Se recomienda consultar con un contador público matriculado antes de tomar decisiones impositivas.</p>
      </body></html>`);

    setTimeout(() => win.print(), 400);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const tc = tipoCambio;
  const toARS = (usd: number) => usd * tc;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#111",
          borderBottom: "1px solid #222",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/calculadoras"
            style={{ color: "#888", textDecoration: "none", fontSize: 13 }}
          >
            &larr; Calculadoras
          </Link>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                color: "#fff",
              }}
            >
              Impuesto a las Ganancias — Venta de Inmueble
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              Régimen cedular (post-2018) y ITI (pre-2018) · Exenciones y COTI
            </p>
          </div>
        </div>
        <button
          onClick={exportarPDF}
          style={{
            background: "#cc0000",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 18px",
            fontSize: 13,
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Exportar PDF
        </button>
      </div>

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* COTI banner */}
        {res.requiereCOTI && (
          <div
            style={{
              background: "#f59e0b18",
              border: "1px solid #f59e0b",
              borderRadius: 10,
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 18,
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                color: "#f59e0b",
              }}
            >
              COTI
            </span>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#f59e0b",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                Operacion requiere COTI
              </div>
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                El precio de venta supera $7.000.000 ARS — debe obtenerse el
                Codigo de Oferta de Transferencia Inmobiliaria ante la AFIP
                antes de publicar la propiedad.
              </div>
            </div>
          </div>
        )}

        {/* Banner régimen */}
        <div
          style={{
            background: `${regimeBadgeColor}12`,
            border: `1px solid ${regimeBadgeColor}`,
            borderRadius: 10,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              background: regimeBadgeColor,
              color: "#fff",
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 12,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {regimeBadgeLabel}
          </span>
          <div style={{ fontSize: 13, color: "#aaa" }}>{regimeDesc}</div>
        </div>

        {/* Inputs grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          {/* Datos de la operación */}
          <div style={sectionStyle}>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: 13,
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                color: "#cc0000",
                textTransform: "uppercase",
              }}
            >
              Datos de la operacion
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Fecha de adquisicion">
                <input
                  type="date"
                  value={fechaAdquisicion}
                  onChange={(e) => setFechaAdquisicion(e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Moneda">
                  <select
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value as Moneda)}
                    style={inputStyle}
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </Field>
                <Field label="Tipo de cambio (ARS/USD)">
                  <input
                    type="number"
                    value={tipoCambio}
                    min={1}
                    onChange={(e) => setTipoCambio(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
              </div>

              {/* Precio compra / herencia */}
              {esHerencia ? (
                <Field label="Valor fiscal herencia">
                  <input
                    type="number"
                    value={valorFiscalHerencia}
                    min={0}
                    onChange={(e) =>
                      setValorFiscalHerencia(Number(e.target.value))
                    }
                    style={inputStyle}
                  />
                </Field>
              ) : (
                <Field label={`Precio de compra (${moneda})`}>
                  <input
                    type="number"
                    value={precioCompra}
                    min={0}
                    onChange={(e) => setPrecioCompra(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
              )}

              <Field label={`Precio de venta (${moneda})`}>
                <input
                  type="number"
                  value={precioVenta}
                  min={0}
                  onChange={(e) => setPrecioVenta(Number(e.target.value))}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          {/* Deducciones */}
          <div style={sectionStyle}>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: 13,
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                color: "#3b82f6",
                textTransform: "uppercase",
              }}
            >
              Deducciones y ajustes
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Gastos de compra (% precio compra)">
                  <input
                    type="number"
                    value={gastosCompra}
                    min={0}
                    step={0.1}
                    onChange={(e) => setGastosCompra(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Gastos de venta (% precio venta)">
                  <input
                    type="number"
                    value={gastosVenta}
                    min={0}
                    step={0.1}
                    onChange={(e) => setGastosVenta(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Mejoras declaradas (USD)">
                <input
                  type="number"
                  value={mejoras}
                  min={0}
                  onChange={(e) => setMejoras(Number(e.target.value))}
                  style={inputStyle}
                />
              </Field>

              {res.esRegCedular && (
                <Field label="Actualizacion BCRA acumulada (%)">
                  <input
                    type="number"
                    value={actualizacionBCRA}
                    min={0}
                    step={10}
                    onChange={(e) =>
                      setActualizacionBCRA(Number(e.target.value))
                    }
                    style={inputStyle}
                  />
                </Field>
              )}

              {/* Toggles */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 4,
                }}
              >
                {/* Casa habitación */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#ccc",
                        fontWeight: 500,
                      }}
                    >
                      Casa-habitacion unica y permanente
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      Exencion total del impuesto
                    </div>
                  </div>
                  <Toggle
                    id="casa-habitacion"
                    checked={esCasaHabitacion}
                    onChange={setEsCasaHabitacion}
                  />
                </div>

                {/* Herencia */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#ccc",
                        fontWeight: 500,
                      }}
                    >
                      Inmueble recibido por herencia
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      Base = valor fiscal de la declaratoria
                    </div>
                  </div>
                  <Toggle
                    id="herencia"
                    checked={esHerencia}
                    onChange={setEsHerencia}
                  />
                </div>
              </div>

              {/* Alerta exención */}
              {esCasaHabitacion && (
                <div
                  style={{
                    background: "#22c55e18",
                    border: "1px solid #22c55e",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#22c55e",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                  }}
                >
                  EXENTO — Casa habitacion
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {/* Impuesto final */}
          <div style={kpiCard(res.exento ? "#22c55e" : "#cc0000")}>
            <span
              style={{
                fontSize: 11,
                color: "#888",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Impuesto final
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: res.exento ? "#22c55e" : "#cc0000",
              }}
            >
              {res.exento ? "EXENTO" : fmtUSD(res.impuestoFinal)}
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>
              {res.exento
                ? "Sin cargo impositivo"
                : res.esRegCedular
                ? "15% sobre ganancia neta"
                : "1.5% sobre precio bruto"}
            </span>
          </div>

          {/* Ganancia neta antes */}
          <div style={kpiCard(res.gananciaNetaCedular >= 0 ? "#22c55e" : "#ef4444")}>
            <span
              style={{
                fontSize: 11,
                color: "#888",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Ganancia neta antes de impuesto
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color:
                  res.gananciaNetaCedular >= 0 ? "#22c55e" : "#ef4444",
              }}
            >
              {fmtUSD(res.gananciaNetaCedular)}
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>
              {fmtARS(toARS(res.gananciaNetaCedular))}
            </span>
          </div>

          {/* Utilidad neta */}
          <div style={kpiCard(res.utilidadNeta >= 0 ? "#a78bfa" : "#ef4444")}>
            <span
              style={{
                fontSize: 11,
                color: "#888",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Utilidad neta despues de impuesto
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: res.utilidadNeta >= 0 ? "#a78bfa" : "#ef4444",
              }}
            >
              {fmtUSD(res.utilidadNeta)}
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>
              {fmtARS(toARS(res.utilidadNeta))}
            </span>
          </div>

          {/* Rentabilidad */}
          <div style={kpiCard(res.rentabilidadPct >= 0 ? "#f59e0b" : "#ef4444")}>
            <span
              style={{
                fontSize: 11,
                color: "#888",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Rentabilidad % neta
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: res.rentabilidadPct >= 0 ? "#f59e0b" : "#ef4444",
              }}
            >
              {fmtPct(res.rentabilidadPct)}
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>
              Sobre costo actualizado
            </span>
          </div>
        </div>

        {/* Tabla desglose detallada */}
        <div style={sectionStyle}>
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              color: "#fff",
              textTransform: "uppercase",
            }}
          >
            Desglose detallado
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  {["Concepto", "USD", "ARS"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #333",
                        textAlign: i === 0 ? "left" : "right",
                        fontSize: 11,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    {
                      label: "Precio de venta",
                      usd: res.precioVentaUSD,
                      color: "#22c55e",
                      bold: false,
                    },
                    {
                      label: `− Gastos de venta (${gastosVenta}%)`,
                      usd: -res.gastosVentaMonto,
                      color: "#ef4444",
                      bold: false,
                    },
                    {
                      label: "= Ingreso neto de venta",
                      usd: res.ingresoNetoVenta,
                      color: "#fff",
                      bold: true,
                    },
                    {
                      label: "− Costo de adquisicion actualizado",
                      usd: -res.costoActualizado,
                      color: "#ef4444",
                      bold: false,
                    },
                    {
                      label: `− Gastos de compra originales (${gastosCompra}%)`,
                      usd: -res.gastosCompraMonto,
                      color: "#ef4444",
                      bold: false,
                    },
                    {
                      label: "− Mejoras declaradas",
                      usd: -mejoras,
                      color: "#ef4444",
                      bold: false,
                    },
                    {
                      label: "= Ganancia neta computable",
                      usd: res.gananciaNetaCedular,
                      color:
                        res.gananciaNetaCedular >= 0 ? "#22c55e" : "#ef4444",
                      bold: true,
                    },
                    {
                      label: res.esRegCedular
                        ? "Impuesto (15% cedular)"
                        : "Impuesto ITI (1.5%)",
                      usd: res.exento ? null : -res.impuestoFinal,
                      color: res.exento ? "#22c55e" : "#cc0000",
                      bold: false,
                      special: res.exento ? "EXENTO" : undefined,
                    },
                    {
                      label: "= Utilidad neta despues de impuesto",
                      usd: res.utilidadNeta,
                      color: res.utilidadNeta >= 0 ? "#a78bfa" : "#ef4444",
                      bold: true,
                    },
                  ] as Array<{
                    label: string;
                    usd: number | null;
                    color: string;
                    bold: boolean;
                    special?: string;
                  }>
                ).map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      background: row.bold ? "#ffffff08" : "transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #1a1a1a",
                        color: row.bold ? "#fff" : "#aaa",
                        fontWeight: row.bold ? 600 : 400,
                      }}
                    >
                      {row.label}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #1a1a1a",
                        textAlign: "right",
                        color: row.color,
                        fontWeight: row.bold ? 700 : 500,
                      }}
                    >
                      {row.special
                        ? row.special
                        : row.usd !== null
                        ? fmtUSD(row.usd)
                        : "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #1a1a1a",
                        textAlign: "right",
                        color: `${row.color}99`,
                        fontWeight: row.bold ? 700 : 400,
                        fontSize: 12,
                      }}
                    >
                      {row.special
                        ? ""
                        : row.usd !== null
                        ? fmtARS(toARS(row.usd))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nota legal */}
        <div
          style={{
            background: "#111",
            border: "1px solid #222",
            borderRadius: 10,
            padding: "14px 20px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "#555",
              fontStyle: "italic",
              lineHeight: 1.6,
            }}
          >
            Esta calculadora tiene caracter meramente orientativo y no
            constituye asesoramiento fiscal, legal ni contable. Los resultados
            son estimaciones basadas en los datos ingresados y la normativa
            vigente al momento del calculo (Ley 27.430, Ley 23.905, RG AFIP
            2371). Las tasas, coeficientes de actualizacion y umbrales del COTI
            pueden variar por disposiciones de AFIP o el Banco Central. Se
            recomienda consultar con un contador publico matriculado antes de
            tomar decisiones impositivas.
          </p>
        </div>
      </div>
    </div>
  );
}
