// Sync global de Kiteprop: recorre todas las API keys de la red GFI
// y trae las propiedades de cada corredor a propiedades_externas
import { createClient } from "@supabase/supabase-js";
import { PropExtNorm, normalizeTipo, normalizeOperacion, parseNum } from "./types";
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

  return {
    portal_id: String(kp.id ?? kp.internal_id),
    url: kp.url ?? kp.web_url ?? "",
    titulo: kp.title ?? kp.address ?? "",
    operacion,
    tipo: KP_TIPO[kp.type ?? ""] ?? normalizeTipo(kp.type),
    precio,
    moneda: ((kp.currency ?? "usd").toUpperCase() === "ARS") ? "ARS" : "USD",
    dormitorios: parseNum(kp.bedrooms),
    banos: parseNum(kp.bathrooms),
    ambientes: parseNum(kp.rooms),
    superficie_cubierta: parseNum(kp.covered_meters ?? kp.covered_area),
    sup_terreno: parseNum(kp.total_meters ?? kp.total_area),
    expensas: parseNum(kp.expenses ?? kp.expensas),
    barrio: kp.neighborhood ?? kp.zone ?? null,
    ciudad: kp.city ?? "Rosario",
    provincia: kp.state ?? "Santa Fe",
    direccion: kp.address ?? null,
    lat: parseNum(geo.lat ?? geo.latitude),
    lng: parseNum(geo.lon ?? geo.longitude),
    imagenes: imgs,
    descripcion: kp.description ?? null,
    datos_raw: { kp_id: kp.id, kp_status: kp.status },
  };
}

async function fetchAllKP(apiKey: string, baseUrl = KP_BASE): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [];
  let page = 1;
  // KiteProp ignora page_size grande; itera hasta agotar el total declarado
  while (true) {
    const res = await fetch(`${baseUrl}/properties/?page=${page}`, {
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
    // Parar si: campo next ausente/null Y (no hay total declarado o ya tenemos todo)
    const hasNextUrl = !!json.next;
    const hasMoreByCount = total !== null && all.length < total;
    if (!hasNextUrl && !hasMoreByCount) break;
    if (total !== null && all.length >= total) break;
    page++;
    if (page > 100) break;
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

  // Obtener todas las API keys disponibles en la red
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
    const [apiKey, baseUrl] = keyEntry.split("|");
    try {
      const props = await fetchAllKP(apiKey, baseUrl);
      for (const kp of props) {
        const norm = normalizarKP(kp);
        if (!seenIds.has(norm.portal_id)) {
          seenIds.add(norm.portal_id);
          items.push(norm);
        }
        // Extraer publicaciones en portales externos
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
