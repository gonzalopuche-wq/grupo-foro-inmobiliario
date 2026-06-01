// Zonaprop scraper — extrae __NEXT_DATA__ JSON del HTML
// NOTA: Zonaprop bloquea IPs de datacenter (Cloudflare). Si retorna 0 es probable bloqueo.
// URL pattern: /departamentos-venta-rosario-pagina-N.html
import { PropExtNorm, normalizeTipo, parseNum, hasAmenity, normalizeAmenities } from "./types";

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

  const rawId = item.postingId ?? item.id ?? posting.id;
  if (!rawId) return null as any;

  const amenities = normalizeAmenities([
    ...(posting.tags ?? []),
    ...(posting.amenities ?? []),
    ...(posting.generalFeatures ?? []),
    ...(posting.services ?? []),
  ]);

  // Disposición: Zonaprop lo expone en características principales
  const disposicionRaw: string = mainFeatures.PROPERTY_ORIENTATION?.label
    ?? mainFeatures.ORIENTATION?.label
    ?? posting.orientation
    ?? posting.disposal
    ?? null;

  return {
    portal_id: String(rawId),
    url: `${ZP_BASE}${posting.url ?? item.url ?? ""}`,
    titulo: posting.title ?? item.title ?? "",
    operacion,
    tipo: normalizeTipo(posting.realEstateType?.name ?? tipo),
    precio,
    moneda,
    dormitorios: parseNum(mainFeatures.BEDROOMS?.value ?? mainFeatures.rooms),
    banos: parseNum(mainFeatures.BATHROOMS?.value ?? mainFeatures.bathrooms),
    toilettes: parseNum(mainFeatures.TOILETTES?.value ?? mainFeatures.toilets ?? posting.toilettes),
    ambientes: parseNum(mainFeatures.ROOMS?.value ?? mainFeatures.environments),
    superficie_cubierta: parseNum(mainFeatures.COVERED_AREA?.value ?? mainFeatures.coveredArea),
    sup_terreno: parseNum(mainFeatures.TOTAL_AREA?.value ?? mainFeatures.totalArea),
    sup_semicubierta: parseNum(mainFeatures.SEMI_COVERED_AREA?.value),
    sup_descubierta: parseNum(mainFeatures.UNCOVERED_AREA?.value),
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

    // Características físicas
    orientacion: posting.cardinal ?? posting.cardinalDirection ?? null,
    piso: parseNum(posting.floor ?? posting.floorNumber),
    cocheras: parseNum(mainFeatures.PARKING?.value ?? posting.parkingLots),
    baulera: hasAmenity(amenities, "baulera", "storage"),
    antiguedad: posting.antiquity != null ? String(posting.antiquity) : null,

    // Condiciones
    amoblado: hasAmenity(amenities, "amoblado", "furnished"),
    acepta_mascotas: hasAmenity(amenities, "mascotas", "pets"),
    apto_credito: hasAmenity(amenities, "crédito", "credito", "hipoteca"),

    // Amenities edificio
    com_pileta: hasAmenity(amenities, "pileta", "piscina", "pool"),
    com_gimnasio: hasAmenity(amenities, "gimnasio", "gym"),
    com_sum: hasAmenity(amenities, "sum", "salón de usos"),
    com_ascensor: hasAmenity(amenities, "ascensor", "elevator"),
    com_seguridad: hasAmenity(amenities, "seguridad", "vigilancia", "portero"),
    com_parrilla: hasAmenity(amenities, "parrilla", "bbq", "asador"),
    com_quincho: hasAmenity(amenities, "quincho"),
    com_solarium: hasAmenity(amenities, "solarium"),
    com_laundry: hasAmenity(amenities, "lavandería", "laundry", "lavanderia"),
    com_cowork: hasAmenity(amenities, "cowork", "coworking"),
    com_juegos_ninos: hasAmenity(amenities, "juegos", "playground", "infantil"),
    com_bicicletero: hasAmenity(amenities, "bicicletero", "bicicleta"),
    com_microcine: hasAmenity(amenities, "microcine", "cine", "cinema"),
    com_sauna: hasAmenity(amenities, "sauna"),
    com_conserjeria: hasAmenity(amenities, "conserjería", "conserjeria"),
    com_portero_electrico: hasAmenity(amenities, "portero eléctrico", "portero electrico", "interphone"),
    com_wifi_comunes: hasAmenity(amenities, "wifi", "wi-fi", "internet comunes"),
    com_espacio_verde: hasAmenity(amenities, "espacio verde", "parque", "jardín común"),

    // Ambientes propios
    amb_balcon: hasAmenity(amenities, "balcón", "balcon"),
    amb_terraza: hasAmenity(amenities, "terraza"),
    amb_jardin: hasAmenity(amenities, "jardín", "jardin"),
    amb_patio: hasAmenity(amenities, "patio"),

    // Clasificación
    disposicion: disposicionRaw ?? null,
    tipo_unidad: posting.unitType ?? null,
    ocupacion: posting.occupancy ?? null,
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

  outer: for (const { tipoSlug, tipo } of SLUGS) {
    for (const { opSlug, operacion } of OPS) {
      for (let page = 1; page <= maxPerCombo; page++) {
        const suffix = page > 1 ? `-pagina-${page}` : "";
        const url = `${ZP_BASE}/${tipoSlug}-${opSlug}-rosario${suffix}.html`;
        const { items, httpStatus } = await fetchPage(url);

        if (httpStatus === 403 || httpStatus === 429 || httpStatus === 503) {
          lastError = `HTTP ${httpStatus} (bloqueado por Zonaprop desde IPs de datacenter)`;
          break outer;
        }
        if (httpStatus === -1) {
          lastError = "Sin __NEXT_DATA__ en HTML (estructura del portal cambió)";
          break outer;
        }
        if (httpStatus === -2) {
          lastError = "Error de red al conectar con Zonaprop";
          break outer;
        }
        if (!items.length) break;
        for (const item of items) {
          const norm = normalizeZP(item, operacion, tipo);
          if (norm && norm.portal_id && norm.portal_id !== "undefined") results.push(norm);
        }
        if (items.length < 20) break;
      }
    }
  }

  if (results.length === 0 && lastError) {
    throw new Error(`Zonaprop: ${lastError}`);
  }

  return results;
}
