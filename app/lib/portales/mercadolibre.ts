// Mercado Libre official REST API
// Docs: https://developers.mercadolibre.com.ar/en_us/locate-property
//
// Para funcionar desde Vercel: registrar app en developers.mercadolibre.com.ar
// y guardar en crm_integraciones_config: { tipo: "mercadolibre", config: { access_token: "APP_USR-..." } }
import { createClient } from "@supabase/supabase-js";
import { PropExtNorm, normalizeTipo, normalizeOperacion, parseNum } from "./types";

const ML_API = "https://api.mercadolibre.com";
const ML_CATEGORY = "MLA1459"; // Inmuebles Argentina
const ML_SITE = "MLA";

// Bounding box de Rosario, Santa Fe (método oficial ML para inmuebles)
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

async function getMLAccessToken(): Promise<string | null> {
  // Primero: env vars de Vercel (más seguro)
  const envClientId = process.env.ML_CLIENT_ID;
  const envClientSecret = process.env.ML_CLIENT_SECRET;
  if (envClientId && envClientSecret) {
    return fetchMLToken(envClientId, envClientSecret);
  }

  // Fallback: crm_integraciones_config en Supabase
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await sb
      .from("crm_integraciones_config")
      .select("config")
      .eq("tipo", "mercadolibre")
      .eq("activo", true)
      .limit(1)
      .single();

    const cfg = data?.config as any;
    if (!cfg) return null;
    if (cfg.access_token) return cfg.access_token as string;
    if (cfg.client_id && cfg.client_secret) {
      return fetchMLToken(cfg.client_id, cfg.client_secret);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchMLToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/oauth/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
      { method: "POST", signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

function buildHeaders(accessToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-AR,es;q=0.9",
    "Referer": "https://www.mercadolibre.com.ar/",
    "Origin": "https://www.mercadolibre.com.ar",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}

async function fetchPageItems(
  url: string,
  headers: Record<string, string>
): Promise<{ items: any[]; total: number; httpError?: number }> {
  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { items: [], total: 0, httpError: res.status };
    const data = await res.json();
    return { items: data?.results ?? [], total: data?.paging?.total ?? 0 };
  } catch {
    return { items: [], total: 0, httpError: 0 };
  }
}

export async function syncMercadoLibre(maxItems = 300): Promise<PropExtNorm[]> {
  const perPage = 50;
  const accessToken = await getMLAccessToken();
  const headers = buildHeaders(accessToken);

  // Estrategias en orden de confiabilidad:
  // 1. item_location (bounding box) — método oficial ML para inmuebles
  // 2. city ID de Rosario (MLAC128755)
  // 3/4. state IDs candidatos de Santa Fe (12 chars — formato correcto)
  const strategies = [
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&item_location=lat:${ROSARIO_LAT},lon:${ROSARIO_LON}&limit=${perPage}`,
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&city=TUxBQUMxMjg3NTU&limit=${perPage}`,
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&state=TUxBUFNBTmU5Nzk2&limit=${perPage}`,
    `${ML_API}/sites/${ML_SITE}/search?category=${ML_CATEGORY}&state=TUxBUFNBTm5lYjU4&limit=${perPage}`,
  ];

  let lastError: string | null = null;

  for (const baseUrl of strategies) {
    const strategyResults: PropExtNorm[] = [];
    let offset = 0;

    while (strategyResults.length < maxItems) {
      const { items, total, httpError } = await fetchPageItems(
        `${baseUrl}&offset=${offset}`,
        headers
      );

      if (httpError !== undefined) {
        const hint = httpError === 403 && !accessToken
          ? " — registrar app en developers.mercadolibre.com.ar para obtener access_token"
          : "";
        lastError = httpError === 0
          ? "Error de red/timeout en ML API"
          : `HTTP ${httpError} en ML API${hint}`;
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
