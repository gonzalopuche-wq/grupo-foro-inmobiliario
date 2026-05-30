// Zonaprop scraper — extrae __NEXT_DATA__ JSON del HTML
// NOTA: Zonaprop bloquea IPs de datacenter (Cloudflare). Si retorna 0 es probable bloqueo.
// URL pattern: /departamentos-venta-rosario-pagina-N.html
import { PropExtNorm, normalizeTipo, parseNum } from "./types";

const ZP_BASE = "https://www.zonaprop.com.ar";
const ZP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
  "Referer": "https://www.zonaprop.com.ar/",
};

const SLUGS = [
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

function extractPostings(nextData: any): any[] {
  const pp = nextData?.props?.pageProps;
  const paths = [
    pp?.initialData?.postings,
    pp?.listingData?.postings,
    pp?.data?.postings,
    pp?.postings,
    pp?.initialListings?.postings,
    pp?.searchResult?.postings,
  ];
  for (const p of paths) {
    if (Array.isArray(p) && p.length > 0) return p;
  }
  return [];
}

function normalizeZP(item: any, operacion: string, tipo: string): PropExtNorm {
  const posting = item.postingData ?? item;
  const priceData = posting.priceOperationTypes?.[0] ?? posting.prices?.[0] ?? {};
  const precio = parseNum(priceData.price ?? posting.price);
  const moneda = (priceData.currency ?? posting.currency ?? "USD") === "ARS" ? "ARS" : "USD";

  const mainFeatures = posting.mainFeatures ?? posting.features ?? {};
  const location = posting.postingLocation ?? posting.location ?? {};
  const geo = location.postingGeolocation ?? location.geolocation ?? {};

  const imagenes: string[] = (posting.postingGallery ?? posting.photos ?? posting.pictures ?? [])
    .map((p: any) => p.url ?? p.image ?? p)
    .filter((u: any) => typeof u === "string" && u.startsWith("http"));

  return {
    portal_id: String(item.postingId ?? item.id ?? posting.id),
    url: `${ZP_BASE}${posting.url ?? item.url ?? ""}`,
    titulo: posting.title ?? item.title ?? "",
    operacion,
    tipo: normalizeTipo(posting.realEstateType?.name ?? tipo),
    precio,
    moneda,
    dormitorios: parseNum(mainFeatures.BEDROOMS?.value ?? mainFeatures.rooms),
    banos: parseNum(mainFeatures.BATHROOMS?.value ?? mainFeatures.bathrooms),
    ambientes: parseNum(mainFeatures.ROOMS?.value ?? mainFeatures.environments),
    superficie_cubierta: parseNum(mainFeatures.COVERED_AREA?.value ?? mainFeatures.coveredArea),
    sup_terreno: parseNum(mainFeatures.TOTAL_AREA?.value ?? mainFeatures.totalArea),
    expensas: parseNum(priceData.expenses ?? posting.expenses),
    barrio: location.subdivision?.name ?? location.neighborhood ?? null,
    ciudad: location.city?.name ?? location.location?.city ?? "Rosario",
    provincia: location.state?.name ?? "Santa Fe",
    direccion: posting.address ?? location.address ?? null,
    lat: parseNum(geo.latitude),
    lng: parseNum(geo.longitude),
    imagenes,
    descripcion: posting.description ?? null,
    datos_raw: {},
  };
}

async function fetchPage(url: string): Promise<{ items: any[]; httpStatus: number }> {
  try {
    const res = await fetch(url, {
      headers: ZP_HEADERS,
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { items: [], httpStatus: res.status };
    const html = await res.text();
    const nextData = extractNextData(html);
    if (!nextData) return { items: [], httpStatus: -1 }; // -1 = sin __NEXT_DATA__
    return { items: extractPostings(nextData), httpStatus: 200 };
  } catch (e: any) {
    return { items: [], httpStatus: -2 }; // -2 = error de red
  }
}

export async function syncZonaprop(maxPerCombo = 2): Promise<PropExtNorm[]> {
  const results: PropExtNorm[] = [];
  let lastError: string | null = null;

  for (const { tipoSlug, tipo } of SLUGS) {
    for (const { opSlug, operacion } of OPS) {
      for (let page = 1; page <= maxPerCombo; page++) {
        const suffix = page > 1 ? `-pagina-${page}` : "";
        const url = `${ZP_BASE}/${tipoSlug}-${opSlug}-rosario${suffix}.html`;
        const { items, httpStatus } = await fetchPage(url);

        if (httpStatus === 403 || httpStatus === 429 || httpStatus === 503) {
          lastError = `HTTP ${httpStatus} (bloqueado por Zonaprop desde IPs de datacenter)`;
          break;
        }
        if (httpStatus === -1) {
          lastError = "Sin __NEXT_DATA__ en HTML (estructura del portal cambió)";
          break;
        }
        if (httpStatus === -2) {
          lastError = "Error de red al conectar con Zonaprop";
          break;
        }
        if (!items.length) break;
        for (const item of items) results.push(normalizeZP(item, operacion, tipo));
        if (items.length < 20) break;
      }
    }
  }

  if (results.length === 0 && lastError) {
    throw new Error(`Zonaprop: ${lastError}`);
  }

  return results;
}
