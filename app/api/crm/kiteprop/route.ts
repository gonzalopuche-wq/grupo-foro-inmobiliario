import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Tipo / estado mappings ──────────────────────────────────────────────────

const KP_TIPO: Record<string, string> = {
  apartments: "departamento", houses: "casa", ph: "ph", duplex: "duplex",
  offices: "oficina", locals: "local", land: "terreno", parking: "cochera",
  warehouses: "galpón", buildings: "edificio", field: "campo", shop: "local",
};
const GFI_TIPO: Record<string, string> = {
  departamento: "apartments", casa: "houses", ph: "ph", duplex: "duplex",
  oficina: "offices", local: "locals", terreno: "land", cochera: "parking",
  "galpón": "warehouses", galpon: "warehouses", edificio: "buildings", campo: "field",
};
const KP_ESTADO: Record<string, string> = {
  active: "activa", inactive: "pausada", sold: "vendida", rented: "activa",
};
const GFI_ESTADO: Record<string, string> = {
  activa: "active", pausada: "inactive", vendida: "sold",
  reservada: "active", retirada: "inactive", disponible: "active",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getKitepropKey(userId: string) {
  const [{ data: creds }, { data: cfg }] = await Promise.all([
    sb.from("portal_credenciales").select("kiteprop_key").eq("perfil_id", userId).maybeSingle(),
    sb.from("crm_integraciones_config").select("config").eq("perfil_id", userId).eq("tipo", "kiteprop").maybeSingle(),
  ]);
  const c = cfg?.config as Record<string, string> | null;
  return {
    apiKey: (creds as Record<string, string> | null)?.kiteprop_key ?? c?.api_key ?? null,
    baseUrl: (c?.base_url ?? "https://www.kiteprop.com/api/v1").replace("api.kiteprop.com", "www.kiteprop.com").replace(/\/$/, ""),
  };
}

async function kpFetch(method: string, url: string, apiKey: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "X-API-Key": apiKey, Accept: "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  return res;
}

function kpRows(json: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(json.results)) return json.results as Record<string, unknown>[];
  if (Array.isArray(json.data)) return json.data as Record<string, unknown>[];
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  return [];
}

// Convierte una propiedad KiteProp → payload para cartera_propiedades
function kpToGfi(kp: Record<string, unknown>, perfilId: string): Record<string, unknown> {
  const imgs = (kp.images_list as { lg?: string }[] | null) ?? [];
  const fotos = imgs.map(i => i.lg).filter(Boolean);
  const operacion =
    kp.for_sale && kp.for_rent ? "Ambas" : kp.for_sale ? "Venta" : "Alquiler";
  const precio = (kp.for_sale_price ?? kp.for_rent_price ?? null) as number | null;
  const geo = kp.geo as { lat?: number; lon?: number } | null;
  return {
    perfil_id: perfilId,
    kiteprop_id: String(kp.id),
    kiteprop_sync_at: new Date().toISOString(),
    titulo: kp.title ?? kp.address,
    tipo: KP_TIPO[(kp.type as string) ?? ""] ?? (kp.type as string),
    operacion,
    precio,
    moneda: ((kp.currency as string) ?? "usd").toUpperCase(),
    descripcion_privada: (kp.description as string | null) ?? null,
    direccion: kp.address ?? null,
    zona: (kp.neighborhood ?? kp.zone ?? null) as string | null,
    ciudad: kp.city ?? null,
    latitud: geo?.lat ?? null,
    longitud: geo?.lon ?? null,
    ambientes: kp.rooms ?? null,
    dormitorios: kp.bedrooms ?? null,
    banos: kp.bathrooms ?? null,
    superficie_total: kp.total_meters ?? null,
    superficie_cubierta: kp.covered_meters ?? null,
    fotos,
    estado: KP_ESTADO[(kp.status as string) ?? "active"] ?? "activa",
    origen: "kiteprop",
    updated_at: new Date().toISOString(),
  };
}

// Convierte una propiedad GFI → payload para KiteProp API
function gfiToKp(prop: Record<string, unknown>): Record<string, unknown> {
  const tipo = ((prop.tipo as string) ?? "").toLowerCase();
  const estado = ((prop.estado as string) ?? "activa").toLowerCase();
  const operacion = ((prop.operacion as string) ?? "venta").toLowerCase();
  const forSale = operacion === "venta" || operacion === "ambas";
  const forRent = operacion === "alquiler" || operacion === "ambas";

  return {
    type: GFI_TIPO[tipo] ?? "apartments",
    title: prop.titulo,
    description: prop.descripcion_privada ?? null,
    for_sale: forSale,
    for_rent: forRent,
    for_sale_price: forSale ? prop.precio : null,
    for_rent_price: forRent ? prop.precio : null,
    currency: ((prop.moneda as string) ?? "USD").toLowerCase(),
    address: prop.direccion ?? "",
    city: prop.ciudad ?? "",
    state: prop.zona ?? "",
    country: "Argentina",
    rooms: prop.ambientes ?? null,
    bedrooms: prop.dormitorios ?? null,
    bathrooms: prop.banos ?? null,
    total_meters: prop.superficie_total ?? null,
    covered_meters: prop.superficie_cubierta ?? null,
    internal_id: String(prop.id),
    status: GFI_ESTADO[estado] ?? "active",
    images_list: Array.isArray(prop.fotos)
      ? (prop.fotos as string[]).map(url => ({ lg: url, md: url, sm: url }))
      : [],
  };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(jwt);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action") ?? "propiedades";
  const { apiKey, baseUrl } = await getKitepropKey(user.id);
  if (!apiKey) return NextResponse.json({ error: "No hay API key configurada para Kiteprop" }, { status: 400 });

  // Traer todas las páginas de KiteProp
  async function fetchAllKp(endpoint: string) {
    const all: Record<string, unknown>[] = [];
    let page = 1;
    while (true) {
      const res = await kpFetch("GET", `${baseUrl}/${endpoint}/?page=${page}`, apiKey!);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`KiteProp ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = await res.json() as Record<string, unknown>;
      const rows = kpRows(json);
      all.push(...rows);
      if (!json.next || rows.length === 0) break;
      page++;
    }
    return all;
  }

  try {
    if (action === "propiedades") {
      const data = await fetchAllKp("properties");
      return NextResponse.json({ ok: true, data: { count: data.length, results: data } });
    }

    if (action === "contactos") {
      const res = await kpFetch("GET", `${baseUrl}/contacts/`, apiKey!);
      if (!res.ok) throw new Error(`KiteProp ${res.status}`);
      const data = await res.json();
      return NextResponse.json({ ok: true, data });
    }

    if (action === "preview") {
      // Comparar: cuántas props hay en KP vs en GFI cartera con kiteprop_id
      const [kpData, { count: gfiCount }] = await Promise.all([
        fetchAllKp("properties"),
        sb.from("cartera_propiedades").select("*", { count: "exact", head: true }).eq("perfil_id", user.id).not("kiteprop_id", "is", null),
      ]);
      return NextResponse.json({
        ok: true,
        kp_total: kpData.length,
        gfi_sincronizadas: gfiCount ?? 0,
        nuevas_en_kp: kpData.length - (gfiCount ?? 0),
      });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(jwt);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json() as { action?: string; ids?: string[] };
  const action = body.action;
  const { apiKey, baseUrl } = await getKitepropKey(user.id);
  if (!apiKey) return NextResponse.json({ error: "No hay API key configurada para Kiteprop" }, { status: 400 });

  // ── KiteProp → GFI ─────────────────────────────────────────────────────────
  if (action === "sync-from-kite") {
    let page = 1;
    let importados = 0, actualizados = 0, errores = 0;

    while (true) {
      const res = await kpFetch("GET", `${baseUrl}/properties/?page=${page}`, apiKey!);
      if (!res.ok) return NextResponse.json({ error: `KiteProp ${res.status}` }, { status: 502 });
      const json = await res.json() as Record<string, unknown>;
      const rows = kpRows(json);
      if (rows.length === 0) break;

      for (const kp of rows) {
        const payload = kpToGfi(kp, user.id);
        // Buscar existente por kiteprop_id
        const { data: ex } = await sb
          .from("cartera_propiedades").select("id")
          .eq("perfil_id", user.id)
          .eq("kiteprop_id", String(kp.id))
          .maybeSingle();

        const { error } = ex
          ? await sb.from("cartera_propiedades").update(payload).eq("id", ex.id)
          : await sb.from("cartera_propiedades").insert(payload);

        if (error) errores++;
        else if (ex) actualizados++;
        else importados++;
      }

      if (!json.next) break;
      page++;
    }

    // Actualizar ultima_sincronizacion
    await sb.from("crm_integraciones_config")
      .upsert({ perfil_id: user.id, tipo: "kiteprop", activo: true, ultima_sincronizacion: new Date().toISOString() }, { onConflict: "perfil_id,tipo" });

    return NextResponse.json({ ok: true, importados, actualizados, errores });
  }

  // ── GFI → KiteProp ─────────────────────────────────────────────────────────
  if (action === "sync-to-kite") {
    // Si viene lista de IDs, solo esas; si no, todas las de la cartera
    const query = sb.from("cartera_propiedades")
      .select("*").eq("perfil_id", user.id)
      .neq("estado", "retirada");
    if (body.ids?.length) query.in("id", body.ids);

    const { data: props, error: qErr } = await query;
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

    let publicadas = 0, actualizadas = 0, errores = 0;
    const detalles: { id: string; titulo: string; accion: string; ok: boolean; error?: string }[] = [];

    for (const prop of (props ?? [])) {
      const kpPayload = gfiToKp(prop as Record<string, unknown>);

      let kpRes: Response;
      let accion: string;

      if (prop.kiteprop_id?.trim()) {
        // Ya existe en KiteProp → PATCH
        kpRes = await kpFetch("PATCH", `${baseUrl}/properties/${prop.kiteprop_id}/`, apiKey!, kpPayload);
        accion = "actualizada";
      } else {
        // Nueva → POST
        kpRes = await kpFetch("POST", `${baseUrl}/properties/`, apiKey!, kpPayload);
        accion = "publicada";
      }

      if (kpRes.ok) {
        const kpData = await kpRes.json() as { data?: { id?: number }; id?: number };
        const kpId = kpData.data?.id ? String(kpData.data.id) : kpData.id ? String(kpData.id) : prop.kiteprop_id;
        // Guardar kiteprop_id + sync_at en GFI
        await sb.from("cartera_propiedades").update({
          kiteprop_id: kpId,
          kiteprop_sync_at: new Date().toISOString(),
        }).eq("id", prop.id);

        if (accion === "publicada") publicadas++; else actualizadas++;
        detalles.push({ id: prop.id, titulo: prop.titulo ?? prop.direccion ?? "—", accion, ok: true });
      } else {
        const errText = await kpRes.text();
        errores++;
        detalles.push({ id: prop.id, titulo: prop.titulo ?? "—", accion, ok: false, error: errText.slice(0, 200) });
      }
    }

    return NextResponse.json({ ok: true, publicadas, actualizadas, errores, detalles });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
