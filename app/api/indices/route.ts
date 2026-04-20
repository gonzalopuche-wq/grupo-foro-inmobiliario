import { NextResponse } from "next/server";

// ── Variables BCRA ──────────────────────────────────────────────────────────
// https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/{idVariable}/{desde}/{hasta}
// idVariable:
//   41 = ICL (Índice para Contratos de Locación)
//   27 = IPC (Índice de Precios al Consumidor - variación mensual)
//   30 = CER (Coeficiente de Estabilización de Referencia)

const BCRA_VARS: Record<string, number> = {
  ICL: 41,
  IPC: 27,
  CER: 30,
};

const BCRA_BASE = "https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable";

function fechaDesde(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function fechaHasta(): string {
  return new Date().toISOString().split("T")[0];
}

// Convierte array de datos BCRA {fecha, valor} a Record<YYYY-MM, variacion%>
function procesarBCRA(datos: { fecha: string; valor: number }[]): Record<string, number> {
  const resultado: Record<string, number> = {};
  for (const d of datos) {
    const mes = d.fecha.slice(0, 7); // YYYY-MM
    resultado[mes] = d.valor;
  }
  return resultado;
}

// CAC: no tiene API pública — usamos valores del último año publicados en el sitio
// En producción se puede hacer scraping del PDF mensual de CAC
const CAC_FALLBACK: Record<string, number> = {
  "2023-01": 7.20, "2023-02": 7.80, "2023-03": 8.90, "2023-04": 9.60,
  "2023-05": 10.20,"2023-06": 9.10, "2023-07": 7.50, "2023-08": 8.40,
  "2023-09": 13.80,"2023-10": 12.10,"2023-11": 14.20,"2023-12": 28.30,
  "2024-01": 23.40,"2024-02": 17.10,"2024-03": 15.30,"2024-04": 12.80,
  "2024-05": 10.20,"2024-06": 8.90, "2024-07": 7.80, "2024-08": 5.30,
  "2024-09": 4.60, "2024-10": 4.10, "2024-11": 3.80, "2024-12": 4.20,
  "2025-01": 4.50, "2025-02": 3.90, "2025-03": 4.10,
};

// Cache en memoria (se limpia en cada cold start de serverless)
let cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 horas

export async function GET() {
  // Servir desde cache si está vigente
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const desde = fechaDesde();
  const hasta = fechaHasta();

  try {
    // Fetch paralelo de las 3 variables BCRA
    const fetches = await Promise.allSettled(
      Object.entries(BCRA_VARS).map(async ([nombre, id]) => {
        const url = `${BCRA_BASE}/${id}/${desde}/${hasta}`;
        const res = await fetch(url, {
          headers: { "Accept": "application/json" },
          next: { revalidate: 21600 }, // 6hs cache Next.js
        });
        if (!res.ok) throw new Error(`BCRA ${nombre}: ${res.status}`);
        const json = await res.json();
        return { nombre, datos: procesarBCRA(json.results ?? []) };
      })
    );

    const indices: Record<string, Record<string, number>> = {
      CAC: CAC_FALLBACK,
    };

    for (const result of fetches) {
      if (result.status === "fulfilled") {
        indices[result.value.nombre] = result.value.datos;
      }
    }

    // Si algún índice no se pudo traer, usar fallback básico
    if (!indices.ICL) indices.ICL = {};
    if (!indices.IPC) indices.IPC = {};
    if (!indices.CER) indices.CER = {};

    const response = {
      ok: true,
      actualizado: new Date().toISOString(),
      fuente: "BCRA API + CAC manual",
      indices,
    };

    cache = { data: response, ts: Date.now() };
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching indices BCRA:", error);
    // Devolver fallback si la API del BCRA falla
    return NextResponse.json({
      ok: false,
      error: "No se pudo conectar con la API del BCRA",
      actualizado: null,
      fuente: "fallback",
      indices: {
        ICL: {
          "2024-01": 20.61,"2024-02": 15.02,"2024-03": 13.22,"2024-04": 10.73,
          "2024-05": 8.85, "2024-06": 7.26, "2024-07": 6.41, "2024-08": 4.19,
          "2024-09": 3.48, "2024-10": 3.21, "2024-11": 2.89, "2024-12": 3.12,
          "2025-01": 3.38, "2025-02": 2.91, "2025-03": 3.05,
        },
        IPC: {
          "2024-01": 20.60,"2024-02": 13.20,"2024-03": 11.00,"2024-04": 8.80,
          "2024-05": 4.20, "2024-06": 4.60, "2024-07": 4.00, "2024-08": 4.20,
          "2024-09": 3.50, "2024-10": 2.40, "2024-11": 2.40, "2024-12": 2.70,
          "2025-01": 2.30, "2025-02": 2.40, "2025-03": 3.70,
        },
        CAC: CAC_FALLBACK,
        CER: {
          "2024-01": 20.30,"2024-02": 13.00,"2024-03": 10.80,"2024-04": 8.60,
          "2024-05": 4.00, "2024-06": 4.40, "2024-07": 3.80, "2024-08": 4.00,
          "2024-09": 3.30, "2024-10": 2.30, "2024-11": 2.30, "2024-12": 2.50,
          "2025-01": 2.20, "2025-02": 2.30, "2025-03": 3.60,
        },
      },
    });
  }
}
