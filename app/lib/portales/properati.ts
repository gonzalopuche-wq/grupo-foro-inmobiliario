// Properati scraper — plataforma de LIFULL Connect (ahora parte del grupo ML)
// NOTA: Properati bloquea IPs de datacenter igual que Zonaprop/Argenprop.
import { PropExtNorm, normalizeTipo, parseNum } from "./types";

const PP_BASE = "https://www.properati.com.ar";
const PP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
  "Referer": "https://www.properati.com.ar/",
};

const SEARCHES = [
  { url: `${PP_BASE}/s/rosario/venta`,    operacion: "venta" },
  { url: `${PP_BASE}/s/rosario/alquiler`, operacion: "alquiler" },
];

function extractNextData(html: string): any {
  // Intento 1: __NEXT_DATA__ estándar
  const m1 = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m1) { try { return JSON.parse(m1[1]); } catch {} }
  // Intento 2: window.__NEXT_DATA__ inline
  const m2 = html.match(/window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|window\.)/);
  if (m2) { try { return JSON.parse(m2[1]); } catch {} }
  // Intento 3: __INIT_STATE__
  const m3 = html.match(/window\.__INIT_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (m3) { try { const d = JSON.parse(m3[1]); return { props: { pageProps: d } }; } catch {} }
  return null;
}

function extractListings(nextData: any): any[] {
  const pp = nextData?.props?.pageProps;
  const paths = [
    pp?.listings,
    pp?.initialData?.listings,
    pp?.searchResult?.listings,
    pp?.data?.listings,
    pp?.results,
    pp?.items,
  ];
  for (const p of paths) {
    if (Array.isArray(p) && p.length > 0) return p;
  }
  return [];
}

function normalizePP(item: any, operacion: string): PropExtNorm {
  const priceInfo = item.priceInformation ?? item.price ?? {};
  const imagenes: string[] = (item.photos ?? item.images ?? [])
    .map((p: any) => p.originalURL ?? p.url ?? p)
    .filter((u: any) => typeof u === "string" && u.startsWith("http"));

  return {
    portal_id: String(item.id ?? item.listingId),
    url: item.publicUrl ?? item.url ?? "",
    titulo: item.title ?? item.developmentName ?? "",
    operacion,
    tipo: normalizeTipo(item.propertyType ?? item.type),
    precio: parseNum(priceInfo.price ?? priceInfo.amount ?? item.price),
    moneda: (priceInfo.currency ?? "USD") === "ARS" ? "ARS" : "USD",
    dormitorios: parseNum(item.bedroomsAmount ?? item.bedrooms),
    banos: parseNum(item.bathroomsAmount ?? item.bathrooms),
    ambientes: parseNum(item.roomsAmount ?? item.rooms),
    superficie_cubierta: parseNum(item.coveredArea ?? item.totalArea),
    sup_terreno: parseNum(item.landArea),
    expensas: parseNum(item.expenses),
    barrio: item.geoLocation?.neighborhood ?? item.address?.neighborhood ?? null,
    ciudad: item.geoLocation?.city ?? "Rosario",
    provincia: "Santa Fe",
    direccion: item.address?.street ?? item.address?.addressLine ?? null,
    lat: parseNum(item.geoLocation?.lat ?? item.lat),
    lng: parseNum(item.geoLocation?.lon ?? item.lng),
    imagenes,
    descripcion: item.description ?? null,
    datos_raw: {},
  };
}

export async function syncProperati(): Promise<PropExtNorm[]> {
  const results: PropExtNorm[] = [];
  let lastError: string | null = null;

  for (const { url, operacion } of SEARCHES) {
    try {
      const res = await fetch(url, {
        headers: PP_HEADERS,
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status} (bloqueado por Properati desde IPs de datacenter)`;
        if (res.status === 403 || res.status === 429 || res.status === 503) break;
        continue;
      }
      const html = await res.text();
      const nextData = extractNextData(html);
      if (!nextData) {
        lastError = "Sin __NEXT_DATA__ en HTML (estructura del portal cambió)";
        continue;
      }
      const items = extractListings(nextData);
      for (const item of items) results.push(normalizePP(item, operacion));
    } catch (e: any) {
      lastError = e?.message ?? "Error de red";
    }
  }

  if (results.length === 0 && lastError) {
    throw new Error(`Properati: ${lastError}`);
  }

  return results;
}
