// Sync global de Tokko Broker: recorre todas las API keys de la red GFI
import { createClient } from "@supabase/supabase-js";
import { PropExtNorm, normalizeTipo, parseNum, hasAmenity, normalizeAmenities } from "./types";
import { extraerPublicaciones } from "./portal_urls";

const TOKKO_BASE = "https://www.tokkobroker.com/api/v1";

function getTipoTokko(tipo: string | null | undefined): string {
  if (!tipo) return "otro";
  const t = tipo.toLowerCase();
  if (t.includes("depart") || t.includes("apartm") || t.includes("flat")) return "departamento";
  if (t.includes("ph")) return "ph";
  if (t.includes("casa") || t.includes("house") || t.includes("chalet")) return "casa";
  if (t.includes("local") || t.includes("comerci")) return "local";
  if (t.includes("oficin") || t.includes("office")) return "oficina";
  if (t.includes("terreno") || t.includes("lote") || t.includes("land")) return "terreno";
  if (t.includes("cochera") || t.includes("garage")) return "cochera";
  if (t.includes("galp") || t.includes("depósito") || t.includes("bodegas")) return "galpón";
  return normalizeTipo(tipo);
}

function normalizarTokko(t: Record<string, any>): PropExtNorm {
  // Tokko separa operaciones en array (venta/alquiler por precio)
  const ops: any[] = t.operations ?? [];
  const ventaOp = ops.find((o: any) => (o.operation_type ?? "").toLowerCase().includes("venta"));
  const alqOp = ops.find((o: any) => (o.operation_type ?? "").toLowerCase().includes("alquiler"));
  const op = ventaOp ?? alqOp;
  const operacion = ventaOp ? "venta" : alqOp ? "alquiler" : "venta";
  const precio = parseNum(op?.prices?.[0]?.price ?? op?.price ?? t.web_price);
  const moneda = (op?.prices?.[0]?.currency ?? op?.currency ?? t.web_currency ?? "USD") === "ARS" ? "ARS" : "USD";

  const loc = t.location ?? {};
  const imagenes: string[] = (t.photos ?? t.images ?? [])
    .map((p: any) => p.image ?? p.url ?? p)
    .filter((u: any) => typeof u === "string" && u.startsWith("http"));

  // Tags y amenities de Tokko
  const amenities = normalizeAmenities([
    ...(t.tags ?? []),
    ...(t.amenities ?? []),
    ...(t.features ?? []),
  ]);

  const agente = t.contact ?? t.agent ?? t.broker ?? {};

  return {
    portal_id: String(t.id),
    url: t.web_url ?? t.url ?? "",
    titulo: t.publication_title ?? t.title ?? t.address ?? "",
    operacion,
    tipo: getTipoTokko(t.type?.code ?? t.type?.name ?? t.property_type),
    precio,
    moneda,
    dormitorios: parseNum(t.suite_amount ?? t.bedrooms),
    banos: parseNum(t.bathroom_amount ?? t.bathrooms),
    ambientes: parseNum(t.room_amount ?? t.rooms),
    superficie_cubierta: parseNum(t.covered_area ?? t.total_surface),
    sup_terreno: parseNum(t.total_area ?? t.surface),
    sup_semicubierta: parseNum(t.semi_covered_area),
    sup_descubierta: parseNum(t.uncovered_area),
    expensas: parseNum(t.expenses),
    barrio: loc.neighbourhood ?? loc.neighborhood ?? loc.zone ?? null,
    ciudad: loc.city?.name ?? loc.city ?? "Rosario",
    provincia: loc.state?.name ?? loc.state ?? "Santa Fe",
    direccion: loc.address ?? t.address ?? null,
    lat: parseNum(loc.lat ?? loc.latitude ?? t.latitude),
    lng: parseNum(loc.lon ?? loc.longitude ?? t.longitude),
    imagenes,
    descripcion: t.description ?? t.details?.en ?? null,
    datos_raw: { tokko_id: t.id, type_code: t.type?.code },

    // Características físicas
    orientacion: t.orientation ?? null,
    piso: parseNum(t.floor ?? t.floor_number),
    cocheras: parseNum(t.parking_lot_amount ?? t.garage ?? t.parking),
    baulera: !!(t.storage_room) || hasAmenity(amenities, "baulera", "storage"),
    antiguedad: t.age != null ? String(t.age) : null,

    // Condiciones
    amoblado: !!(t.furnished) || hasAmenity(amenities, "amoblado", "furnished"),
    acepta_mascotas: !!(t.pets_allowed) || hasAmenity(amenities, "mascotas", "pets"),
    apto_credito: !!(t.is_mortgage_eligible) || hasAmenity(amenities, "crédito", "credito", "hipoteca"),

    // Amenities
    com_pileta: !!(t.pool) || hasAmenity(amenities, "pileta", "piscina", "pool"),
    com_gimnasio: !!(t.gym) || hasAmenity(amenities, "gimnasio", "gym"),
    com_sum: hasAmenity(amenities, "sum", "salón de usos", "salon"),
    com_ascensor: !!(t.elevator) || hasAmenity(amenities, "ascensor", "elevator"),
    com_seguridad: !!(t.security) || hasAmenity(amenities, "seguridad", "security", "vigilancia"),
    com_parrilla: hasAmenity(amenities, "parrilla", "bbq", "barbecue", "asador"),
    com_quincho: hasAmenity(amenities, "quincho"),
    com_solarium: hasAmenity(amenities, "solarium", "solárium"),
    com_laundry: hasAmenity(amenities, "lavandería", "laundry", "lavanderia"),
    com_cowork: hasAmenity(amenities, "cowork", "coworking"),
    com_juegos_ninos: hasAmenity(amenities, "juegos", "playground", "niños", "infantil"),
    com_estac_visit: hasAmenity(amenities, "visitas", "visitors"),

    // Ambientes
    amb_balcon: hasAmenity(amenities, "balcón", "balcon", "balcony"),
    amb_terraza: hasAmenity(amenities, "terraza", "terrace"),
    amb_jardin: hasAmenity(amenities, "jardín", "jardin", "garden"),
    amb_patio: hasAmenity(amenities, "patio"),

    // Multimedia
    video_url: t.video_url ?? t.video ?? null,
    tour_virtual_url: t.virtual_tour_url ?? t.virtual_tour ?? null,

    // Agente
    agente_nombre: agente.name ?? agente.nombre ?? null,
    agente_telefono: agente.phone ?? agente.mobile ?? agente.cel ?? null,
    agente_email: agente.email ?? null,
  };
}

async function fetchAllTokko(apiKey: string): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const url = `${TOKKO_BASE}/property/?key=${apiKey}&limit=${limit}&offset=${offset}&format=json`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
        next: { revalidate: 0 },
      });
      if (!res.ok) break;
      const json = await res.json();
      const count = json.meta?.total_count ?? json.count ?? 0;
      const rows: Record<string, any>[] = json.objects ?? json.results ?? json.data ?? [];
      if (!rows.length) break;
      all.push(...rows);
      offset += limit;
      if (offset >= count || !json.meta?.next) break;
      if (offset > 2000) break; // límite de seguridad
    } catch {
      break;
    }
  }
  return all;
}

export interface TokkoSyncResult {
  items: PropExtNorm[];
  publicaciones: Array<PropExtNorm & { _portal: string; _portal_id: string; _url: string }>;
}

export async function syncTokkoRed(): Promise<TokkoSyncResult> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: configs } = await sb
    .from("crm_integraciones_config")
    .select("config,activo")
    .eq("tipo", "tokko")
    .eq("activo", true);

  const items: PropExtNorm[] = [];
  const publicaciones: Array<PropExtNorm & { _portal: string; _portal_id: string; _url: string }> = [];
  const seenIds = new Set<string>();

  for (const cfg of configs ?? []) {
    const apiKey = (cfg.config as Record<string, string> | null)?.api_key;
    if (!apiKey) continue;
    try {
      const props = await fetchAllTokko(apiKey);
      for (const tokko of props) {
        const norm = normalizarTokko(tokko);
        if (!seenIds.has(norm.portal_id)) {
          seenIds.add(norm.portal_id);
          items.push(norm);
        }
        // Extraer publicaciones en portales externos (Tokko tiene web_url, etc.)
        const pubs = extraerPublicaciones(tokko);
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
      // Key inválida o timeout
    }
  }

  return { items, publicaciones };
}
