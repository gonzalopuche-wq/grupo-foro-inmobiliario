// Argenprop scraper — extrae __NEXT_DATA__ JSON del HTML
// NOTA: Argenprop bloquea IPs de datacenter. Si retorna 0 es probable bloqueo.
// URL pattern: /departamentos/venta/rosario-pagina-N
import { PropExtNorm, normalizeTipo, parseNum, hasAmenity, normalizeAmenities } from "./types";

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
  // Intento 1: __NEXT_DATA__ estándar
  const m1 = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m1) { try { return JSON.parse(m1[1]); } catch {} }
  // Intento 2: window.__NEXT_DATA__ inline
  const m2 = html.match(/window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|window\.)/);
  if (m2) { try { return JSON.parse(m2[1]); } catch {} }
  // Intento 3: __INIT_STATE__ (algunos frameworks alternativos)
  const m3 = html.match(/window\.__INIT_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (m3) { try { const d = JSON.parse(m3[1]); return { props: { pageProps: d } }; } catch {} }
  return null;
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

  const amenities = normalizeAmenities([
    ...(item.amenities ?? []),
    ...(item.tags ?? []),
    ...(item.features ?? []),
    ...(item.services ?? []),
    ...(item.commonAreas ?? []),
  ]);

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
    toilettes: parseNum(item.toilettes ?? item.toilets ?? item.halfBathrooms),
    ambientes: parseNum(item.ambiences ?? item.totalRooms ?? item.environments),
    superficie_cubierta: parseNum(item.coveredSurface ?? item.coveredArea ?? item.superficie),
    sup_terreno: parseNum(item.totalSurface ?? item.totalArea),
    sup_semicubierta: parseNum(item.semiCoveredSurface ?? item.semiCoveredArea),
    sup_descubierta: parseNum(item.uncoveredSurface ?? item.uncoveredArea),
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

    // Características físicas
    orientacion: item.orientation ?? item.cardinalOrientation ?? null,
    piso: parseNum(item.floor ?? item.floorNumber),
    cocheras: parseNum(item.parkingLots ?? item.garage ?? item.parking),
    baulera: !!(item.storageRoom) || hasAmenity(amenities, "baulera", "storage"),
    antiguedad: item.antiquity != null ? String(item.antiquity) : null,

    // Condiciones
    amoblado: !!(item.furnished) || hasAmenity(amenities, "amoblado", "furnished"),
    acepta_mascotas: !!(item.petsAllowed) || hasAmenity(amenities, "mascotas", "pets"),
    apto_credito: !!(item.mortgageEligible) || hasAmenity(amenities, "crédito", "credito"),

    // Amenities edificio
    com_pileta: !!(item.pool) || hasAmenity(amenities, "pileta", "piscina", "pool"),
    com_gimnasio: !!(item.gym) || hasAmenity(amenities, "gimnasio", "gym"),
    com_sum: hasAmenity(amenities, "sum", "salón de usos"),
    com_ascensor: !!(item.elevator) || hasAmenity(amenities, "ascensor"),
    com_seguridad: !!(item.security) || hasAmenity(amenities, "seguridad", "vigilancia"),
    com_parrilla: hasAmenity(amenities, "parrilla", "bbq", "asador"),
    com_quincho: hasAmenity(amenities, "quincho"),
    com_solarium: hasAmenity(amenities, "solarium"),
    com_laundry: hasAmenity(amenities, "lavandería", "laundry", "lavanderia"),
    com_cowork: hasAmenity(amenities, "cowork", "coworking"),
    com_juegos_ninos: hasAmenity(amenities, "juegos", "playground", "infantil"),
    com_bicicletero: hasAmenity(amenities, "bicicletero", "bicicleta"),
    com_microcine: hasAmenity(amenities, "microcine", "cine"),
    com_sauna: hasAmenity(amenities, "sauna"),
    com_conserjeria: hasAmenity(amenities, "conserjería", "conserjeria"),
    com_portero_electrico: hasAmenity(amenities, "portero eléctrico", "portero electrico", "interphone"),
    com_wifi_comunes: hasAmenity(amenities, "wifi", "wi-fi", "internet"),
    com_espacio_verde: hasAmenity(amenities, "espacio verde", "parque"),

    // Ambientes propios
    amb_balcon: hasAmenity(amenities, "balcón", "balcon"),
    amb_terraza: hasAmenity(amenities, "terraza"),
    amb_jardin: hasAmenity(amenities, "jardín", "jardin"),
    amb_patio: hasAmenity(amenities, "patio"),

    // Clasificación
    disposicion: item.orientation ?? item.disposal ?? item.unitOrientation ?? null,
    tipo_unidad: item.unitType ?? item.propertySubtype ?? null,
    ocupacion: item.occupancy ?? item.situation ?? null,

    // Multimedia
    video_url: item.videoUrl ?? item.video ?? null,
    tour_virtual_url: item.virtualTour ?? item.tourUrl ?? null,

    // Agente
    agente_nombre: item.contact?.name ?? item.agent?.name ?? null,
    agente_telefono: item.contact?.phone ?? item.agent?.phone ?? null,
    agente_email: item.contact?.email ?? item.agent?.email ?? null,
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
          lastError = "Sin datos en HTML (estructura del portal cambió)";
          break; // sólo corta páginas de este combo; intenta el siguiente
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
