// Mercado Libre official REST API — no auth required for searches
// Docs: https://developers.mercadolibre.com.ar/en_us/locate-property
import { PropExtNorm, normalizeTipo, normalizeOperacion, parseNum } from "./types";

const ML_API = "https://api.mercadolibre.com";
const ML_CATEGORY = "MLA1459"; // Inmuebles Argentina
const ML_SITE = "MLA";
const ML_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GFI-Sync/1.0)" };

// Bounding box de Rosario, Santa Fe (oficialmente documentado por ML para item_location)
const ROSARIO_LAT = "-33.0394_-32.8717";
const ROSARIO_LON = "-60.7961_-60.6122";

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

async function mlGet(url: string): Promise<{ ok: boolean; data?: any; status: number }> {
  try {
    const res = await fetch(url, {
      headers: ML_HEADERS,
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json(), status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function fetchPageItems(url: string): Promise<{
  items: any[];
  total: number;
  httpError?: number;
}> {
  const { ok, data, status } = await mlGet(url);
  if (!ok) return { items: [], total: 0, httpError: status };
  return { items: data?.results ?? [], total: data?.paging?.total ?? 0 };
}

export async function syncMercadoLibre(maxItems = 300): Promise<PropExtNorm[]> {
  const perPage = 50;

  // Estrategias en orden de confiabilidad:
  // 1. item_location (bounding box) — método oficialmente documentado por ML para inmuebles
  // 2. city ID de Rosario (MLAC128755 encoded) — filtro por ciudad
  // 3. Santa Fe state IDs candidatos (12 chars cada uno, formato correcto de estado)
  const strategies = [
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&item_location=lat:${ROSARIO_LAT},lon:${ROSARIO_LON}&limit=${perPage}`,
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&city=TUxBQUMxMjg3NTU&limit=${perPage}`,
    // IDs candidatos de Santa Fe (12 chars — formato correcto de estado en ML)
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&state=TUxBUFNBTmU5Nzk2&limit=${perPage}`,
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&state=TUxBUFNBTm5lYjU4&limit=${perPage}`,
  ];

  let lastError: string | null = null;

  for (const baseUrl of strategies) {
    const strategyResults: PropExtNorm[] = [];
    let offset = 0;

    while (strategyResults.length < maxItems) {
      const { items, total, httpError } = await fetchPageItems(`${baseUrl}&offset=${offset}`);

      if (httpError !== undefined) {
        lastError = httpError === 0
          ? "Error de red/timeout en ML API"
          : `HTTP ${httpError} en ML API`;
        if (httpError === 403 || httpError === 429 || httpError === 503) {
          throw new Error(`MercadoLibre: ${lastError}`);
        }
        break;
      }

      if (!items.length) break;

      for (const item of items) strategyResults.push(normalizeML(item));

      offset += perPage;
      if (offset >= Math.min(total, maxItems)) break;
    }

    if (strategyResults.length > 0) return strategyResults;
  }

  if (lastError) throw new Error(`MercadoLibre: ${lastError}`);
  return [];
}
