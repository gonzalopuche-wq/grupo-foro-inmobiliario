// Mercado Libre official REST API — no auth required for searches
// Docs: https://developers.mercadolibre.com.ar/es_ar/categorias-y-atributos-inmuebles
import { PropExtNorm, normalizeTipo, normalizeOperacion, parseNum } from "./types";

const ML_API = "https://api.mercadolibre.com";
const ML_CATEGORY = "MLA1459"; // Inmuebles Argentina
const ML_SITE = "MLA";
const ML_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GFI-Sync/1.0)" };
const ML_TIMEOUT = 30000;

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
      signal: AbortSignal.timeout(ML_TIMEOUT),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json(), status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

// Descubre el state_id de Santa Fe desde la API de ML (dinámico, no hardcodeado)
async function getSantaFeStateId(): Promise<string | null> {
  const { ok, data } = await mlGet(`${ML_API}/classified_locations/states`);
  if (!ok || !Array.isArray(data)) return null;
  const sf = data.find((s: any) =>
    typeof s.name === "string" && s.name.toLowerCase().includes("santa fe")
  );
  return sf?.id ?? null;
}

// Descubre el city_id de Rosario via search_location
async function getRosarioCityId(): Promise<string | null> {
  const { ok, data } = await mlGet(
    `${ML_API}/sites/${ML_SITE}/search_location?q=Rosario+Santa+Fe`
  );
  if (!ok) return null;
  const candidates: any[] = data?.matching_content ?? data?.results ?? [];
  const rosario = candidates.find(
    (c: any) =>
      c.type === "city" &&
      (c.name?.toLowerCase().includes("rosario") || c.place_id?.toString().includes("rosario"))
  );
  return rosario?.id ?? rosario?.place_id ?? null;
}

async function fetchPage(baseUrl: string, offset: number, perPage: number) {
  const { ok, data, status } = await mlGet(`${baseUrl}&offset=${offset}`);
  if (!ok) return { items: [], total: 0, httpError: status };
  return {
    items: (data?.results ?? []) as any[],
    total: (data?.paging?.total ?? 0) as number,
    httpError: undefined,
  };
}

export async function syncMercadoLibre(maxItems = 300): Promise<PropExtNorm[]> {
  const perPage = 50;
  let lastError: string | null = null;

  // Descubrir IDs dinámicamente (no depende de hardcoded IDs)
  const [stateId, cityId] = await Promise.all([
    getSantaFeStateId(),
    getRosarioCityId(),
  ]);

  // Construir estrategias en orden: city (más específico) → state → fallbacks
  const strategies: string[] = [];

  if (cityId) {
    strategies.push(`${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&city=${encodeURIComponent(cityId)}&limit=${perPage}`);
  }
  if (stateId) {
    strategies.push(`${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&state=${encodeURIComponent(stateId)}&limit=${perPage}`);
  }

  // Fallbacks con parámetros conocidos
  strategies.push(
    // city ID conocido de Rosario (MLAC128755 encoded)
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&city=TUxBQUMxMjg3NTU&limit=${perPage}`,
    // state ID conocido de Santa Fe (TUxBUFNBTjI3MTQ)
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&state=TUxBUFNBTjI3MTQ&limit=${perPage}`,
  );

  // Eliminar estrategias duplicadas (si el ID dinámico coincide con el hardcodeado)
  const uniqueStrategies = [...new Set(strategies)];

  for (const baseUrl of uniqueStrategies) {
    const strategyResults: PropExtNorm[] = [];
    let offset = 0;

    while (strategyResults.length < maxItems) {
      const { items, total, httpError } = await fetchPage(baseUrl, offset, perPage);

      if (httpError !== undefined) {
        lastError = httpError === 0
          ? `Error de red/timeout en ML API (strategy: ${baseUrl.split("?")[1]?.slice(0, 60)})`
          : `HTTP ${httpError} en ML API`;
        // Para errores HTTP fatales, no tiene sentido probar más estrategias
        if (httpError === 403 || httpError === 429 || httpError === 503) {
          throw new Error(`MercadoLibre: ${lastError}`);
        }
        break; // Para otros errores, intentar siguiente estrategia
      }

      if (!items.length) break;

      for (const item of items) strategyResults.push(normalizeML(item));

      offset += perPage;
      if (offset >= Math.min(total, maxItems)) break;
    }

    if (strategyResults.length > 0) {
      return strategyResults;
    }
  }

  if (lastError) throw new Error(`MercadoLibre: ${lastError}`);
  return [];
}
