// Sync global de Kiteprop: recorre todas las API keys de la red GFI
// y trae las propiedades de cada corredor a propiedades_externas
import { createClient } from "@supabase/supabase-js";
import { PropExtNorm, normalizeTipo, normalizeOperacion, parseNum, hasAmenity, normalizeAmenities } from "./types";
import { extraerPublicaciones } from "./portal_urls";

const KP_BASE = "https://www.kiteprop.com/api/v1";

const KP_TIPO: Record<string, string> = {
  apartments: "departamento", houses: "casa", ph: "ph", duplex: "casa",
  offices: "oficina", locals: "local", land: "terreno", parking: "cochera",
  warehouses: "galpón", buildings: "edificio", field: "campo", shop: "local",
};

function normalizarKP(kp: Record<string, any>): PropExtNorm {
  const imgs: string[] = (kp.images_list ?? kp.photos ?? kp.images ?? kp.fotos ?? [])
    .map((i: any) => {
      if (!i) return "";
      if (typeof i === "string") return i;
      return i.lg ?? i.original ?? i.url ?? i.image ?? i.src ?? i.thumb ?? "";
    })
    .filter((u: string) => !!u && u.startsWith("http"));

  const operacion = kp.for_sale && kp.for_rent
    ? "venta"
    : kp.for_rent ? "alquiler" : "venta";
  const precio = parseNum(kp.for_sale_price ?? kp.for_rent_price ?? kp.price);
  const geo = kp.geo ?? kp.location ?? {};

  const rawId = kp.id ?? kp.internal_id ?? kp.portal_id;
  if (!rawId) return null as any;

  // Normalizar amenities desde múltiples campos posibles de la API
  const amenities = normalizeAmenities([
    ...(kp.amenities ?? []),
    ...(kp.features ?? []),
    ...(kp.tags ?? []),
    ...(kp.characteristics ?? []),
    ...(kp.extras ?? []),
  ]);

  // Agente / corredor que publicó
  const agente = kp.agent ?? kp.contact ?? kp.broker ?? kp.user ?? {};

  // Antigüedad: puede venir como años, año de construcción, o texto
  let antiguedad: string | null = null;
  if (kp.age != null) antiguedad = String(kp.age);
  else if (kp.antiquity != null) antiguedad = String(kp.antiquity);
  else if (kp.year_built != null) antiguedad = String(new Date().getFullYear() - Number(kp.year_built)) + " años";
  else if (kp.construction_year != null) antiguedad = String(kp.construction_year);

  return {
    portal_id: String(rawId),
    url: kp.url ?? kp.web_url ?? "",
    titulo: kp.title ?? kp.address ?? "",
    operacion,
    tipo: KP_TIPO[kp.type ?? ""] ?? normalizeTipo(kp.type),
    precio,
    moneda: ((kp.currency ?? "usd").toUpperCase() === "ARS") ? "ARS" : "USD",
    dormitorios: parseNum(kp.bedrooms ?? kp.suites),
    banos: parseNum(kp.bathrooms),
    ambientes: parseNum(kp.rooms ?? kp.environments ?? kp.total_rooms),
    superficie_cubierta: parseNum(kp.covered_meters ?? kp.covered_area ?? kp.built_area),
    sup_terreno: parseNum(kp.total_meters ?? kp.total_area ?? kp.lot_size),
    sup_semicubierta: parseNum(kp.semi_covered_area ?? kp.semi_covered_meters),
    sup_descubierta: parseNum(kp.uncovered_area ?? kp.uncovered_meters ?? kp.outdoor_area),
    expensas: parseNum(kp.expenses ?? kp.expensas ?? kp.maintenance),
    barrio: kp.neighborhood ?? kp.zone ?? kp.suburb ?? null,
    ciudad: kp.city ?? "Rosario",
    provincia: kp.state ?? kp.province ?? "Santa Fe",
    direccion: kp.address ?? kp.street ?? null,
    lat: parseNum(geo.lat ?? geo.latitude ?? kp.lat ?? kp.latitude),
    lng: parseNum(geo.lon ?? geo.lng ?? geo.longitude ?? kp.lng ?? kp.longitude),
    imagenes: imgs,
    descripcion: kp.description ?? kp.details ?? null,
    datos_raw: { kp_id: kp.id, kp_status: kp.status },

    // Características físicas
    orientacion: kp.orientation ?? kp.cardinal_orientation ?? null,
    piso: parseNum(kp.floor ?? kp.floor_number ?? kp.floor_level),
    cocheras: parseNum(kp.parking ?? kp.parking_spaces ?? kp.garage ?? kp.garage_count ?? kp.parking_lots),
    baulera: !!(kp.storage_room ?? kp.cellar ?? kp.baulera) || hasAmenity(amenities, "baulera", "storage"),
    antiguedad,

    // Condiciones
    amoblado: !!(kp.furnished ?? kp.is_furnished) || hasAmenity(amenities, "amoblado", "furnished", "mobiliado"),
    acepta_mascotas: !!(kp.pets_allowed ?? kp.allows_pets) || hasAmenity(amenities, "mascotas", "pets", "animales"),
    apto_credito: !!(kp.mortgage ?? kp.is_mortgage_eligible ?? kp.accepts_credit) || hasAmenity(amenities, "crédito", "credito", "hipoteca", "mortgage"),

    // Amenities edificio
    com_pileta: !!(kp.pool ?? kp.swimming_pool) || hasAmenity(amenities, "pileta", "piscina", "pool", "natación"),
    com_gimnasio: !!(kp.gym ?? kp.fitness) || hasAmenity(amenities, "gimnasio", "gym", "fitness"),
    com_sum: !!(kp.event_room ?? kp.sum) || hasAmenity(amenities, "sum", "salón de usos", "salon de usos"),
    com_ascensor: !!(kp.elevator ?? kp.lift) || hasAmenity(amenities, "ascensor", "elevator", "lift"),
    com_seguridad: !!(kp.security ?? kp.surveillance) || hasAmenity(amenities, "seguridad", "security", "vigilancia", "portería", "portero"),
    com_parrilla: !!(kp.barbecue ?? kp.bbq) || hasAmenity(amenities, "parrilla", "bbq", "barbecue", "asador"),
    com_quincho: hasAmenity(amenities, "quincho"),
    com_solarium: !!(kp.solarium) || hasAmenity(amenities, "solarium", "solárium"),
    com_laundry: !!(kp.laundry) || hasAmenity(amenities, "lavandería", "laundry", "lavanderia"),
    com_cowork: !!(kp.coworking) || hasAmenity(amenities, "cowork", "coworking", "business center"),
    com_juegos_ninos: hasAmenity(amenities, "juegos", "playground", "niños", "ninos", "infantil"),
    com_estac_visit: hasAmenity(amenities, "visitas", "visitors", "estacionamiento visita"),

    // Ambientes propios
    amb_balcon: !!(kp.has_balcony ?? kp.balcony) || hasAmenity(amenities, "balcón", "balcon", "balcony"),
    amb_terraza: !!(kp.has_terrace ?? kp.terrace) || hasAmenity(amenities, "terraza", "terrace", "rooftop", "azotea"),
    amb_jardin: !!(kp.has_garden ?? kp.garden) || hasAmenity(amenities, "jardín", "jardin", "garden"),
    amb_patio: !!(kp.has_patio ?? kp.patio) || hasAmenity(amenities, "patio"),

    // Multimedia
    video_url: kp.video_url ?? kp.video ?? kp.youtube_url ?? null,
    tour_virtual_url: kp.virtual_tour_url ?? kp.virtual_tour ?? kp.matterport ?? kp.tour_url ?? null,

    // Agente
    agente_nombre: agente.name ?? agente.full_name ?? agente.nombre ?? null,
    agente_telefono: agente.phone ?? agente.mobile ?? agente.telefono ?? agente.cel ?? null,
    agente_email: agente.email ?? agente.correo ?? null,
  };
}

async function fetchAllKP(apiKey: string, baseUrl = KP_BASE): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [];
  let page = 1;
  let inferredPageSize: number | null = null;
  while (true) {
    const res = await fetch(`${baseUrl}/properties/?page=${page}&page_size=100`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
      next: { revalidate: 0 },
    });
    if (!res.ok) break;
    const json = await res.json();
    const rows: Record<string, any>[] = Array.isArray(json.results)
      ? json.results
      : Array.isArray(json.data) ? json.data
      : Array.isArray(json) ? json : [];
    if (!rows.length) break;
    all.push(...rows);
    const total = json.count ?? json.total ?? json.total_count ?? null;
    const hasNextUrl = !!json.next;
    const hasMoreByCount = total !== null && all.length < total;
    if (inferredPageSize === null) inferredPageSize = rows.length;
    const hasFullPage = rows.length >= inferredPageSize;
    if (!hasNextUrl && !hasMoreByCount && !hasFullPage) break;
    if (total !== null && all.length >= total) break;
    page++;
    if (page > 200) break;
  }
  return all;
}

export interface KPSyncResult {
  items: PropExtNorm[];
  publicaciones: Array<PropExtNorm & { _portal: string; _portal_id: string; _url: string }>;
}

export async function syncKitepropRed(): Promise<KPSyncResult> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: creds }, { data: configs }] = await Promise.all([
    sb.from("portal_credenciales").select("kiteprop_key").not("kiteprop_key", "is", null),
    sb.from("crm_integraciones_config").select("config,activo")
      .eq("tipo", "kiteprop").eq("activo", true),
  ]);

  const apiKeys = new Set<string>();
  for (const c of creds ?? []) {
    if (c.kiteprop_key) apiKeys.add(c.kiteprop_key);
  }
  for (const c of configs ?? []) {
    const key = (c.config as Record<string, string> | null)?.api_key;
    const url = (c.config as Record<string, string> | null)?.base_url;
    if (key) apiKeys.add(key + (url ? `|${url}` : ""));
  }

  const items: PropExtNorm[] = [];
  const publicaciones: Array<PropExtNorm & { _portal: string; _portal_id: string; _url: string }> = [];
  const seenIds = new Set<string>();

  for (const keyEntry of apiKeys) {
    const [apiKey, baseUrlPart] = keyEntry.split("|");
    const baseUrl = baseUrlPart || KP_BASE;
    try {
      const props = await fetchAllKP(apiKey, baseUrl);
      for (const kp of props) {
        const norm = normalizarKP(kp);
        if (!norm || !norm.portal_id || norm.portal_id === "undefined") continue;
        if (!seenIds.has(norm.portal_id)) {
          seenIds.add(norm.portal_id);
          items.push(norm);
        }
        const pubs = extraerPublicaciones(kp);
        for (const pub of pubs) {
          publicaciones.push({
            ...norm,
            _portal: pub.portal,
            _portal_id: pub.portal_id,
            _url: pub.url,
          });
        }
      }
    } catch {
      // Key inválida o timeout — continuar con las demás
    }
  }

  return { items, publicaciones };
}
