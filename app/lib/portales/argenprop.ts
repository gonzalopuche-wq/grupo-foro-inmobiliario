// Argenprop scraper — extrae __NEXT_DATA__ JSON del HTML
// NOTA: Argenprop bloquea IPs de datacenter. Si retorna 0 es probable bloqueo.
// URL pattern: /departamentos/venta/rosario-pagina-N
import { PropExtNorm, normalizeTipo, parseNum } from "./types";

const AP_BASE = "https://www.argenprop.com";
const AP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
  "Referer": "https://www.argenprop.com/",
};

const TIPOS = [
  { tipoSlug: "departamentos", tipo: "departamento" },
  { tipoSlug: "casas",         tipo: "casa" },
  { tipoSlug: "ph",            tipo: "ph" },
  { tipoSlug: "locales",       tipo: "local" },
  { tipoSlug: "terrenos",      tipo: "terreno" },
];
const OPS = [
  { opSlug: "venta",    operacion: "venta" },
  { opSlug: "alquiler", operacion: "alquiler" },
];

function extractNextData(html: string): any {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function extractListings(nextData: any): any[] {
  const pp = nextData?.props?.pageProps;
  const paths = [
    pp?.initialData?.listingResults,
    pp?.listingResults,
    pp?.searchResult?.listingResults,
    pp?.data?.listingResults,
    pp?.initialListings,
    pp?.listings,
    pp?.items,
    pp?.results,
  ];
  for (const p of paths) {
    if (Array.isArray(p) && p.length > 0) return p;
  }
  return [];
}

function normalizeAP(item: any, operacion: string, tipo: string): PropExtNorm {
  const price = item.priceFormatted ?? item.price;
  const precioNum = parseNum(
    typeof price === "object"
      ? price?.amount ?? price?.value
      : price
  );
  const monedaRaw = item.currency ?? item.priceFormatted?.currency ?? "USD";
  const moneda = monedaRaw === "ARS" || monedaRaw === "$" ? "ARS" : "USD";

  const imagenes: string[] = (item.photos ?? item.images ?? item.pictures ?? [])
    .map((p: any) => p.image ?? p.url ?? p.src ?? p)
    .filter((u: any) => typeof u === "string" && u.startsWith("http"));

  const rawId = item.id ?? item.listingId ?? item.postingId;
  if (!rawId) return null as any;

  return {
    portal_id: String(rawId),
    url: item.url ? `${AP_BASE}${item.url}` : (item.link ?? ""),
    titulo: item.title ?? item.headline ?? "",
    operacion,
    tipo: normalizeTipo(item.propertyType ?? item.type ?? tipo),
    precio: precioNum,
    moneda,
    dormitorios: parseNum(item.bedrooms ?? item.rooms),
    banos: parseNum(item.bathrooms),
    ambientes: parseNum(item.ambiences ?? item.totalRooms ?? item.environments),
    superficie_cubierta: parseNum(item.coveredSurface ?? item.coveredArea ?? item.superficie),
    sup_terreno: parseNum(item.totalSurface ?? item.totalArea),
    expensas: parseNum(item.expenses ?? item.expensas),
    barrio: item.neighborhood ?? item.location?.neighborhood ?? item.barrio ?? null,
    ciudad: item.city ?? item.location?.city ?? "Rosario",
    provincia: item.province ?? item.location?.province ?? "Santa Fe",
    direccion: item.address ?? item.direccion ?? null,
    lat: parseNum(item.lat ?? item.latitude ?? item.location?.lat),
    lng: parseNum(item.lng ?? item.longitude ?? item.location?.lng),
    imagenes,
    descripcion: item.description ?? item.fullDescription ?? null,
    datos_raw: {},
  };
}

async function fetchPage(url: string): Promise<{ items: any[]; httpStatus: number }> {
  try {
    const res = await fetch(url, {
      headers: AP_HEADERS,
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { items: [], httpStatus: res.status };
    const html = await res.text();
    const nextData = extractNextData(html);
    if (!nextData) return { items: [], httpStatus: -1 };
    return { items: extractListings(nextData), httpStatus: 200 };
  } catch {
    return { items: [], httpStatus: -2 };
  }
}

export async function syncArgenprop(maxPerCombo = 2): Promise<PropExtNorm[]> {
  const results: PropExtNorm[] = [];
  let lastError: string | null = null;

  outer: for (const { tipoSlug, tipo } of TIPOS) {
    for (const { opSlug, operacion } of OPS) {
      for (let page = 1; page <= maxPerCombo; page++) {
        const pageSuffix = page > 1 ? `-pagina-${page}` : "";
        const url = `${AP_BASE}/${tipoSlug}/${opSlug}/rosario${pageSuffix}`;
        const { items, httpStatus } = await fetchPage(url);

        if (httpStatus === 403 || httpStatus === 429 || httpStatus === 503) {
          lastError = `HTTP ${httpStatus} (bloqueado por Argenprop desde IPs de datacenter)`;
          break outer;
        }
        if (httpStatus === -1) {
          lastError = "Sin __NEXT_DATA__ en HTML (estructura del portal cambió)";
          break outer;
        }
        if (httpStatus === -2) {
          lastError = "Error de red al conectar con Argenprop";
          break outer;
        }
        if (!items.length) break;
        for (const item of items) {
          const norm = normalizeAP(item, operacion, tipo);
          if (norm && norm.portal_id && norm.portal_id !== "undefined") results.push(norm);
        }
        if (items.length < 20) break;
      }
    }
  }

  if (results.length === 0 && lastError) {
    throw new Error(`Argenprop: ${lastError}`);
  }

  return results;
}
