// Sync Propia.com.ar — feed de propiedades publicadas en la Red MLS y en el Portal
import { createClient } from "@supabase/supabase-js";
import { PropExtNorm, normalizeTipo, normalizeOperacion, parseNum, hasAmenity, normalizeAmenities } from "./types";

const PROPIA_BASE = (process.env.PROPIA_API_BASE ?? "https://propia.com.ar/api").replace(/\/$/, "");

interface PropiaFeedItem {
  id: number;
  title?: string;
  address_to_show?: string;
  price?: string | number;
  area?: number;
  covered_area?: number;
  total_area?: number;
  semi_covered_area?: number;
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  rooms?: number;
  parking_lots?: number;
  storage_room?: boolean;
  floor?: number | string;
  orientation?: string;
  disposition?: string;
  unit_type?: string;
  occupancy?: string;
  age?: number | string;
  furnished?: boolean;
  pets_allowed?: boolean;
  mortgage_eligible?: boolean;
  lat?: number | string;
  lng?: number | string;
  slug?: string;
  description?: string;
  video_url?: string;
  virtual_tour_url?: string;
  published_on_mls?: boolean;
  published_on_portal?: boolean;
  currency?: { id?: number; symbol?: string; iso?: string };
  type?: string;
  type_id?: { name?: string };
  operation?: string;
  operation_id?: { name?: string };
  city?: string;
  neighborhood?: string;
  province?: string;
  images?: { url_do?: string; url_thumb_do?: string }[];
  amenities?: unknown[];
  tags?: unknown[];
  agent?: { name?: string; phone?: string; email?: string };
}

function normalizarPropia(item: PropiaFeedItem): PropExtNorm {
  const imgs: string[] = (item.images ?? [])
    .map(i => i?.url_do ?? i?.url_thumb_do ?? "")
    .filter(u => !!u && u.startsWith("http"));

  const currency = (item.currency?.iso ?? item.currency?.symbol ?? "USD").toUpperCase();
  const rawTipo = item.type_id?.name ?? item.type ?? "";
  const rawOp   = item.operation_id?.name ?? item.operation ?? "venta";

  const amenities = normalizeAmenities([
    ...(item.amenities ?? []),
    ...(item.tags ?? []),
  ]);

  return {
    portal_id: String(item.id),
    url: item.slug ? `https://propia.com.ar/propiedades/${item.slug}` : "",
    titulo: item.title ?? item.address_to_show ?? "",
    operacion: normalizeOperacion(rawOp),
    tipo: normalizeTipo(rawTipo),
    precio: parseNum(item.price),
    moneda: currency === "ARS" ? "ARS" : "USD",
    dormitorios: parseNum(item.bedrooms),
    banos: parseNum(item.bathrooms),
    toilettes: parseNum(item.toilets),
    ambientes: parseNum(item.rooms),
    superficie_cubierta: parseNum(item.covered_area ?? item.area),
    sup_terreno: parseNum(item.total_area),
    sup_semicubierta: parseNum(item.semi_covered_area),
    expensas: null,
    barrio: item.neighborhood ?? null,
    ciudad: item.city ?? "Rosario",
    provincia: item.province ?? "Santa Fe",
    direccion: item.address_to_show ?? null,
    lat: parseNum(item.lat),
    lng: parseNum(item.lng),
    imagenes: imgs,
    descripcion: item.description ?? null,
    datos_raw: { propia_id: item.id, slug: item.slug },

    // Características físicas
    orientacion: item.orientation ?? null,
    piso: parseNum(item.floor),
    cocheras: parseNum(item.parking_lots),
    baulera: !!(item.storage_room) || hasAmenity(amenities, "baulera"),
    antiguedad: item.age != null ? String(item.age) : null,

    // Condiciones
    amoblado: !!(item.furnished) || hasAmenity(amenities, "amoblado", "furnished"),
    acepta_mascotas: !!(item.pets_allowed) || hasAmenity(amenities, "mascotas"),
    apto_credito: !!(item.mortgage_eligible) || hasAmenity(amenities, "crédito", "credito"),

    // Amenities edificio
    com_pileta: hasAmenity(amenities, "pileta", "piscina"),
    com_gimnasio: hasAmenity(amenities, "gimnasio"),
    com_sum: hasAmenity(amenities, "sum"),
    com_ascensor: hasAmenity(amenities, "ascensor"),
    com_seguridad: hasAmenity(amenities, "seguridad", "vigilancia"),
    com_parrilla: hasAmenity(amenities, "parrilla", "bbq"),
    com_quincho: hasAmenity(amenities, "quincho"),
    com_solarium: hasAmenity(amenities, "solarium"),
    com_laundry: hasAmenity(amenities, "lavandería", "laundry", "lavanderia"),
    com_cowork: hasAmenity(amenities, "cowork"),
    com_juegos_ninos: hasAmenity(amenities, "juegos", "infantil"),
    com_bicicletero: hasAmenity(amenities, "bicicletero"),
    com_microcine: hasAmenity(amenities, "microcine", "cine"),
    com_sauna: hasAmenity(amenities, "sauna"),
    com_conserjeria: hasAmenity(amenities, "conserjería", "conserjeria"),
    com_portero_electrico: hasAmenity(amenities, "portero eléctrico", "portero electrico"),
    com_wifi_comunes: hasAmenity(amenities, "wifi"),
    com_espacio_verde: hasAmenity(amenities, "espacio verde"),

    // Ambientes propios
    amb_balcon: hasAmenity(amenities, "balcón", "balcon"),
    amb_terraza: hasAmenity(amenities, "terraza"),
    amb_jardin: hasAmenity(amenities, "jardín", "jardin"),
    amb_patio: hasAmenity(amenities, "patio"),

    // Multimedia
    video_url: item.video_url ?? null,
    tour_virtual_url: item.virtual_tour_url ?? null,

    // Clasificación
    disposicion: item.disposition ?? null,
    tipo_unidad: item.unit_type ?? null,
    ocupacion: item.occupancy ?? null,

    // Agente
    agente_nombre: item.agent?.name ?? null,
    agente_telefono: item.agent?.phone ?? null,
    agente_email: item.agent?.email ?? null,
  };
}

async function fetchFeedPropia(apiKey: string): Promise<PropiaFeedItem[]> {
  const all: PropiaFeedItem[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await fetch(`${PROPIA_BASE}/properties/feed?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
      next: { revalidate: 0 },
    });
    if (!res.ok) break;
    const json = await res.json();
    const rows: PropiaFeedItem[] = Array.isArray(json.data) ? json.data
      : Array.isArray(json.results) ? json.results
      : Array.isArray(json) ? json : [];
    if (!rows.length) break;
    all.push(...rows);
    const total = json.count ?? json.total ?? null;
    if (total !== null && all.length >= total) break;
    if (rows.length < limit) break;
    offset += limit;
    if (offset > 10_000) break;
  }
  return all;
}

export interface PropiaSyncResult {
  mls: PropExtNorm[];
  portal: PropExtNorm[];
}

export async function syncPropiaRed(): Promise<PropiaSyncResult> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: creds }, { data: configs }] = await Promise.all([
    sb.from("portal_credenciales").select("propia_api_key").not("propia_api_key", "is", null),
    sb.from("crm_integraciones_config").select("config,activo").eq("tipo", "propia").eq("activo", true),
  ]);

  const apiKeys = new Set<string>();
  for (const c of creds ?? []) {
    if (c.propia_api_key) apiKeys.add(c.propia_api_key);
  }
  for (const c of configs ?? []) {
    const key = (c.config as Record<string, string> | null)?.api_key;
    if (key) apiKeys.add(key);
  }

  const mls: PropExtNorm[] = [];
  const portal: PropExtNorm[] = [];
  const seenMls = new Set<string>();
  const seenPortal = new Set<string>();

  for (const apiKey of apiKeys) {
    try {
      const items = await fetchFeedPropia(apiKey);
      for (const item of items) {
        const norm = normalizarPropia(item);
        if (item.published_on_mls && !seenMls.has(norm.portal_id)) {
          seenMls.add(norm.portal_id);
          mls.push(norm);
        }
        if (item.published_on_portal && !seenPortal.has(norm.portal_id)) {
          seenPortal.add(norm.portal_id);
          portal.push(norm);
        }
      }
    } catch {
      // Key inválida o timeout — continuar con las demás
    }
  }

  return { mls, portal };
}
