// Sync Propia.com.ar — feed de propiedades publicadas en la Red MLS y en el Portal
import { createClient } from "@supabase/supabase-js";
import { PropExtNorm, normalizeTipo, normalizeOperacion, parseNum } from "./types";

const PROPIA_BASE = (process.env.PROPIA_API_BASE ?? "https://propia.com.ar/api").replace(/\/$/, "");

interface PropiaFeedItem {
  id: number;
  title?: string;
  address_to_show?: string;
  price?: string | number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  slug?: string;
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
}

function normalizarPropia(item: PropiaFeedItem): PropExtNorm {
  const imgs: string[] = (item.images ?? [])
    .map(i => i?.url_do ?? i?.url_thumb_do ?? "")
    .filter(u => !!u && u.startsWith("http"));

  const currency = (item.currency?.iso ?? item.currency?.symbol ?? "USD").toUpperCase();
  const rawTipo = item.type_id?.name ?? item.type ?? "";
  const rawOp   = item.operation_id?.name ?? item.operation ?? "venta";

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
    ambientes: null,
    superficie_cubierta: parseNum(item.area),
    sup_terreno: null,
    expensas: null,
    barrio: item.neighborhood ?? null,
    ciudad: item.city ?? "Rosario",
    provincia: item.province ?? "Santa Fe",
    direccion: item.address_to_show ?? null,
    lat: null,
    lng: null,
    imagenes: imgs,
    descripcion: null,
    datos_raw: { propia_id: item.id, slug: item.slug },
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
