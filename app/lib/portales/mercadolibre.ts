// Mercado Libre official REST API — no auth required for searches
// Docs: https://developers.mercadolibre.com.ar/es_ar/categorias-y-atributos-inmuebles
import { PropExtNorm, normalizeTipo, normalizeOperacion, parseNum } from "./types";

const ML_API = "https://api.mercadolibre.com";

// MLA1459 = Inmuebles Argentina (root, cubre venta + alquiler)
const ML_CATEGORY = "MLA1459";

// Estado Santa Fe (base64 del ID interno de ML)
const ML_STATE_SANTA_FE = "TUxBUFNBTjI3MTQ";

function getAttr(attrs: Array<{ id: string; value_name?: string }>, id: string): string | null {
  return attrs?.find(a => a.id === id)?.value_name ?? null;
}

function normalizeML(item: Record<string, any>): PropExtNorm {
  const attrs: Array<{ id: string; value_name?: string }> = item.attributes ?? [];
  const opRaw = getAttr(attrs, "OPERATION") ?? getAttr(attrs, "OPERATION_TYPE");
  const tipoRaw = getAttr(attrs, "PROPERTY_TYPE") ?? getAttr(attrs, "REAL_ESTATE_TYPE");

  const supCubierta = parseNum(getAttr(attrs, "COVERED_AREA")?.replace(/[^\d.]/g, "") ?? null);
  const supTotal = parseNum(getAttr(attrs, "TOTAL_AREA")?.replace(/[^\d.]/g, "") ?? null);

  const imagenes: string[] = [];
  if (Array.isArray(item.pictures)) {
    for (const p of item.pictures) imagenes.push(p.secure_url ?? p.url ?? "");
  } else if (item.thumbnail) {
    imagenes.push(item.thumbnail);
  }

  return {
    portal_id: String(item.id),
    url: item.permalink ?? "",
    titulo: item.title ?? "",
    operacion: normalizeOperacion(opRaw),
    tipo: normalizeTipo(tipoRaw),
    precio: parseNum(item.price),
    moneda: item.currency_id === "ARS" ? "ARS" : "USD",
    dormitorios: parseNum(getAttr(attrs, "BEDROOMS")),
    banos: parseNum(getAttr(attrs, "BATHROOMS")),
    ambientes: parseNum(getAttr(attrs, "ROOMS")),
    superficie_cubierta: supCubierta,
    sup_terreno: supTotal ?? (supCubierta ? null : parseNum(getAttr(attrs, "LOT_AREA")?.replace(/[^\d.]/g, "") ?? null)),
    expensas: null,
    barrio: item.location?.neighborhood?.name ?? null,
    ciudad: item.location?.city?.name ?? "Rosario",
    provincia: item.location?.state?.name ?? "Santa Fe",
    direccion: item.location?.address_line ?? null,
    lat: parseNum(item.location?.latitude),
    lng: parseNum(item.location?.longitude),
    imagenes: imagenes.filter(Boolean),
    descripcion: null,
    datos_raw: { category_id: item.category_id, condition: item.condition },
  };
}

export async function syncMercadoLibre(maxItems = 300): Promise<PropExtNorm[]> {
  const results: PropExtNorm[] = [];
  const perPage = 50;

  // Primero intentar filtrar por estado Santa Fe; si da 0, buscar con q=Rosario
  const strategies = [
    `${ML_API}/sites/MLA/search?category=${ML_CATEGORY}&state=${ML_STATE_SANTA_FE}&limit=${perPage}`,
    `${ML_API}/sites/MLA/search?category=${ML_CATEGORY}&q=Rosario+Santa+Fe&limit=${perPage}`,
  ];

  for (const baseUrl of strategies) {
    let offset = 0;
    while (results.length < maxItems) {
      const url = `${baseUrl}&offset=${offset}`;
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "GFI-Sync/1.0" },
          next: { revalidate: 0 },
        });
        if (!res.ok) break;
        const data = await res.json();
        const items: any[] = data.results ?? [];
        if (!items.length) break;

        for (const item of items) {
          results.push(normalizeML(item));
        }

        const paging = data.paging ?? {};
        offset += perPage;
        if (offset >= Math.min(paging.total ?? 0, maxItems)) break;
      } catch {
        break;
      }
    }
    if (results.length > 0) break; // Primera estrategia exitosa, no continuar
  }

  return results;
}
