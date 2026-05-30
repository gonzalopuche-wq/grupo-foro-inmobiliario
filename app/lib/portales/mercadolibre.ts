// Mercado Libre official REST API — no auth required for searches
// Docs: https://developers.mercadolibre.com.ar/es_ar/categorias-y-atributos-inmuebles
import { PropExtNorm, normalizeTipo, normalizeOperacion, parseNum } from "./types";

const ML_API = "https://api.mercadolibre.com";
const ML_CATEGORY = "MLA1459"; // Inmuebles Argentina
const ML_SITE = "MLA";

function getAttr(attrs: Array<{ id: string; value_name?: string }>, id: string): string | null {
  return attrs?.find(a => a.id === id)?.value_name ?? null;
}

function normalizeML(item: Record<string, any>): PropExtNorm {
  const attrs: Array<{ id: string; value_name?: string }> = item.attributes ?? [];
  const opRaw = getAttr(attrs, "OPERATION") ?? getAttr(attrs, "OPERATION_TYPE");
  const tipoRaw = getAttr(attrs, "PROPERTY_TYPE") ?? getAttr(attrs, "REAL_ESTATE_TYPE");

  const supCubierta = parseNum(getAttr(attrs, "COVERED_AREA")?.replace(/[^\d.]/g, "") ?? null);
  const supTotal = parseNum(getAttr(attrs, "TOTAL_AREA")?.replace(/[^\d.]/g, "") ?? null);

  const imagenes: string[] = [];
  if (Array.isArray(item.pictures)) {
    for (const p of item.pictures) {
      const url = p.secure_url ?? p.url ?? "";
      if (url) imagenes.push(url);
    }
  } else if (item.thumbnail) {
    imagenes.push(item.thumbnail);
  }

  return {
    portal_id: String(item.id),
    url: item.permalink ?? "",
    titulo: item.title ?? "",
    operacion: normalizeOperacion(opRaw),
    tipo: normalizeTipo(tipoRaw),
    precio: parseNum(item.price),
    moneda: item.currency_id === "ARS" ? "ARS" : "USD",
    dormitorios: parseNum(getAttr(attrs, "BEDROOMS")),
    banos: parseNum(getAttr(attrs, "BATHROOMS")),
    ambientes: parseNum(getAttr(attrs, "ROOMS")),
    superficie_cubierta: supCubierta,
    sup_terreno: supTotal ?? parseNum(getAttr(attrs, "LOT_AREA")?.replace(/[^\d.]/g, "") ?? null),
    expensas: null,
    barrio: item.location?.neighborhood?.name ?? null,
    ciudad: item.location?.city?.name ?? "Rosario",
    provincia: item.location?.state?.name ?? "Santa Fe",
    direccion: item.location?.address_line ?? null,
    lat: parseNum(item.location?.latitude),
    lng: parseNum(item.location?.longitude),
    imagenes: imagenes.filter(Boolean),
    descripcion: null,
    datos_raw: { category_id: item.category_id, condition: item.condition },
  };
}

async function fetchMLPage(url: string): Promise<{ items: any[]; total: number; httpStatus?: number }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GFI-Sync/1.0)" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { items: [], total: 0, httpStatus: res.status };
    const data = await res.json();
    return {
      items: data.results ?? [],
      total: data.paging?.total ?? 0,
    };
  } catch (e: any) {
    return { items: [], total: 0, httpStatus: 0 };
  }
}

export async function syncMercadoLibre(maxItems = 300): Promise<PropExtNorm[]> {
  const results: PropExtNorm[] = [];
  const perPage = 50;

  // Estrategias en orden de especificidad: ciudad → estado → búsqueda libre
  const strategies = [
    // Ciudad de Rosario directa — más preciso
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&q=Rosario+Santa+Fe&limit=${perPage}`,
    // Solo departamento Santa Fe
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&state=TUxBUFNBTjI3MTQ&limit=${perPage}`,
    // Búsqueda sin filtros geográficos para propiedades en Rosario
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&q=Rosario&limit=${perPage}`,
  ];

  let lastError: string | null = null;

  for (const baseUrl of strategies) {
    let offset = 0;
    const strategyResults: PropExtNorm[] = [];

    while (strategyResults.length < maxItems) {
      const url = `${baseUrl}&offset=${offset}`;
      const { items, total, httpStatus } = await fetchMLPage(url);

      if (httpStatus !== undefined && httpStatus !== 0) {
        lastError = `HTTP ${httpStatus} en ML API`;
        break;
      }
      if (!items.length) break;

      for (const item of items) {
        strategyResults.push(normalizeML(item));
      }

      offset += perPage;
      if (offset >= Math.min(total, maxItems)) break;
    }

    if (strategyResults.length > 0) {
      results.push(...strategyResults);
      break;
    }
  }

  if (results.length === 0 && lastError) {
    throw new Error(`MercadoLibre: ${lastError}`);
  }

  return results;
}
