import { NextResponse } from "next/server";

// ── Variables BCRA v4.0 ─────────────────────────────────────────────────────
// https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/{idVariable}?desde=...&hasta=...
// idVariable:
//   27 = IPC (Inflación mensual %) — publica un dato por mes
//   40 = ICL (Índice para Contratos de Locación, base 30.6.20=1) — dato diario
//   30 = CER (Coeficiente de Estabilización de Referencia) — dato diario

const BCRA_BASE = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias";

// Variables que devuelven variación mensual directamente
const BCRA_MENSUAL: Record<string, number> = {
  IPC: 27,
};

// Variables que devuelven índice diario → hay que calcular variación mensual
const BCRA_DIARIO: Record<string, number> = {
  ICL: 40,
  CER: 30,
};

function fechaDesde(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  d.setMonth(d.getMonth() - 1); // un mes extra para calcular la variación del primer mes del rango
  return d.toISOString().split("T")[0];
}

function fechaHasta(): string {
  return new Date().toISOString().split("T")[0];
}

// IPC: una entrada por mes, valor = variación mensual %
function procesarMensual(datos: { fecha: string; valor: number }[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const d of datos) {
    r[d.fecha.slice(0, 7)] = d.valor;
  }
  return r;
}

// ICL / CER: entradas diarias, valor = índice acumulado.
// Variación mensual = (valorUltimoDíaDelMes / valorUltimoDíaMesAnterior - 1) × 100
function procesarDiarioAMensual(datos: { fecha: string; valor: number }[]): Record<string, number> {
  // Último valor disponible por mes
  const byMonth: Record<string, { fecha: string; valor: number }> = {};
  for (const d of datos) {
    const mes = d.fecha.slice(0, 7);
    if (!byMonth[mes] || d.fecha > byMonth[mes].fecha) byMonth[mes] = d;
  }
  const sorted = Object.keys(byMonth).sort();
  const r: Record<string, number> = {};
  for (let i = 1; i < sorted.length; i++) {
    const mes = sorted[i];
    const prev = sorted[i - 1];
    const variation = (byMonth[mes].valor / byMonth[prev].valor - 1) * 100;
    r[mes] = parseFloat(variation.toFixed(4));
  }
  return r;
}

// CAC: sin API pública — valores manuales del sitio de la Cámara Argentina de la Construcción
const CAC_FALLBACK: Record<string, number> = {
  "2023-01": 7.20, "2023-02": 7.80, "2023-03": 8.90, "2023-04": 9.60,
  "2023-05": 10.20,"2023-06": 9.10, "2023-07": 7.50, "2023-08": 8.40,
  "2023-09": 13.80,"2023-10": 12.10,"2023-11": 14.20,"2023-12": 28.30,
  "2024-01": 23.40,"2024-02": 17.10,"2024-03": 15.30,"2024-04": 12.80,
  "2024-05": 10.20,"2024-06": 8.90, "2024-07": 7.80, "2024-08": 5.30,
  "2024-09": 4.60, "2024-10": 4.10, "2024-11": 3.80, "2024-12": 4.20,
  "2025-01": 4.50, "2025-02": 3.90, "2025-03": 4.10, "2025-04": 3.80,
  "2025-05": 3.40, "2025-06": 2.80, "2025-07": 2.50, "2025-08": 2.70,
  "2025-09": 2.60, "2025-10": 2.80, "2025-11": 3.00, "2025-12": 3.20,
  "2026-01": 3.40, "2026-02": 3.50, "2026-03": 3.60,
};

// Cache en memoria (se limpia en cada cold start de serverless)
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 horas

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const desde = fechaDesde();
  const hasta = fechaHasta();

  try {
    const mensualFetches = Object.entries(BCRA_MENSUAL).map(async ([nombre, id]) => {
      const url = `${BCRA_BASE}/${id}?desde=${desde}&hasta=${hasta}&limit=1000`;
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        next: { revalidate: 21600 },
      });
      if (!res.ok) throw new Error(`BCRA ${nombre}: ${res.status}`);
      const json = await res.json();
      const detalle: { fecha: string; valor: number }[] = json.results?.[0]?.detalle ?? [];
      return { nombre, datos: procesarMensual(detalle) };
    });

    const diarioFetches = Object.entries(BCRA_DIARIO).map(async ([nombre, id]) => {
      const url = `${BCRA_BASE}/${id}?desde=${desde}&hasta=${hasta}&limit=2000`;
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        next: { revalidate: 21600 },
      });
      if (!res.ok) throw new Error(`BCRA ${nombre}: ${res.status}`);
      const json = await res.json();
      const detalle: { fecha: string; valor: number }[] = json.results?.[0]?.detalle ?? [];
      return { nombre, datos: procesarDiarioAMensual(detalle) };
    });

    const fetches = await Promise.allSettled([...mensualFetches, ...diarioFetches]);

    const indices: Record<string, Record<string, number>> = {
      CAC: CAC_FALLBACK,
    };

    let anySuccess = false;
    for (const result of fetches) {
      if (result.status === "fulfilled") {
        indices[result.value.nombre] = result.value.datos;
        anySuccess = true;
      }
    }

    if (!indices.ICL) indices.ICL = {};
    if (!indices.IPC) indices.IPC = {};
    if (!indices.CER) indices.CER = {};

    const response = {
      ok: anySuccess,
      actualizado: new Date().toISOString(),
      fuente: "BCRA API v4.0 + CAC manual",
      indices,
    };

    cache = { data: response, ts: Date.now() };
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching indices BCRA:", error);
    return NextResponse.json({
      ok: false,
      error: "No se pudo conectar con la API del BCRA",
      actualizado: null,
      fuente: "fallback",
      indices: {
        ICL: {},
        IPC: {},
        CAC: CAC_FALLBACK,
        CER: {},
      },
    });
  }
}
