"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Anio = "2023" | "2024" | "2025";

interface InmuebleIBP {
  id: string;
  descripcion: string;
  valorMercado: number;   // USD
  valuacionFiscal: number; // ARS
  esExterior: boolean;
}

interface EscalaTramo {
  desde: number;
  hasta: number;
  alicuota: number; // porcentaje (ej: 0.50 = 0.50%)
}

// ── Parámetros fiscales por año ───────────────────────────────────────────────

interface ParamsFiscales {
  mni: number;               // Mínimo no imponible ARS
  exencionCasaHab: number;   // Exención casa-habitación ARS
  escalasArg: EscalaTramo[];
  escalasExt: EscalaTramo[];
  label: string;
}

const PARAMS: Record<Anio, ParamsFiscales> = {
  "2023": {
    label: "2023",
    mni: 27_377_850,
    exencionCasaHab: 95_822_475,
    escalasArg: [
      { desde: 0,           hasta: 3_000_000,   alicuota: 0.50 },
      { desde: 3_000_000,   hasta: 6_500_000,   alicuota: 0.75 },
      { desde: 6_500_000,   hasta: 18_000_000,  alicuota: 1.00 },
      { desde: 18_000_000,  hasta: 100_000_000, alicuota: 1.25 },
      { desde: 100_000_000, hasta: 300_000_000, alicuota: 1.50 },
      { desde: 300_000_000, hasta: Infinity,    alicuota: 1.75 },
    ],
    escalasExt: [
      { desde: 0,           hasta: 3_000_000,   alicuota: 0.70 },
      { desde: 3_000_000,   hasta: 6_500_000,   alicuota: 1.20 },
      { desde: 6_500_000,   hasta: 18_000_000,  alicuota: 1.80 },
      { desde: 18_000_000,  hasta: 100_000_000, alicuota: 2.25 },
      { desde: 100_000_000, hasta: 300_000_000, alicuota: 2.75 },
      { desde: 300_000_000, hasta: Infinity,    alicuota: 3.50 },
    ],
  },
  "2024": {
    label: "2024",
    mni: 100_000_000,
    exencionCasaHab: 350_000_000,
    escalasArg: [
      { desde: 0,           hasta: 8_000_000,   alicuota: 0.50 },
      { desde: 8_000_000,   hasta: 25_000_000,  alicuota: 0.75 },
      { desde: 25_000_000,  hasta: 50_000_000,  alicuota: 1.00 },
      { desde: 50_000_000,  hasta: 100_000_000, alicuota: 1.25 },
      { desde: 100_000_000, hasta: 200_000_000, alicuota: 1.50 },
      { desde: 200_000_000, hasta: Infinity,    alicuota: 1.75 },
    ],
    escalasExt: [
      { desde: 0,           hasta: 8_000_000,   alicuota: 0.70 },
      { desde: 8_000_000,   hasta: 25_000_000,  alicuota: 1.20 },
      { desde: 25_000_000,  hasta: 50_000_000,  alicuota: 1.80 },
      { desde: 50_000_000,  hasta: 100_000_000, alicuota: 2.25 },
      { desde: 100_000_000, hasta: 200_000_000, alicuota: 2.75 },
      { desde: 200_000_000, hasta: Infinity,    alicuota: 3.50 },
    ],
  },
  "2025": {
    label: "2025",
    mni: 150_000_000,
    exencionCasaHab: 525_000_000,
    escalasArg: [
      { desde: 0,           hasta: 12_000_000,  alicuota: 0.50 },
      { desde: 12_000_000,  hasta: 37_500_000,  alicuota: 0.75 },
      { desde: 37_500_000,  hasta: 75_000_000,  alicuota: 1.00 },
      { desde: 75_000_000,  hasta: 150_000_000, alicuota: 1.25 },
      { desde: 150_000_000, hasta: 300_000_000, alicuota: 1.50 },
      { desde: 300_000_000, hasta: Infinity,    alicuota: 1.75 },
    ],
    escalasExt: [
      { desde: 0,           hasta: 12_000_000,  alicuota: 0.70 },
      { desde: 12_000_000,  hasta: 37_500_000,  alicuota: 1.20 },
      { desde: 37_500_000,  hasta: 75_000_000,  alicuota: 1.80 },
      { desde: 75_000_000,  hasta: 150_000_000, alicuota: 2.25 },
      { desde: 150_000_000, hasta: 300_000_000, alicuota: 2.75 },
      { desde: 300_000_000, hasta: Infinity,    alicuota: 3.50 },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtN = (n: number, dec = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtARS = (n: number) => `$ ${fmtN(Math.round(n))}`;
const fmtUSD = (n: number) => `USD ${fmtN(Math.round(n))}`;
const fmtPct = (n: number) => `${fmtN(n, 2)}%`;

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// Aplica escala progresiva sobre el excedente
function calcularEscala(base: number, escalas: EscalaTramo[]): number {
  if (base <= 0) return 0;
  let impuesto = 0;
  for (const tramo of escalas) {
    if (base <= tramo.desde) break;
    const gravado = Math.min(base, tramo.hasta === Infinity ? base : tramo.hasta) - tramo.desde;
    impuesto += gravado * (tramo.alicuota / 100);
  }
  return impuesto;
}

// Detalle por tramo (para visualización)
interface TramoDetalle {
  label: string;
  alicuota: number;
  base: number;        // monto en este tramo
  impuesto: number;
  acumulado: number;
}

function calcularDetalleEscala(base: number, escalas: EscalaTramo[]): TramoDetalle[] {
  if (base <= 0) return [];
  const detalles: TramoDetalle[] = [];
  let acumulado = 0;
  for (const tramo of escalas) {
    if (base <= tramo.desde) break;
    const enTramo = Math.min(base, tramo.hasta === Infinity ? base : tramo.hasta) - tramo.desde;
    const imp = enTramo * (tramo.alicuota / 100);
    acumulado += imp;
    const hastaStr = tramo.hasta === Infinity ? "∞" : `$ ${fmtN(tramo.hasta / 1_000_000)}M`;
    detalles.push({
      label: `$ ${fmtN(tramo.desde / 1_000_000)}M – ${hastaStr}`,
      alicuota: tramo.alicuota,
      base: enTramo,
      impuesto: imp,
      acumulado,
    });
  }
  return detalles;
}

// ── Estilos comunes ───────────────────────────────────────────────────────────

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
  textTransform: "uppercase",
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
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)",
  margin: "0 0 16px",
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function CalculadoraBienesPersonales() {
  // ── Año / tipo de cambio
  const [anio, setAnio] = useState<Anio>("2024");
  const [tcStr, setTcStr] = useState<string>("1300");

  // ── Casa habitación
  const [vmCasaStr, setVmCasaStr] = useState<string>("150000");
  const [vfCasaStr, setVfCasaStr] = useState<string>("5000000");
  const [tieneCasaHab, setTieneCasaHab] = useState<boolean>(true);
  const [casaHabEsExterior, setCasaHabEsExterior] = useState<boolean>(false);

  // ── Otros inmuebles
  const [inmuebles, setInmuebles] = useState<InmuebleIBP[]>([
    {
      id: uid(),
      descripcion: "Departamento alquiler",
      valorMercado: 80000,
      valuacionFiscal: 3000000,
      esExterior: false,
    },
  ]);

  // ── Otros activos
  const [otrosActivosStr, setOtrosActivosStr] = useState<string>("50000");
  const [dineroCuentasStr, setDineroCuentasStr] = useState<string>("10000");
  const [automotoresStr, setAutomotoresStr] = useState<string>("20000");

  // ── Agregar / editar inmuebles
  const agregarInmueble = useCallback(() => {
    setInmuebles(prev => [
      ...prev,
      {
        id: uid(),
        descripcion: "Nuevo inmueble",
        valorMercado: 0,
        valuacionFiscal: 0,
        esExterior: false,
      },
    ]);
  }, []);

  const actualizarInmueble = useCallback(
    (id: string, campo: keyof Omit<InmuebleIBP, "id">, valor: string | number | boolean) => {
      setInmuebles(prev =>
        prev.map(inv => (inv.id === id ? { ...inv, [campo]: valor } : inv))
      );
    },
    []
  );

  const eliminarInmueble = useCallback((id: string) => {
    setInmuebles(prev => prev.filter(inv => inv.id !== id));
  }, []);

  // ── Cálculos principales ──────────────────────────────────────────────────

  const resultado = useMemo(() => {
    const tc = parseFloat(tcStr) || 1;
    const params = PARAMS[anio];

    const vmCasa = parseFloat(vmCasaStr) || 0;
    const vfCasa = parseFloat(vfCasaStr) || 0;
    const otrosActivos = parseFloat(otrosActivosStr) || 0;
    const dineroCuentas = parseFloat(dineroCuentasStr) || 0;
    const automotores = parseFloat(automotoresStr) || 0;

    // Valor base = mayor entre valor de plaza * TC y valuación fiscal
    const valorBaseInmueble = (vm: number, vf: number): number =>
      Math.max(vm * tc, vf);

    // Casa habitación
    const casaHabBase = tieneCasaHab ? valorBaseInmueble(vmCasa, vfCasa) : 0;
    const casaHabExenta =
      tieneCasaHab &&
      !casaHabEsExterior &&
      casaHabBase <= params.exencionCasaHab;

    // Inmuebles adicionales con su valor base
    const inmueblesConBase = inmuebles.map(inv => ({
      ...inv,
      base: valorBaseInmueble(inv.valorMercado, inv.valuacionFiscal),
    }));

    // Suma valor base todos los inmuebles (incluyendo casa hab)
    const sumInmuebles =
      casaHabBase +
      inmueblesConBase.reduce((s, inv) => s + inv.base, 0);

    // Otros activos en ARS
    const otrosActivosARS = (otrosActivos + dineroCuentas + automotores) * tc;

    // Patrimonio total ARS
    const patrimonioTotalARS = sumInmuebles + otrosActivosARS;

    // Base imponible: patrimonio - MNI - exención casa hab (si aplica)
    const exencionCH = casaHabExenta ? casaHabBase : 0;
    const baseImponibleBruta = patrimonioTotalARS - params.mni - exencionCH;
    const baseImponible = Math.max(0, baseImponibleBruta);

    // Impuesto: suma escalas Argentina + exterior (simplificación: bienes ext van a escala exterior)
    // Para inmuebles en el exterior, se aplica escala diferenciada
    const baseArgentina = baseImponible > 0
      ? Math.max(
          0,
          baseImponible -
            inmueblesConBase
              .filter(inv => inv.esExterior)
              .reduce((s, inv) => s + inv.base, 0) -
            (tieneCasaHab && casaHabEsExterior ? casaHabBase : 0)
        )
      : 0;

    const baseExterior = baseImponible > 0
      ? Math.min(
          baseImponible,
          inmueblesConBase
            .filter(inv => inv.esExterior)
            .reduce((s, inv) => s + inv.base, 0) +
            (tieneCasaHab && casaHabEsExterior ? casaHabBase : 0)
        )
      : 0;

    const impuestoArg = calcularEscala(baseArgentina, params.escalasArg);
    const impuestoExt = calcularEscala(baseExterior, params.escalasExt);
    const impuestoTotal = impuestoArg + impuestoExt;

    const alicuotaEfectiva =
      patrimonioTotalARS > 0 ? (impuestoTotal / patrimonioTotalARS) * 100 : 0;

    const detalleEscalaArg = calcularDetalleEscala(baseArgentina, params.escalasArg);
    const detalleEscalaExt =
      baseExterior > 0
        ? calcularDetalleEscala(baseExterior, params.escalasExt)
        : [];

    return {
      tc,
      params,
      casaHabBase,
      casaHabExenta,
      casaHabEsExterior,
      inmueblesConBase,
      sumInmuebles,
      otrosActivosARS,
      patrimonioTotalARS,
      baseImponible,
      baseArgentina,
      baseExterior,
      impuestoArg,
      impuestoExt,
      impuestoTotal,
      alicuotaEfectiva,
      detalleEscalaArg,
      detalleEscalaExt,
    };
  }, [
    anio,
    tcStr,
    vmCasaStr,
    vfCasaStr,
    tieneCasaHab,
    casaHabEsExterior,
    inmuebles,
    otrosActivosStr,
    dineroCuentasStr,
    automotoresStr,
  ]);

  // ── PDF Export ────────────────────────────────────────────────────────────

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;

    const r = resultado;
    const filaInmueble = (
      desc: string,
      base: number,
      exenta: boolean,
      esExt: boolean
    ) => `
      <tr>
        <td>${desc}</td>
        <td style="text-align:right">${fmtARS(base)}</td>
        <td style="text-align:center">${esExt ? "Sí" : "No"}</td>
        <td style="text-align:center">${exenta ? "✓ Exento" : "—"}</td>
      </tr>`;

    const filasCH = tieneCasaHab
      ? filaInmueble("Casa-habitación", r.casaHabBase, r.casaHabExenta, casaHabEsExterior)
      : "";

    const filasInm = r.inmueblesConBase
      .map(inv => filaInmueble(inv.descripcion, inv.base, false, inv.esExterior))
      .join("");

    const filasEscala = r.detalleEscalaArg
      .map(
        t => `<tr>
          <td>${t.label}</td>
          <td style="text-align:right">${fmtPct(t.alicuota)}</td>
          <td style="text-align:right">${fmtARS(t.base)}</td>
          <td style="text-align:right">${fmtARS(t.impuesto)}</td>
        </tr>`
      )
      .join("");

    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>IBP – Bienes Personales ${anio}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px;max-width:900px;margin:auto}
        h1{font-size:20px;margin-bottom:4px}
        h2{font-size:14px;margin-top:24px;border-bottom:2px solid #cc0000;padding-bottom:4px;color:#cc0000}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        td,th{padding:7px 10px;border-bottom:1px solid #eee;text-align:left}
        th{background:#f5f5f5;font-weight:bold}
        .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
        .kpi{background:#f5f5f5;border-radius:6px;padding:12px 14px}
        .kpi-val{font-size:17px;font-weight:bold;color:#cc0000}
        .kpi-lbl{font-size:10px;text-transform:uppercase;color:#888;margin-top:3px}
        .disclaimer{background:#fff8e1;border-left:4px solid #f59e0b;padding:10px 14px;margin-top:24px;font-size:10px;color:#555}
      </style></head><body>
      <h1>Impuesto a los Bienes Personales — Inmuebles</h1>
      <p style="color:#888">Ejercicio fiscal ${anio} · Tipo de cambio: $${fmtN(r.tc)} ARS/USD</p>

      <div class="kpis">
        <div class="kpi"><div class="kpi-val">${fmtARS(r.patrimonioTotalARS)}</div><div class="kpi-lbl">Patrimonio total</div></div>
        <div class="kpi"><div class="kpi-val">${fmtARS(r.baseImponible)}</div><div class="kpi-lbl">Base imponible</div></div>
        <div class="kpi"><div class="kpi-val">${fmtARS(r.impuestoTotal)}</div><div class="kpi-lbl">Impuesto estimado</div></div>
        <div class="kpi"><div class="kpi-val">${fmtPct(r.alicuotaEfectiva)}</div><div class="kpi-lbl">Alícuota efectiva</div></div>
      </div>

      <h2>Inmuebles declarados</h2>
      <table>
        <thead><tr><th>Descripción</th><th>Valor base ARS</th><th>Exterior</th><th>Exento</th></tr></thead>
        <tbody>${filasCH}${filasInm}</tbody>
      </table>

      <h2>Composición del patrimonio</h2>
      <table>
        <thead><tr><th>Rubro</th><th>Valor ARS</th></tr></thead>
        <tbody>
          <tr><td>Inmuebles (total)</td><td style="text-align:right">${fmtARS(r.sumInmuebles)}</td></tr>
          <tr><td>Otros activos (USD→ARS)</td><td style="text-align:right">${fmtARS(r.otrosActivosARS)}</td></tr>
          <tr><td>MNI (mínimo no imponible)</td><td style="text-align:right">(${fmtARS(r.params.mni)})</td></tr>
          ${r.casaHabExenta ? `<tr><td>Exención casa-habitación</td><td style="text-align:right">(${fmtARS(r.casaHabBase)})</td></tr>` : ""}
        </tbody>
      </table>

      ${r.detalleEscalaArg.length > 0 ? `
      <h2>Escala progresiva (bienes en Argentina)</h2>
      <table>
        <thead><tr><th>Tramo</th><th>Alícuota</th><th>Base en tramo</th><th>Impuesto parcial</th></tr></thead>
        <tbody>${filasEscala}</tbody>
      </table>` : ""}

      <div class="disclaimer">
        <strong>Aviso legal:</strong> Esta calculadora ofrece una estimación orientativa. El IBP es un impuesto complejo sujeto a modificaciones anuales.
        Los valores de MNI, exenciones y alícuotas pueden variar por decreto o resolución AFIP. Consultar con un contador matriculado antes de presentar la declaración jurada.
      </div>
      </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const r = resultado;

  const kpis = [
    {
      label: "Patrimonio total",
      valor: fmtARS(r.patrimonioTotalARS),
      sub: `USD ${fmtN(Math.round(r.patrimonioTotalARS / r.tc))}`,
      color: "#3b82f6",
    },
    {
      label: "Base imponible",
      valor: fmtARS(r.baseImponible),
      sub: r.baseImponible <= 0 ? "Por debajo del MNI" : `Excede el MNI`,
      color: r.baseImponible > 0 ? "#f59e0b" : "#22c55e",
    },
    {
      label: "Impuesto estimado",
      valor: fmtARS(r.impuestoTotal),
      sub: r.baseImponible <= 0 ? "Sin obligación" : `Carga tributaria anual`,
      color: r.impuestoTotal > 0 ? "#cc0000" : "#22c55e",
    },
    {
      label: "Alícuota efectiva",
      valor: fmtPct(r.alicuotaEfectiva),
      sub: `Sobre patrimonio total`,
      color: "#a78bfa",
    },
  ];

  const maxTramoImpuesto = Math.max(
    ...r.detalleEscalaArg.map(t => t.impuesto),
    ...r.detalleEscalaExt.map(t => t.impuesto),
    1
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "Inter,sans-serif",
        padding: "28px 24px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <Link
          href="/calculadoras"
          style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}
        >
          ← Calculadoras
        </Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1
          style={{
            fontFamily: "Montserrat,sans-serif",
            fontSize: 18,
            fontWeight: 800,
            margin: 0,
          }}
        >
          Bienes Personales — Inmuebles
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
          IBP
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 20,
          maxWidth: 1200,
          margin: "0 auto",
          alignItems: "start",
        }}
      >
        {/* ── Panel izquierdo — inputs ─────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Config general */}
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Configuración</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Ejercicio fiscal</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["2023", "2024", "2025"] as Anio[]).map(a => (
                  <button
                    key={a}
                    onClick={() => setAnio(a)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 6,
                      border:
                        anio === a
                          ? "1px solid #cc0000"
                          : "1px solid rgba(255,255,255,0.12)",
                      background: anio === a ? "rgba(204,0,0,0.12)" : "#111",
                      color: anio === a ? "#cc0000" : "rgba(255,255,255,0.6)",
                      fontFamily: "Montserrat,sans-serif",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 0 }}>
              <label style={labelStyle}>Tipo de cambio (ARS / USD)</label>
              <input
                style={inputStyle}
                type="number"
                value={tcStr}
                onChange={e => setTcStr(e.target.value)}
                min={1}
              />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                MNI {anio}: {fmtARS(r.params.mni)} · Exención CH: {fmtARS(r.params.exencionCasaHab)}
              </div>
            </div>
          </div>

          {/* Casa habitación */}
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Casa-habitación</h3>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={tieneCasaHab}
                  onChange={e => setTieneCasaHab(e.target.checked)}
                  style={{ accentColor: "#cc0000" }}
                />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Tengo</span>
              </label>
            </div>

            {tieneCasaHab && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Valor de mercado (USD)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={vmCasaStr}
                    onChange={e => setVmCasaStr(e.target.value)}
                    min={0}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Valuación fiscal (ARS)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={vfCasaStr}
                    onChange={e => setVfCasaStr(e.target.value)}
                    min={0}
                  />
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                    Valor base: {fmtARS(r.casaHabBase)}
                    {r.casaHabExenta
                      ? " — EXENTA"
                      : " — supera límite de exención"}
                  </div>
                </div>

                <label
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={casaHabEsExterior}
                    onChange={e => setCasaHabEsExterior(e.target.checked)}
                    style={{ accentColor: "#cc0000" }}
                  />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    Inmueble en el exterior
                  </span>
                </label>

                {r.casaHabExenta && (
                  <div
                    style={{
                      marginTop: 12,
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontSize: 11,
                      color: "#22c55e",
                    }}
                  >
                    Casa-habitación exenta — valor base menor al umbral de {fmtARS(r.params.exencionCasaHab)}
                  </div>
                )}

                {!r.casaHabExenta && tieneCasaHab && (
                  <div
                    style={{
                      marginTop: 12,
                      background: "rgba(204,0,0,0.08)",
                      border: "1px solid rgba(204,0,0,0.2)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontSize: 11,
                      color: "#f87171",
                    }}
                  >
                    {casaHabEsExterior
                      ? "Inmueble en exterior — no aplica exención CH"
                      : `Valor supera ${fmtARS(r.params.exencionCasaHab)} — no exenta`}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Otros inmuebles */}
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Otros inmuebles</h3>
              <button
                onClick={agregarInmueble}
                style={{
                  background: "rgba(204,0,0,0.12)",
                  border: "1px solid rgba(204,0,0,0.3)",
                  borderRadius: 6,
                  color: "#cc0000",
                  fontSize: 12,
                  fontFamily: "Montserrat,sans-serif",
                  fontWeight: 700,
                  padding: "5px 12px",
                  cursor: "pointer",
                }}
              >
                + Agregar
              </button>
            </div>

            {inmuebles.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.25)",
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                Sin inmuebles adicionales
              </div>
            )}

            {inmuebles.map((inv, idx) => (
              <div
                key={inv.id}
                style={{
                  borderTop:
                    idx > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                  paddingTop: idx > 0 ? 16 : 0,
                  marginTop: idx > 0 ? 16 : 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "Montserrat,sans-serif",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    INMUEBLE {idx + 1}
                  </span>
                  <button
                    onClick={() => eliminarInmueble(inv.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.2)",
                      fontSize: 16,
                      cursor: "pointer",
                      padding: "0 4px",
                      lineHeight: 1,
                    }}
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Descripción</label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={inv.descripcion}
                    onChange={e =>
                      actualizarInmueble(inv.id, "descripcion", e.target.value)
                    }
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>Valor mercado (USD)</label>
                    <input
                      style={inputStyle}
                      type="number"
                      value={inv.valorMercado || ""}
                      onChange={e =>
                        actualizarInmueble(
                          inv.id,
                          "valorMercado",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      min={0}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Val. fiscal (ARS)</label>
                    <input
                      style={inputStyle}
                      type="number"
                      value={inv.valuacionFiscal || ""}
                      onChange={e =>
                        actualizarInmueble(
                          inv.id,
                          "valuacionFiscal",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      min={0}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={inv.esExterior}
                      onChange={e =>
                        actualizarInmueble(inv.id, "esExterior", e.target.checked)
                      }
                      style={{ accentColor: "#cc0000" }}
                    />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Bien en exterior
                    </span>
                  </label>
                  {r.inmueblesConBase[idx] && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: "Montserrat,sans-serif",
                      }}
                    >
                      Base: {fmtARS(r.inmueblesConBase[idx].base)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Otros activos */}
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Otros activos (USD)</h3>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
              Para completar el patrimonio total (se convierten a ARS al TC ingresado)
            </div>

            {[
              { label: "Otros activos / inversiones", val: otrosActivosStr, set: setOtrosActivosStr },
              { label: "Dinero en cuentas bancarias", val: dineroCuentasStr, set: setDineroCuentasStr },
              { label: "Automotores", val: automotoresStr, set: setAutomotoresStr },
            ].map(campo => (
              <div key={campo.label} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{campo.label}</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={campo.val}
                  onChange={e => campo.set(e.target.value)}
                  min={0}
                />
              </div>
            ))}

            <div
              style={{
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                Otros activos en ARS
              </span>
              <span
                style={{
                  fontFamily: "Montserrat,sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                }}
              >
                {fmtARS(r.otrosActivosARS)}
              </span>
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
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.6,
              }}
            >
              El IBP es un impuesto complejo que cambia cada año. Los valores de MNI, exenciones y alícuotas son estimaciones basadas en la normativa vigente y pueden variar por decreto o resolución AFIP. Esta herramienta es orientativa. Consultar con un contador matriculado antes de presentar la declaración jurada.
            </div>
          </div>
        </div>

        {/* ── Panel derecho — resultados ──────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {kpis.map((k, i) => (
              <div
                key={i}
                style={{
                  ...cardStyle,
                  textAlign: "center",
                  borderColor:
                    i === 2 && r.impuestoTotal > 0
                      ? "rgba(204,0,0,0.2)"
                      : "rgba(255,255,255,0.07)",
                }}
              >
                <div
                  style={{
                    fontFamily: "Montserrat,sans-serif",
                    fontSize: 18,
                    fontWeight: 800,
                    color: k.color,
                    lineHeight: 1.2,
                  }}
                >
                  {k.valor}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "Montserrat,sans-serif",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.3)",
                    marginTop: 6,
                  }}
                >
                  {k.label}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 4,
                  }}
                >
                  {k.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Composición del patrimonio */}
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Composición del patrimonio</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {
                  label: "Total inmuebles",
                  valor: r.sumInmuebles,
                  pct:
                    r.patrimonioTotalARS > 0
                      ? (r.sumInmuebles / r.patrimonioTotalARS) * 100
                      : 0,
                  color: "#3b82f6",
                },
                {
                  label: "Otros activos",
                  valor: r.otrosActivosARS,
                  pct:
                    r.patrimonioTotalARS > 0
                      ? (r.otrosActivosARS / r.patrimonioTotalARS) * 100
                      : 0,
                  color: "#a78bfa",
                },
              ].map(barra => (
                <div key={barra.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}
                    >
                      {barra.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        color: barra.color,
                      }}
                    >
                      {fmtARS(barra.valor)} · {fmtPct(barra.pct)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barra.pct}%`,
                        background: barra.color,
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Resumen MNI */}
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                }}
              >
                {[
                  { label: "MNI", valor: r.params.mni, color: "rgba(255,255,255,0.4)" },
                  {
                    label: r.casaHabExenta ? "Exención CH" : "Sin exención CH",
                    valor: r.casaHabExenta ? r.casaHabBase : 0,
                    color: r.casaHabExenta ? "#22c55e" : "rgba(255,255,255,0.25)",
                  },
                  {
                    label: "Base imponible",
                    valor: r.baseImponible,
                    color: r.baseImponible > 0 ? "#f59e0b" : "#22c55e",
                  },
                ].map(item => (
                  <div
                    key={item.label}
                    style={{
                      background: "#111",
                      borderRadius: 6,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        color: item.color,
                      }}
                    >
                      {fmtARS(item.valor)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla desglose de inmuebles */}
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Desglose de inmuebles</h3>
            <div
              style={{
                overflowX: "auto",
              }}
            >
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
                    {["Inmueble", "Val. mercado", "Val. fiscal", "Base IBP", "Exterior", "Estado"].map(
                      col => (
                        <th
                          key={col}
                          style={{
                            textAlign: col === "Inmueble" ? "left" : "right",
                            padding: "8px 10px",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 10,
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
                  {tieneCasaHab && (
                    <tr>
                      <td
                        style={{
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          color: "rgba(255,255,255,0.85)",
                        }}
                      >
                        <div>Casa-habitación</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                          {casaHabEsExterior ? "Exterior" : "Argentina"}
                        </div>
                      </td>
                      {[
                        fmtUSD(parseFloat(vmCasaStr) || 0),
                        fmtARS(parseFloat(vfCasaStr) || 0),
                        fmtARS(r.casaHabBase),
                      ].map((v, i) => (
                        <td
                          key={i}
                          style={{
                            padding: "10px 10px",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            textAlign: "right",
                            fontFamily: "Montserrat,sans-serif",
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.7)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {v}
                        </td>
                      ))}
                      <td
                        style={{
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          textAlign: "right",
                          color: casaHabEsExterior ? "#f59e0b" : "rgba(255,255,255,0.3)",
                          fontSize: 11,
                        }}
                      >
                        {casaHabEsExterior ? "Exterior" : "—"}
                      </td>
                      <td
                        style={{
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          textAlign: "right",
                        }}
                      >
                        {r.casaHabExenta ? (
                          <span
                            style={{
                              background: "rgba(34,197,94,0.12)",
                              color: "#22c55e",
                              borderRadius: 4,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontFamily: "Montserrat,sans-serif",
                              fontWeight: 700,
                            }}
                          >
                            EXENTA
                          </span>
                        ) : (
                          <span
                            style={{
                              background: "rgba(204,0,0,0.12)",
                              color: "#f87171",
                              borderRadius: 4,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontFamily: "Montserrat,sans-serif",
                              fontWeight: 700,
                            }}
                          >
                            COMPUTA
                          </span>
                        )}
                      </td>
                    </tr>
                  )}

                  {r.inmueblesConBase.map(inv => (
                    <tr key={inv.id}>
                      <td
                        style={{
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          color: "rgba(255,255,255,0.85)",
                        }}
                      >
                        <div>{inv.descripcion}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                          {inv.esExterior ? "Exterior" : "Argentina"}
                        </div>
                      </td>
                      {[
                        fmtUSD(inv.valorMercado),
                        fmtARS(inv.valuacionFiscal),
                        fmtARS(inv.base),
                      ].map((v, i) => (
                        <td
                          key={i}
                          style={{
                            padding: "10px 10px",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            textAlign: "right",
                            fontFamily: "Montserrat,sans-serif",
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.7)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {v}
                        </td>
                      ))}
                      <td
                        style={{
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          textAlign: "right",
                          color: inv.esExterior ? "#f59e0b" : "rgba(255,255,255,0.3)",
                          fontSize: 11,
                        }}
                      >
                        {inv.esExterior ? "Exterior" : "—"}
                      </td>
                      <td
                        style={{
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          textAlign: "right",
                        }}
                      >
                        <span
                          style={{
                            background: "rgba(204,0,0,0.12)",
                            color: "#f87171",
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontFamily: "Montserrat,sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          COMPUTA
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Total */}
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: "12px 10px",
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase",
                      }}
                    >
                      Total inmuebles
                    </td>
                    <td
                      style={{
                        padding: "12px 10px",
                        textAlign: "right",
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#3b82f6",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtARS(r.sumInmuebles)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Escala progresiva — visual */}
          {r.baseImponible > 0 && (
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Escala progresiva — tramos del impuesto</h3>

              {r.detalleEscalaArg.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: "Montserrat,sans-serif",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.5)",
                      marginBottom: 10,
                    }}
                  >
                    Bienes en Argentina — impuesto: {fmtARS(r.impuestoArg)}
                  </div>
                  {r.detalleEscalaArg.map((tramo, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 5,
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontFamily: "Montserrat,sans-serif",
                              fontSize: 12,
                              color: "rgba(255,255,255,0.75)",
                            }}
                          >
                            {tramo.label}
                          </span>
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              color: "rgba(255,255,255,0.35)",
                            }}
                          >
                            @ {fmtPct(tramo.alicuota)}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#cc0000",
                            whiteSpace: "nowrap",
                            marginLeft: 12,
                          }}
                        >
                          {fmtARS(tramo.impuesto)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(tramo.impuesto / maxTramoImpuesto) * 100}%`,
                            background: `hsl(${220 - i * 30},80%,55%)`,
                            borderRadius: 4,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.25)",
                          marginTop: 3,
                        }}
                      >
                        Base en tramo: {fmtARS(tramo.base)}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {r.detalleEscalaExt.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: "Montserrat,sans-serif",
                      fontWeight: 700,
                      color: "#f59e0b",
                      marginBottom: 10,
                      marginTop: r.detalleEscalaArg.length > 0 ? 16 : 0,
                      paddingTop: r.detalleEscalaArg.length > 0 ? 14 : 0,
                      borderTop:
                        r.detalleEscalaArg.length > 0
                          ? "1px solid rgba(255,255,255,0.06)"
                          : undefined,
                    }}
                  >
                    Bienes en el exterior (alícuotas diferenciadas) — impuesto: {fmtARS(r.impuestoExt)}
                  </div>
                  {r.detalleEscalaExt.map((tramo, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 5,
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontFamily: "Montserrat,sans-serif",
                              fontSize: 12,
                              color: "rgba(255,255,255,0.75)",
                            }}
                          >
                            {tramo.label}
                          </span>
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              color: "rgba(255,255,255,0.35)",
                            }}
                          >
                            @ {fmtPct(tramo.alicuota)}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#f59e0b",
                            whiteSpace: "nowrap",
                            marginLeft: 12,
                          }}
                        >
                          {fmtARS(tramo.impuesto)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(tramo.impuesto / maxTramoImpuesto) * 100}%`,
                            background: `hsl(${40 - i * 10},90%,55%)`,
                            borderRadius: 4,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.25)",
                          marginTop: 3,
                        }}
                      >
                        Base en tramo: {fmtARS(tramo.base)}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Totales */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  display: "grid",
                  gridTemplateColumns: r.impuestoExt > 0 ? "1fr 1fr 1fr" : "1fr 1fr",
                  gap: 10,
                }}
              >
                {[
                  ...(r.impuestoExt > 0
                    ? [
                        { label: "Impuesto Argentina", valor: r.impuestoArg, color: "#cc0000" },
                        { label: "Impuesto Exterior", valor: r.impuestoExt, color: "#f59e0b" },
                      ]
                    : []),
                  { label: "Impuesto Total", valor: r.impuestoTotal, color: "#cc0000" },
                  { label: "Alícuota efectiva", valor: -1, color: "#a78bfa", isAlicuota: true },
                ]
                  .filter((_, i, arr) =>
                    r.impuestoExt > 0 ? true : i >= arr.length - 2
                  )
                  .map((item, i) => (
                    <div
                      key={i}
                      style={{
                        background: "#111",
                        borderRadius: 6,
                        padding: "10px 12px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Montserrat,sans-serif",
                          fontSize: 16,
                          fontWeight: 800,
                          color: item.color,
                        }}
                      >
                        {"isAlicuota" in item && item.isAlicuota
                          ? fmtPct(r.alicuotaEfectiva)
                          : fmtARS(item.valor)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.35)",
                          marginTop: 4,
                        }}
                      >
                        {item.label}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Sin obligación */}
          {r.baseImponible <= 0 && (
            <div
              style={{
                ...cardStyle,
                border: "1px solid rgba(34,197,94,0.2)",
                textAlign: "center",
                padding: "32px 24px",
              }}
            >
              <div
                style={{
                  fontFamily: "Montserrat,sans-serif",
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#22c55e",
                  marginBottom: 8,
                }}
              >
                Sin obligación de pago
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                El patrimonio declarado (incluyendo exenciones aplicables) no supera el mínimo no
                imponible de {fmtARS(r.params.mni)} para el ejercicio {anio}.
              </div>
            </div>
          )}

          {/* Botón PDF */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={exportarPDF}
              style={{
                background: "#cc0000",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "10px 22px",
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
        </div>
      </div>
    </div>
  );
}
