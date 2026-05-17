"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Municipio = "caba" | "rosario" | "cordoba" | "mendoza" | "lp" | "mdp" | "tucuman";
type TipoPropiedad = "urbano" | "rural" | "baldio";
type ZonaUrbanistica = "central" | "media" | "periferica";

interface DatosMunicipio {
  nombre: string;
  impuestoInmobiliario: number; // % anual sobre valuación fiscal
  abl: number;
  tasaHigiene: number;
  tasaSeguridad: number;
}

const MUNICIPIOS: Record<Municipio, DatosMunicipio> = {
  caba:    { nombre: "CABA",          impuestoInmobiliario: 1.20, abl: 0.60, tasaHigiene: 0.0,  tasaSeguridad: 0.0  },
  rosario: { nombre: "Rosario",       impuestoInmobiliario: 1.50, abl: 0.45, tasaHigiene: 0.0,  tasaSeguridad: 0.0  },
  cordoba: { nombre: "Córdoba",       impuestoInmobiliario: 1.30, abl: 0.50, tasaHigiene: 0.10, tasaSeguridad: 0.05 },
  mendoza: { nombre: "Mendoza",       impuestoInmobiliario: 1.10, abl: 0.40, tasaHigiene: 0.0,  tasaSeguridad: 0.0  },
  lp:      { nombre: "La Plata",      impuestoInmobiliario: 1.40, abl: 0.55, tasaHigiene: 0.05, tasaSeguridad: 0.0  },
  mdp:     { nombre: "Mar del Plata", impuestoInmobiliario: 1.35, abl: 0.50, tasaHigiene: 0.0,  tasaSeguridad: 0.05 },
  tucuman: { nombre: "Tucumán",       impuestoInmobiliario: 1.20, abl: 0.40, tasaHigiene: 0.10, tasaSeguridad: 0.05 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  return `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtN(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Estilos compartidos ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 6,
  color: "#fff",
  fontFamily: "Inter,sans-serif",
  fontSize: 14,
  padding: "8px 12px",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "Montserrat,sans-serif",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "rgba(255,255,255,0.4)",
  marginBottom: 5,
  display: "block",
};

const cardStyle: React.CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 10,
  padding: "20px 22px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "Montserrat,sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "rgba(255,255,255,0.35)",
  margin: "0 0 16px",
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function CalculadoraABL() {
  // ── Tab activo
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // ── Inputs principales
  const [municipio, setMunicipio] = useState<Municipio>("rosario");
  const [valuacionFiscalStr, setValuacionFiscalStr] = useState<string>("5000000");
  const [tipoPropiedad, setTipoPropiedad] = useState<TipoPropiedad>("urbano");
  const [superficieM2Str, setSuperficieM2Str] = useState<string>("80");
  const [zonaUrbanistica, setZonaUrbanistica] = useState<ZonaUrbanistica>("media");
  const [anio, setAnio] = useState<2024 | 2025>(2024);
  const [inflacionEstimadaPctStr, setInflacionEstimadaPctStr] = useState<string>("80");
  const [mesesProyeccionStr, setMesesProyeccionStr] = useState<string>("12");
  const [pagaCuotas, setPagaCuotas] = useState<boolean>(true);

  // ── Coeficientes manuales
  const [coefZonaStr, setCoefZonaStr] = useState<string>("1.0");
  const [coefTipoStr, setCoefTipoStr] = useState<string>("1.0");
  const [descuentoPagoContadoStr, setDescuentoPagoContadoStr] = useState<string>("10");

  // ── Cálculos principales ──────────────────────────────────────────────────

  const calc = useMemo(() => {
    const valuacionFiscal = parseFloat(valuacionFiscalStr) || 0;
    const coefZona = parseFloat(coefZonaStr) || 1;
    const coefTipo = parseFloat(coefTipoStr) || 1;
    const descuentoPagoContado = parseFloat(descuentoPagoContadoStr) || 0;
    const inflacionEstimadaPct = parseFloat(inflacionEstimadaPctStr) || 0;
    const mesesProyeccion = Math.min(Math.max(parseInt(mesesProyeccionStr) || 12, 1), 60);

    const m = MUNICIPIOS[municipio];

    const tasaImponible = valuacionFiscal * coefZona * coefTipo;

    const impInmobiliarioAnual = tasaImponible * m.impuestoInmobiliario / 100;
    const ablAnual = tasaImponible * m.abl / 100;
    const tasaHigieneAnual = tasaImponible * m.tasaHigiene / 100;
    const tasaSeguridadAnual = tasaImponible * m.tasaSeguridad / 100;

    const totalAnual =
      impInmobiliarioAnual + ablAnual + tasaHigieneAnual + tasaSeguridadAnual;

    const descuento = pagaCuotas ? 0 : totalAnual * descuentoPagoContado / 100;
    const totalConDescuento = totalAnual - descuento;
    const cuotaMensual = totalConDescuento / 12;

    // Proyección mensual con inflación compuesta
    const proyeccion: Array<{ mes: number; cuota: number; acumulado: number }> = [];
    let acumulado = 0;
    for (let mes = 1; mes <= mesesProyeccion; mes++) {
      const cuota = totalConDescuento * Math.pow(1 + inflacionEstimadaPct / 100, mes / 12) / 12;
      acumulado += cuota;
      proyeccion.push({ mes, cuota, acumulado });
    }

    // Comparativa todos los municipios (misma valuación fiscal y coeficientes)
    const comparativa = (Object.keys(MUNICIPIOS) as Municipio[]).map((mkey) => {
      const md = MUNICIPIOS[mkey];
      const ti = tasaImponible;
      const totalA =
        ti * md.impuestoInmobiliario / 100 +
        ti * md.abl / 100 +
        ti * md.tasaHigiene / 100 +
        ti * md.tasaSeguridad / 100;
      const desc = pagaCuotas ? 0 : totalA * descuentoPagoContado / 100;
      const totalCD = totalA - desc;
      return {
        mkey,
        nombre: md.nombre,
        impInmobiliario: ti * md.impuestoInmobiliario / 100,
        abl: ti * md.abl / 100,
        tasaHigiene: ti * md.tasaHigiene / 100,
        tasaSeguridad: ti * md.tasaSeguridad / 100,
        totalAnual: totalA,
        totalConDescuento: totalCD,
        cuotaMensual: totalCD / 12,
      };
    }).sort((a, b) => a.totalAnual - b.totalAnual);

    return {
      tasaImponible,
      impInmobiliarioAnual,
      ablAnual,
      tasaHigieneAnual,
      tasaSeguridadAnual,
      totalAnual,
      descuento,
      totalConDescuento,
      cuotaMensual,
      proyeccion,
      mesesProyeccion,
      comparativa,
      maxComparativa: Math.max(...(Object.keys(MUNICIPIOS) as Municipio[]).map(mkey => {
        const md = MUNICIPIOS[mkey];
        const ti = tasaImponible;
        return ti * (md.impuestoInmobiliario + md.abl + md.tasaHigiene + md.tasaSeguridad) / 100;
      }), 1),
    };
  }, [
    municipio,
    valuacionFiscalStr,
    coefZonaStr,
    coefTipoStr,
    descuentoPagoContadoStr,
    inflacionEstimadaPctStr,
    mesesProyeccionStr,
    pagaCuotas,
  ]);

  // ── PDF Export ────────────────────────────────────────────────────────────

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;

    const m = MUNICIPIOS[municipio];
    const c = calc;

    const filasProyeccion = c.proyeccion
      .map(
        (p) =>
          `<tr>
            <td>${MESES_ES[(p.mes - 1) % 12]}</td>
            <td style="text-align:right">$ ${fmtN(p.cuota)}</td>
            <td style="text-align:right">$ ${fmtN(p.acumulado)}</td>
          </tr>`
      )
      .join("");

    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>ABL Municipal — ${m.nombre} ${anio}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px;max-width:860px;margin:auto}
        h1{font-size:20px;margin-bottom:4px}
        h2{font-size:13px;margin-top:22px;border-bottom:2px solid #cc0000;padding-bottom:4px;color:#cc0000}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        td,th{padding:7px 10px;border-bottom:1px solid #eee;text-align:left}
        th{background:#f5f5f5;font-weight:bold}
        .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
        .kpi{background:#f5f5f5;border-radius:6px;padding:12px 14px}
        .kpi-val{font-size:18px;font-weight:bold;color:#cc0000}
        .kpi-lbl{font-size:9px;text-transform:uppercase;color:#888;margin-top:3px}
        .disc{background:#fffbec;border-left:4px solid #e5a000;padding:10px 14px;margin-top:24px;font-size:10px;color:#555}
      </style>
    </head><body>
      <h1>ABL Municipal — ${m.nombre}</h1>
      <p style="color:#888">Ejercicio ${anio} · Valuación fiscal: ${fmtARS(parseFloat(valuacionFiscalStr) || 0)}</p>
      <div class="kpis">
        <div class="kpi"><div class="kpi-val">${fmtARS(c.impInmobiliarioAnual)}</div><div class="kpi-lbl">Imp. Inmobiliario Anual</div></div>
        <div class="kpi"><div class="kpi-val">${fmtARS(c.ablAnual)}</div><div class="kpi-lbl">ABL Anual</div></div>
        <div class="kpi"><div class="kpi-val">${fmtARS(c.totalConDescuento)}</div><div class="kpi-lbl">Total c/ Descuento</div></div>
        <div class="kpi"><div class="kpi-val">${fmtARS(c.cuotaMensual)}</div><div class="kpi-lbl">Cuota Mensual</div></div>
        <div class="kpi"><div class="kpi-val">${fmtARS(c.descuento)}</div><div class="kpi-lbl">Descuento Contado</div></div>
        <div class="kpi"><div class="kpi-val">${fmtARS(c.totalAnual)}</div><div class="kpi-lbl">Total Anual (s/desc.)</div></div>
      </div>
      <h2>Desglose</h2>
      <table>
        <thead><tr><th>Concepto</th><th>Tasa %</th><th>Anual ARS</th><th>Mensual ARS</th></tr></thead>
        <tbody>
          <tr><td>Impuesto Inmobiliario</td><td>${m.impuestoInmobiliario}%</td><td>${fmtARS(c.impInmobiliarioAnual)}</td><td>${fmtARS(c.impInmobiliarioAnual / 12)}</td></tr>
          <tr><td>ABL</td><td>${m.abl}%</td><td>${fmtARS(c.ablAnual)}</td><td>${fmtARS(c.ablAnual / 12)}</td></tr>
          ${m.tasaHigiene > 0 ? `<tr><td>Tasa de Higiene</td><td>${m.tasaHigiene}%</td><td>${fmtARS(c.tasaHigieneAnual)}</td><td>${fmtARS(c.tasaHigieneAnual / 12)}</td></tr>` : ""}
          ${m.tasaSeguridad > 0 ? `<tr><td>Tasa de Seguridad</td><td>${m.tasaSeguridad}%</td><td>${fmtARS(c.tasaSeguridadAnual)}</td><td>${fmtARS(c.tasaSeguridadAnual / 12)}</td></tr>` : ""}
          <tr style="font-weight:bold"><td>TOTAL</td><td>—</td><td>${fmtARS(c.totalAnual)}</td><td>${fmtARS(c.totalAnual / 12)}</td></tr>
        </tbody>
      </table>
      <h2>Proyección mensual</h2>
      <table>
        <thead><tr><th>Mes</th><th>Cuota proyectada</th><th>Acumulado</th></tr></thead>
        <tbody>${filasProyeccion}</tbody>
      </table>
      <div class="disc">
        <strong>Aviso:</strong> Las tasas son aproximadas y orientativas. Verificar con el municipio correspondiente.
        Las valuaciones fiscales son actualizadas periódicamente. Datos generados el ${new Date().toLocaleDateString("es-AR")}.
      </div>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const c = calc;
  const m = MUNICIPIOS[municipio];

  const kpis = [
    { label: "Imp. Inmobiliario", valor: fmtARS(c.impInmobiliarioAnual), sub: `${m.impuestoInmobiliario}% s/valuación`, color: "#cc0000" },
    { label: "ABL", valor: fmtARS(c.ablAnual), sub: `${m.abl}% s/valuación`, color: "#f59e0b" },
    { label: "Total Anual", valor: fmtARS(c.totalAnual), sub: "Sin descuento", color: "#3b82f6" },
    { label: "Cuota Mensual", valor: fmtARS(c.cuotaMensual), sub: pagaCuotas ? "Pago en cuotas" : "Pago contado", color: "#22c55e" },
    { label: "Con desc. contado", valor: fmtARS(c.totalConDescuento), sub: pagaCuotas ? "N/A (paga cuotas)" : `-${fmtARS(c.descuento)}`, color: "#a78bfa" },
  ];

  const desgloseRows = [
    { concepto: "Impuesto Inmobiliario", tasa: m.impuestoInmobiliario, anual: c.impInmobiliarioAnual },
    { concepto: "ABL (Alumbrado, Barrido y Limpieza)", tasa: m.abl, anual: c.ablAnual },
    ...(m.tasaHigiene > 0 ? [{ concepto: "Tasa de Higiene Urbana", tasa: m.tasaHigiene, anual: c.tasaHigieneAnual }] : []),
    ...(m.tasaSeguridad > 0 ? [{ concepto: "Tasa de Seguridad", tasa: m.tasaSeguridad, anual: c.tasaSeguridadAnual }] : []),
  ];

  // SVG line chart data
  const chartWidth = 560;
  const chartHeight = 180;
  const chartPadL = 80;
  const chartPadR = 16;
  const chartPadT = 16;
  const chartPadB = 36;
  const innerW = chartWidth - chartPadL - chartPadR;
  const innerH = chartHeight - chartPadT - chartPadB;

  const proyData = c.proyeccion;
  const maxCuota = Math.max(...proyData.map((p) => p.cuota), 1);
  const toX = (i: number) => chartPadL + (i / Math.max(proyData.length - 1, 1)) * innerW;
  const toY = (v: number) => chartPadT + innerH - (v / maxCuota) * innerH;

  const cuotaPath = proyData
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(p.cuota)}`)
    .join(" ");

  // Línea de inflación "base" para comparación: cuota mensual sin proyección
  const baseCuota = c.cuotaMensual;
  const basePath = proyData
    .map((_, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(baseCuota)}`)
    .join(" ");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "Inter,sans-serif",
        paddingBottom: 48,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/calculadoras"
          style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 12 }}
        >
          ← Calculadoras
        </Link>
        <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 14 }}>|</span>
        <h1
          style={{
            fontFamily: "Montserrat,sans-serif",
            fontSize: 18,
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          ABL Municipal e Impuesto Inmobiliario
        </h1>
        <span
          style={{
            background: "#cc0000",
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "Montserrat,sans-serif",
            padding: "2px 8px",
            borderRadius: 4,
            letterSpacing: "0.1em",
          }}
        >
          ABL
        </span>
      </div>

      <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "320px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* ── Panel izquierdo — inputs ────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Municipio */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Municipio</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(Object.keys(MUNICIPIOS) as Municipio[]).map((mkey) => (
                  <button
                    key={mkey}
                    onClick={() => setMunicipio(mkey)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border:
                        municipio === mkey
                          ? "1px solid #cc0000"
                          : "1px solid rgba(255,255,255,0.10)",
                      background:
                        municipio === mkey ? "rgba(204,0,0,0.10)" : "rgba(255,255,255,0.02)",
                      color: municipio === mkey ? "#cc0000" : "rgba(255,255,255,0.6)",
                      fontFamily: "Montserrat,sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{MUNICIPIOS[mkey].nombre}</span>
                    <span
                      style={{
                        fontSize: 10,
                        color: municipio === mkey ? "rgba(204,0,0,0.7)" : "rgba(255,255,255,0.25)",
                        fontWeight: 400,
                      }}
                    >
                      {(
                        MUNICIPIOS[mkey].impuestoInmobiliario +
                        MUNICIPIOS[mkey].abl +
                        MUNICIPIOS[mkey].tasaHigiene +
                        MUNICIPIOS[mkey].tasaSeguridad
                      ).toFixed(2)}
                      % anual
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Datos propiedad */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Propiedad</h3>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Valuación Fiscal (ARS)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={valuacionFiscalStr}
                  onChange={(e) => setValuacionFiscalStr(e.target.value)}
                  min={0}
                />
                <div
                  style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}
                >
                  Base imponible ajustada: {fmtARS(c.tasaImponible)}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Superficie (m²)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={superficieM2Str}
                  onChange={(e) => setSuperficieM2Str(e.target.value)}
                  min={0}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Tipo de Propiedad</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["urbano", "rural", "baldio"] as TipoPropiedad[]).map((tp) => (
                    <button
                      key={tp}
                      onClick={() => setTipoPropiedad(tp)}
                      style={{
                        flex: 1,
                        padding: "7px 4px",
                        borderRadius: 6,
                        border:
                          tipoPropiedad === tp
                            ? "1px solid #cc0000"
                            : "1px solid rgba(255,255,255,0.10)",
                        background:
                          tipoPropiedad === tp ? "rgba(204,0,0,0.10)" : "rgba(255,255,255,0.02)",
                        color:
                          tipoPropiedad === tp ? "#cc0000" : "rgba(255,255,255,0.5)",
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {tp === "baldio" ? "Baldío" : tp.charAt(0).toUpperCase() + tp.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Zona Urbanística</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["central", "media", "periferica"] as ZonaUrbanistica[]).map((zu) => (
                    <button
                      key={zu}
                      onClick={() => setZonaUrbanistica(zu)}
                      style={{
                        flex: 1,
                        padding: "7px 4px",
                        borderRadius: 6,
                        border:
                          zonaUrbanistica === zu
                            ? "1px solid #cc0000"
                            : "1px solid rgba(255,255,255,0.10)",
                        background:
                          zonaUrbanistica === zu
                            ? "rgba(204,0,0,0.10)"
                            : "rgba(255,255,255,0.02)",
                        color:
                          zonaUrbanistica === zu ? "#cc0000" : "rgba(255,255,255,0.5)",
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {zu === "periferica" ? "Periférica" : zu.charAt(0).toUpperCase() + zu.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 0 }}>
                <label style={labelStyle}>Ejercicio</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {([2024, 2025] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAnio(a)}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        borderRadius: 6,
                        border:
                          anio === a
                            ? "1px solid #cc0000"
                            : "1px solid rgba(255,255,255,0.10)",
                        background: anio === a ? "rgba(204,0,0,0.10)" : "rgba(255,255,255,0.02)",
                        color: anio === a ? "#cc0000" : "rgba(255,255,255,0.5)",
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Parámetros de cálculo */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Parámetros</h3>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Coef. de Zona (multiplicador)</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.05"
                  value={coefZonaStr}
                  onChange={(e) => setCoefZonaStr(e.target.value)}
                  min={0.1}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Coef. de Tipo Propiedad</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.05"
                  value={coefTipoStr}
                  onChange={(e) => setCoefTipoStr(e.target.value)}
                  min={0.1}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Descuento pago contado (%)</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="1"
                  value={descuentoPagoContadoStr}
                  onChange={(e) => setDescuentoPagoContadoStr(e.target.value)}
                  min={0}
                  max={100}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Inflación estimada (% anual)</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="5"
                  value={inflacionEstimadaPctStr}
                  onChange={(e) => setInflacionEstimadaPctStr(e.target.value)}
                  min={0}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Meses de proyección</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="1"
                  value={mesesProyeccionStr}
                  onChange={(e) => setMesesProyeccionStr(e.target.value)}
                  min={1}
                  max={60}
                />
              </div>

              {/* Modalidad de pago */}
              <div>
                <label style={labelStyle}>Modalidad de pago</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setPagaCuotas(true)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 6,
                      border: pagaCuotas
                        ? "1px solid #cc0000"
                        : "1px solid rgba(255,255,255,0.10)",
                      background: pagaCuotas
                        ? "rgba(204,0,0,0.10)"
                        : "rgba(255,255,255,0.02)",
                      color: pagaCuotas ? "#cc0000" : "rgba(255,255,255,0.5)",
                      fontFamily: "Montserrat,sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cuotas
                  </button>
                  <button
                    onClick={() => setPagaCuotas(false)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 6,
                      border: !pagaCuotas
                        ? "1px solid #cc0000"
                        : "1px solid rgba(255,255,255,0.10)",
                      background: !pagaCuotas
                        ? "rgba(204,0,0,0.10)"
                        : "rgba(255,255,255,0.02)",
                      color: !pagaCuotas ? "#cc0000" : "rgba(255,255,255,0.5)",
                      fontFamily: "Montserrat,sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Contado
                  </button>
                </div>
                {!pagaCuotas && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 10,
                      color: "#22c55e",
                      background: "rgba(34,197,94,0.07)",
                      border: "1px solid rgba(34,197,94,0.15)",
                      borderRadius: 5,
                      padding: "5px 10px",
                    }}
                  >
                    Ahorro contado: {fmtARS(c.descuento)}
                  </div>
                )}
              </div>
            </div>

            {/* Disclaimer */}
            <div
              style={{
                background: "#0d0d0d",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "Montserrat,sans-serif",
                  fontWeight: 700,
                  color: "#f59e0b",
                  letterSpacing: "0.1em",
                  marginBottom: 4,
                }}
              >
                AVISO IMPORTANTE
              </div>
              <div
                style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}
              >
                Las tasas son aproximadas y orientativas. Verificar con el municipio correspondiente.
                Las valuaciones fiscales son actualizadas periódicamente.
              </div>
            </div>
          </div>

          {/* ── Panel derecho — resultados ──────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* ── Tabs ─────────────────────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                gap: 4,
                background: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8,
                padding: 4,
              }}
            >
              {(["Resumen", "Proyección 12 meses", "Comparar Municipios"] as const).map(
                (label, i) => (
                  <button
                    key={label}
                    onClick={() => setTab(i as 0 | 1 | 2)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: tab === i ? "#cc0000" : "transparent",
                      color: tab === i ? "#fff" : "rgba(255,255,255,0.45)",
                      fontFamily: "Montserrat,sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      letterSpacing: "0.04em",
                      transition: "background 0.2s",
                    }}
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            {/* ── TAB 0: RESUMEN ────────────────────────────────────────────── */}
            {tab === 0 && (
              <>
                {/* KPI Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5,1fr)",
                    gap: 10,
                  }}
                >
                  {kpis.map((k, i) => (
                    <div
                      key={i}
                      style={{
                        ...cardStyle,
                        textAlign: "center",
                        padding: "16px 12px",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Montserrat,sans-serif",
                          fontSize: 15,
                          fontWeight: 800,
                          color: k.color,
                          lineHeight: 1.2,
                          wordBreak: "break-word",
                        }}
                      >
                        {k.valor}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          fontFamily: "Montserrat,sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.3)",
                          marginTop: 6,
                        }}
                      >
                        {k.label}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: "rgba(255,255,255,0.25)",
                          marginTop: 3,
                        }}
                      >
                        {k.sub}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabla desglose */}
                <div style={cardStyle}>
                  <h3 style={sectionTitleStyle}>Desglose de tasas — {m.nombre}</h3>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                      fontFamily: "Inter,sans-serif",
                    }}
                  >
                    <thead>
                      <tr>
                        {["Concepto", "Tasa % anual", "Anual ARS", "Mensual ARS"].map(
                          (col) => (
                            <th
                              key={col}
                              style={{
                                textAlign: col === "Concepto" ? "left" : "right",
                                padding: "8px 10px",
                                borderBottom: "1px solid rgba(255,255,255,0.08)",
                                fontFamily: "Montserrat,sans-serif",
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                color: "rgba(255,255,255,0.35)",
                                textTransform: "uppercase",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {desgloseRows.map((row, i) => {
                        const pctWidth =
                          c.totalAnual > 0
                            ? Math.max(2, (row.anual / c.totalAnual) * 100)
                            : 0;
                        return (
                          <tr
                            key={i}
                            style={{
                              position: "relative",
                            }}
                          >
                            <td
                              style={{
                                padding: "11px 10px",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                color: "rgba(255,255,255,0.8)",
                                position: "relative",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: `${pctWidth}%`,
                                  background: "rgba(204,0,0,0.06)",
                                  borderRadius: "0 4px 4px 0",
                                  transition: "width 0.3s",
                                }}
                              />
                              <span style={{ position: "relative" }}>{row.concepto}</span>
                            </td>
                            <td
                              style={{
                                padding: "11px 10px",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                textAlign: "right",
                                fontFamily: "Montserrat,sans-serif",
                                fontSize: 11,
                                color: "rgba(255,255,255,0.45)",
                              }}
                            >
                              {row.tasa}%
                            </td>
                            <td
                              style={{
                                padding: "11px 10px",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                textAlign: "right",
                                fontFamily: "Montserrat,sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                                color: "#fff",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtARS(row.anual)}
                            </td>
                            <td
                              style={{
                                padding: "11px 10px",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                textAlign: "right",
                                fontSize: 12,
                                color: "rgba(255,255,255,0.55)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtARS(row.anual / 12)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Subtotal */}
                      <tr>
                        <td
                          colSpan={2}
                          style={{
                            padding: "12px 10px",
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.4)",
                            textTransform: "uppercase",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          Total anual (s/descuento)
                        </td>
                        <td
                          style={{
                            padding: "12px 10px",
                            textAlign: "right",
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 15,
                            fontWeight: 800,
                            color: "#3b82f6",
                            whiteSpace: "nowrap",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {fmtARS(c.totalAnual)}
                        </td>
                        <td
                          style={{
                            padding: "12px 10px",
                            textAlign: "right",
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#3b82f6",
                            whiteSpace: "nowrap",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {fmtARS(c.totalAnual / 12)}
                        </td>
                      </tr>

                      {/* Descuento contado */}
                      {!pagaCuotas && c.descuento > 0 && (
                        <tr>
                          <td
                            colSpan={2}
                            style={{
                              padding: "10px 10px",
                              fontFamily: "Montserrat,sans-serif",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#22c55e",
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            Descuento pago contado ({parseFloat(descuentoPagoContadoStr) || 0}%)
                          </td>
                          <td
                            style={{
                              padding: "10px 10px",
                              textAlign: "right",
                              fontFamily: "Montserrat,sans-serif",
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#22c55e",
                              whiteSpace: "nowrap",
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            -{fmtARS(c.descuento)}
                          </td>
                          <td
                            style={{
                              padding: "10px 10px",
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                          />
                        </tr>
                      )}

                      {/* Total con descuento */}
                      <tr>
                        <td
                          colSpan={2}
                          style={{
                            padding: "14px 10px",
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#fff",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Total a pagar
                        </td>
                        <td
                          style={{
                            padding: "14px 10px",
                            textAlign: "right",
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 18,
                            fontWeight: 800,
                            color: "#cc0000",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmtARS(c.totalConDescuento)}
                        </td>
                        <td
                          style={{
                            padding: "14px 10px",
                            textAlign: "right",
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#cc0000",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmtARS(c.cuotaMensual)}/mes
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Badge informativo */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      background: "rgba(245,158,11,0.12)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 9,
                      fontFamily: "Montserrat,sans-serif",
                      fontWeight: 700,
                      color: "#f59e0b",
                      letterSpacing: "0.08em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ORIENTATIVO
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    Datos orientativos. Verificar en municipio. Tasas sujetas a actualización anual.
                  </span>
                </div>
              </>
            )}

            {/* ── TAB 1: PROYECCIÓN ────────────────────────────────────────── */}
            {tab === 1 && (
              <>
                {/* SVG Chart */}
                <div style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <h3 style={{ ...sectionTitleStyle, margin: 0 }}>
                      Cuota mensual proyectada ({parseFloat(inflacionEstimadaPctStr) || 0}% inflación anual)
                    </h3>
                    <div style={{ display: "flex", gap: 16, fontSize: 10 }}>
                      <span style={{ color: "#cc0000", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 20, height: 2, background: "#cc0000", display: "inline-block" }} />
                        Cuota proyectada
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 20, height: 2, background: "rgba(255,255,255,0.3)", display: "inline-block", borderBottom: "1px dashed rgba(255,255,255,0.3)" }} />
                        Sin inflación
                      </span>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <svg
                      width={chartWidth}
                      height={chartHeight}
                      style={{ display: "block", minWidth: chartWidth }}
                    >
                      {/* Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                        const y = chartPadT + innerH * (1 - pct);
                        return (
                          <g key={i}>
                            <line
                              x1={chartPadL}
                              y1={y}
                              x2={chartWidth - chartPadR}
                              y2={y}
                              stroke="rgba(255,255,255,0.05)"
                              strokeWidth={1}
                            />
                            <text
                              x={chartPadL - 6}
                              y={y + 4}
                              textAnchor="end"
                              fill="rgba(255,255,255,0.3)"
                              fontSize={9}
                              fontFamily="Inter,sans-serif"
                            >
                              {fmtARS(maxCuota * pct)}
                            </text>
                          </g>
                        );
                      })}

                      {/* X axis labels */}
                      {proyData.map((p, i) => {
                        if (proyData.length <= 12 || i % Math.ceil(proyData.length / 12) === 0) {
                          return (
                            <text
                              key={i}
                              x={toX(i)}
                              y={chartHeight - chartPadB + 16}
                              textAnchor="middle"
                              fill="rgba(255,255,255,0.3)"
                              fontSize={9}
                              fontFamily="Inter,sans-serif"
                            >
                              {MESES_ES[(p.mes - 1) % 12].slice(0, 3)}
                            </text>
                          );
                        }
                        return null;
                      })}

                      {/* Base line (sin inflación) */}
                      {proyData.length > 1 && (
                        <path
                          d={basePath}
                          fill="none"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth={1}
                          strokeDasharray="4,3"
                        />
                      )}

                      {/* Cuota proyectada line */}
                      {proyData.length > 1 && (
                        <>
                          <path
                            d={cuotaPath}
                            fill="none"
                            stroke="#cc0000"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Area fill */}
                          <path
                            d={`${cuotaPath} L${toX(proyData.length - 1)},${chartPadT + innerH} L${toX(0)},${chartPadT + innerH} Z`}
                            fill="rgba(204,0,0,0.06)"
                          />
                        </>
                      )}

                      {/* Dots */}
                      {proyData.map((p, i) => (
                        <circle
                          key={i}
                          cx={toX(i)}
                          cy={toY(p.cuota)}
                          r={3}
                          fill="#cc0000"
                          opacity={0.85}
                        />
                      ))}
                    </svg>
                  </div>
                </div>

                {/* Tabla proyección */}
                <div style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <h3 style={{ ...sectionTitleStyle, margin: 0 }}>
                      Proyección mensual
                    </h3>
                    <div
                      style={{
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 11,
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      Total acumulado:{" "}
                      <span style={{ color: "#cc0000", fontWeight: 700 }}>
                        {fmtARS(c.proyeccion[c.proyeccion.length - 1]?.acumulado ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                        fontFamily: "Inter,sans-serif",
                      }}
                    >
                      <thead>
                        <tr>
                          {["#", "Mes", "Cuota proyectada", "Variación", "Acumulado"].map(
                            (col) => (
                              <th
                                key={col}
                                style={{
                                  textAlign: col === "Mes" || col === "#" ? "left" : "right",
                                  padding: "8px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                                  fontFamily: "Montserrat,sans-serif",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  color: "rgba(255,255,255,0.35)",
                                  textTransform: "uppercase",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {col}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {c.proyeccion.map((p, i) => {
                          const variacion =
                            i === 0
                              ? 0
                              : ((p.cuota - c.proyeccion[i - 1].cuota) /
                                  c.proyeccion[i - 1].cuota) *
                                100;
                          return (
                            <tr key={i}>
                              <td
                                style={{
                                  padding: "9px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  color: "rgba(255,255,255,0.3)",
                                  fontSize: 11,
                                }}
                              >
                                {p.mes}
                              </td>
                              <td
                                style={{
                                  padding: "9px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  color: "rgba(255,255,255,0.7)",
                                }}
                              >
                                {MESES_ES[(p.mes - 1) % 12]}
                              </td>
                              <td
                                style={{
                                  padding: "9px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  textAlign: "right",
                                  fontFamily: "Montserrat,sans-serif",
                                  fontWeight: 700,
                                  color: "#cc0000",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {fmtARS(p.cuota)}
                              </td>
                              <td
                                style={{
                                  padding: "9px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  textAlign: "right",
                                  fontSize: 11,
                                  color:
                                    i === 0
                                      ? "rgba(255,255,255,0.2)"
                                      : "rgba(255,255,255,0.5)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {i === 0 ? "—" : `+${fmtN(variacion, 1)}%`}
                              </td>
                              <td
                                style={{
                                  padding: "9px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  textAlign: "right",
                                  color: "rgba(255,255,255,0.55)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {fmtARS(p.acumulado)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Botón PDF */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={exportarPDF}
                    style={{
                      background: "#cc0000",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "10px 24px",
                      fontFamily: "Montserrat,sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Exportar PDF
                  </button>
                </div>
              </>
            )}

            {/* ── TAB 2: COMPARAR MUNICIPIOS ────────────────────────────────── */}
            {tab === 2 && (
              <>
                <div style={cardStyle}>
                  <h3 style={sectionTitleStyle}>
                    Comparativa de municipios — valuación fiscal {fmtARS(parseFloat(valuacionFiscalStr) || 0)}
                  </h3>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                        fontFamily: "Inter,sans-serif",
                      }}
                    >
                      <thead>
                        <tr>
                          {["Municipio", "Imp. Inmobiliario", "ABL", "Higiene", "Seguridad", "Total Anual", "Cuota Mensual"].map(
                            (col, ci) => (
                              <th
                                key={col}
                                style={{
                                  textAlign: ci === 0 ? "left" : "right",
                                  padding: "8px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                                  fontFamily: "Montserrat,sans-serif",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  color: "rgba(255,255,255,0.35)",
                                  textTransform: "uppercase",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {col}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {c.comparativa.map((row, i) => {
                          const isSelected = row.mkey === municipio;
                          return (
                            <tr
                              key={row.mkey}
                              onClick={() => setMunicipio(row.mkey as Municipio)}
                              style={{
                                cursor: "pointer",
                                background: isSelected
                                  ? "rgba(204,0,0,0.07)"
                                  : i % 2 === 0
                                  ? "transparent"
                                  : "rgba(255,255,255,0.01)",
                              }}
                            >
                              <td
                                style={{
                                  padding: "11px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  borderLeft: isSelected
                                    ? "3px solid #cc0000"
                                    : "3px solid transparent",
                                  color: isSelected ? "#fff" : "rgba(255,255,255,0.7)",
                                  fontWeight: isSelected ? 700 : 400,
                                  fontFamily: isSelected ? "Montserrat,sans-serif" : "Inter,sans-serif",
                                }}
                              >
                                {row.nombre}
                                {isSelected && (
                                  <span
                                    style={{
                                      marginLeft: 8,
                                      background: "#cc0000",
                                      color: "#fff",
                                      fontSize: 8,
                                      fontFamily: "Montserrat,sans-serif",
                                      fontWeight: 700,
                                      padding: "1px 5px",
                                      borderRadius: 3,
                                      letterSpacing: "0.08em",
                                    }}
                                  >
                                    SEL.
                                  </span>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: "11px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  textAlign: "right",
                                  color: "rgba(255,255,255,0.6)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {fmtARS(row.impInmobiliario)}
                              </td>
                              <td
                                style={{
                                  padding: "11px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  textAlign: "right",
                                  color: "rgba(255,255,255,0.6)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {fmtARS(row.abl)}
                              </td>
                              <td
                                style={{
                                  padding: "11px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  textAlign: "right",
                                  color:
                                    row.tasaHigiene > 0
                                      ? "rgba(255,255,255,0.6)"
                                      : "rgba(255,255,255,0.2)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {row.tasaHigiene > 0 ? fmtARS(row.tasaHigiene) : "—"}
                              </td>
                              <td
                                style={{
                                  padding: "11px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  textAlign: "right",
                                  color:
                                    row.tasaSeguridad > 0
                                      ? "rgba(255,255,255,0.6)"
                                      : "rgba(255,255,255,0.2)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {row.tasaSeguridad > 0 ? fmtARS(row.tasaSeguridad) : "—"}
                              </td>
                              <td
                                style={{
                                  padding: "11px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  textAlign: "right",
                                  fontFamily: "Montserrat,sans-serif",
                                  fontWeight: 800,
                                  fontSize: 13,
                                  color: isSelected ? "#cc0000" : "#fff",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {fmtARS(row.totalAnual)}
                              </td>
                              <td
                                style={{
                                  padding: "11px 10px",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  textAlign: "right",
                                  color: isSelected ? "#cc0000" : "rgba(255,255,255,0.55)",
                                  fontWeight: isSelected ? 700 : 400,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {fmtARS(row.cuotaMensual)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Barras horizontales */}
                <div style={cardStyle}>
                  <h3 style={sectionTitleStyle}>Total anual — visualización comparativa</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {c.comparativa.map((row) => {
                      const isSelected = row.mkey === municipio;
                      const pct =
                        c.maxComparativa > 0
                          ? (row.totalAnual / c.maxComparativa) * 100
                          : 0;
                      return (
                        <div
                          key={row.mkey}
                          onClick={() => setMunicipio(row.mkey as Municipio)}
                          style={{ cursor: "pointer" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: isSelected ? "#fff" : "rgba(255,255,255,0.55)",
                                fontWeight: isSelected ? 700 : 400,
                                fontFamily: isSelected
                                  ? "Montserrat,sans-serif"
                                  : "Inter,sans-serif",
                              }}
                            >
                              {row.nombre}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontFamily: "Montserrat,sans-serif",
                                fontWeight: 700,
                                color: isSelected ? "#cc0000" : "rgba(255,255,255,0.5)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtARS(row.totalAnual)}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 10,
                              background: "rgba(255,255,255,0.05)",
                              borderRadius: 5,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: isSelected
                                  ? "#cc0000"
                                  : "rgba(255,255,255,0.18)",
                                borderRadius: 5,
                                transition: "width 0.35s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Disclaimer comparativa */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.35)",
                      lineHeight: 1.6,
                    }}
                  >
                    Las tasas son aproximadas y orientativas. Verificar con el municipio correspondiente.
                    Las valuaciones fiscales son actualizadas periódicamente por cada jurisdicción.
                    Hacé clic en una fila para seleccionar el municipio.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
