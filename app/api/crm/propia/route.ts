import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROPIA_BASE = (process.env.PROPIA_API_BASE ?? "https://propia.com.ar/api").replace(/\/$/, "");
// Propia uses different base paths per service group
const PROPIA_HOST  = PROPIA_BASE.replace(/\/api$/, "");
const PROPIA_SRCH  = `${PROPIA_HOST}/search`;
const PROPIA_STATS = `${PROPIA_HOST}/stats`;

async function autenticar(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return null;
  const { data: { user } } = await sb.auth.getUser(jwt);
  return user ?? null;
}

async function obtenerCredenciales(userId: string) {
  const { data } = await sb
    .from("portal_credenciales")
    .select("propia_api_key, propia_usuario, propia_company_id, propia_provider")
    .eq("perfil_id", userId)
    .maybeSingle();
  const row = data as Record<string, string | null> | null;
  return {
    apiKey:    row?.propia_api_key ?? process.env.PROPIA_API_KEY ?? null,
    companyId: row?.propia_company_id ?? null,
    provider:  row?.propia_provider ?? process.env.PROPIA_PROVIDER ?? null,
    seller:    row?.propia_usuario ?? null,
  };
}

function headers(apiKey: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

async function propiaFetch(url: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(apiKey), ...(init?.headers as Record<string, string> ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Propia API HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  const user = await autenticar(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { apiKey, companyId } = await obtenerCredenciales(user.id);
  if (!apiKey) {
    return NextResponse.json(
      { error: "No hay API key de Propia. Configurala en CRM → Portales → Propia MLS.", sinCredenciales: true },
      { status: 400 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const action = sp.get("action") ?? "feed";

  try {
    // ── Feed de propiedades publicadas ────────────────────────────────────────
    if (action === "feed") {
      const params = new URLSearchParams();
      params.set("limit",     sp.get("limit") ?? "100");
      params.set("offset",    sp.get("offset") ?? "0");
      if (sp.get("filter_by"))    params.set("filter_by", sp.get("filter_by")!);
      if (sp.get("date_from"))    params.set("date_from", sp.get("date_from")!);
      if (companyId)              params.set("company_id", companyId);
      if (sp.get("investment_id"))params.set("investment_id", sp.get("investment_id")!);
      const data = await propiaFetch(`${PROPIA_BASE}/properties/feed?${params}`, apiKey);
      return NextResponse.json({ ok: true, ...data });
    }

    // ── Estado de integración CRM ─────────────────────────────────────────────
    if (action === "crm-status") {
      const provider = sp.get("provider") ?? "";
      const params = new URLSearchParams({ provider, limit: sp.get("limit") ?? "100", offset: sp.get("offset") ?? "0" });
      if (sp.get("filter_by")) params.set("filter_by", sp.get("filter_by")!);
      const data = await propiaFetch(`${PROPIA_BASE}/crm-integrations/status?${params}`, apiKey);
      return NextResponse.json({ ok: true, ...data });
    }

    // ── Búsqueda full-text ────────────────────────────────────────────────────
    if (action === "search") {
      const q = sp.get("q") ?? "";
      if (!q) return NextResponse.json({ error: "Parámetro q requerido" }, { status: 400 });
      const params = new URLSearchParams({ q, limit: sp.get("limit") ?? "25", page: sp.get("page") ?? "1", meta: sp.get("meta") ?? "filter_count,total_count" });
      if (sp.get("filter"))  params.set("filter", sp.get("filter")!);
      if (sp.get("target"))  params.set("target", sp.get("target")!);
      if (sp.get("sort"))    params.set("sort", sp.get("sort")!);
      const data = await propiaFetch(`${PROPIA_SRCH}/properties?${params}`, apiKey);
      return NextResponse.json({ ok: true, ...data });
    }

    // ── Estadísticas de engagement de propiedades ─────────────────────────────
    if (action === "stats") {
      const extId = sp.get("external_identifier");
      const propId = sp.get("property_id");
      if (!extId && !propId) return NextResponse.json({ error: "Se requiere external_identifier o property_id" }, { status: 400 });
      const params = new URLSearchParams();
      if (extId)  params.set("external_identifier", extId);
      if (propId) params.set("property_id", propId);
      const data = await propiaFetch(`${PROPIA_BASE}/properties/stats?${params}`, apiKey);
      return NextResponse.json({ ok: true, ...data });
    }

    // ── Estadísticas de precios por zona ──────────────────────────────────────
    if (action === "precios") {
      const city = sp.get("city");
      const neighborhood = sp.get("neighborhood");
      if (!city && !neighborhood) return NextResponse.json({ error: "Se requiere city o neighborhood" }, { status: 400 });
      const params = new URLSearchParams();
      if (city)         params.set("city", city);
      if (neighborhood) params.set("neighborhood", neighborhood);
      if (sp.get("property_type")) params.set("property_type", sp.get("property_type")!);
      if (sp.get("operation"))     params.set("operation", sp.get("operation")!);
      if (sp.get("currency"))      params.set("currency", sp.get("currency") ?? "USD");
      const data = await propiaFetch(`${PROPIA_STATS}/prices?${params}`, apiKey);
      return NextResponse.json({ ok: true, ...data });
    }

    // ── Propiedades similares (público, no requiere key) ──────────────────────
    if (action === "similares") {
      const id = sp.get("id");
      if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
      const res = await fetch(`${PROPIA_BASE}/properties/similar/${id}?limit=${sp.get("limit") ?? "6"}`, {
        signal: AbortSignal.timeout(10_000),
      });
      return NextResponse.json({ ok: true, ...(await res.json()) });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Publicar/despublicar propiedad en Propia ──────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await autenticar(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { apiKey, provider, seller } = await obtenerCredenciales(user.id);
  if (!apiKey) return NextResponse.json({ error: "Sin API key de Propia" }, { status: 400 });
  if (!provider) return NextResponse.json({ error: "Configurá el nombre de proveedor (provider) en CRM → Portales" }, { status: 400 });

  const body = await req.json();
  const { accion, ...payload } = body as { accion: "publicar" | "despublicar" | "sync-to-propia"; [key: string]: unknown };

  try {
    if (accion === "publicar") {
      const data = await propiaFetch(`${PROPIA_BASE}/properties/publish`, apiKey, {
        method: "POST",
        body: JSON.stringify({ provider, seller, ...payload }),
      });
      return NextResponse.json({ ok: true, ...data });
    }

    if (accion === "despublicar") {
      const data = await propiaFetch(`${PROPIA_BASE}/properties/un-publish`, apiKey, {
        method: "PATCH",
        body: JSON.stringify({ provider, seller, ...payload }),
      });
      return NextResponse.json({ ok: true, ...data });
    }

    // ── Sincronizar toda la cartera GFI → Propia ────────────────────────────
    if (accion === "sync-to-propia") {
      const { data: propiedades } = await sb
        .from("cartera_propiedades")
        .select("id, titulo, tipo, operacion, precio, moneda, descripcion_privada, direccion, zona, ciudad, ambientes, dormitorios, banos, superficie_total, superficie_cubierta, fotos, estado, propia_id")
        .eq("perfil_id", user.id)
        .neq("estado", "retirada")
        .limit(500);

      if (!propiedades?.length) return NextResponse.json({ ok: true, publicadas: 0, actualizadas: 0, errores: 0 });

      let publicadas = 0, actualizadas = 0, errores = 0;

      for (const prop of propiedades as Record<string, unknown>[]) {
        try {
          const operacion = ((prop.operacion as string) ?? "venta").toLowerCase();
          const forSale = operacion === "venta" || operacion === "ambas";
          const forRent = operacion === "alquiler" || operacion === "ambas";

          const propiaProp = {
            provider, seller,
            external_identifier: String(prop.id),
            title: prop.titulo ?? "",
            description: prop.descripcion_privada ?? null,
            for_sale: forSale,
            for_rent: forRent,
            for_sale_price: forSale ? (prop.precio ?? null) : null,
            for_rent_price: forRent ? (prop.precio ?? null) : null,
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
            images: Array.isArray(prop.fotos)
              ? (prop.fotos as string[]).map(url => ({ lg: url, md: url, sm: url }))
              : [],
          };

          let result: Record<string, unknown>;
          if (prop.propia_id) {
            // Ya existe en Propia → actualizar
            result = await propiaFetch(`${PROPIA_BASE}/properties/publish`, apiKey, {
              method: "POST",
              body: JSON.stringify({ ...propiaProp, property_id: prop.propia_id }),
            });
            actualizadas++;
          } else {
            // Nueva → publicar y guardar propia_id
            result = await propiaFetch(`${PROPIA_BASE}/properties/publish`, apiKey, {
              method: "POST",
              body: JSON.stringify(propiaProp),
            });
            publicadas++;
          }

          // Guardar propia_id retornado
          const propiaId = (result.id ?? result.property_id ?? result.propia_id) as string | undefined;
          if (propiaId) {
            await sb.from("cartera_propiedades").update({
              propia_id: String(propiaId),
              propia_sync_at: new Date().toISOString(),
            }).eq("id", prop.id as string);
          }
        } catch {
          errores++;
        }
      }

      return NextResponse.json({ ok: true, publicadas, actualizadas, errores, total: propiedades.length });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
