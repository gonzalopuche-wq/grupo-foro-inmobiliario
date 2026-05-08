// app/api/cartera/sync/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// GFI® — Sincronización Cartera → Tokko Broker + KiteProp
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Evita que Next.js intente pre-renderizar esta route en build time
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function mapTipoTokko(tipo: string): number {
  const m: Record<string, number> = {
    "Departamento": 2, "Casa": 3, "PH": 13, "Local": 7,
    "Oficina": 6, "Terreno": 9, "Cochera": 15, "Galpon": 18,
  };
  return m[tipo] ?? 2;
}

function mapAntiguedadTokko(a: string | null): number {
  if (!a) return 0;
  if (a.includes("estrenar")) return 0;
  if (a.includes("5 años")) return 3;
  if (a.includes("5-10")) return 7;
  if (a.includes("10-20")) return 15;
  return 25;
}

function mapearATokko(p: any) {
  return {
    title: p.titulo,
    description: p.descripcion ?? "",
    operation_id: p.operacion === "Venta" ? 1 : p.operacion === "Alquiler" ? 2 : 3,
    property_type_id: mapTipoTokko(p.tipo),
    status_id: p.estado === "activa" ? 2 : 3,
    price: p.precio ?? 0,
    currency: p.moneda === "USD" ? 2 : 1,
    address: p.direccion ?? "",
    province: "Santa Fe",
    city: p.ciudad ?? "Rosario",
    zone: p.zona ?? "",
    rooms: p.dormitorios ?? 0,
    bathrooms: p.banos ?? 0,
    covered_area: p.superficie_cubierta ?? 0,
    total_area: p.superficie_total ?? 0,
    age: mapAntiguedadTokko(p.antiguedad),
    accepts_credit: p.apto_credito ? 1 : 0,
    has_parking: p.con_cochera ? 1 : 0,
    video_url: p.video_url ?? "",
    photos: (p.fotos ?? []).map((url: string, i: number) => ({ image: url, order: i + 1 })),
    tags: (p.amenities ?? []).join(","),
    extra: { gfi_id: p.id },
  };
}

function mapTipoKiteProp(tipo: string): string {
  const m: Record<string, string> = {
    "Departamento": "apartment", "Casa": "house", "PH": "ph",
    "Local": "commercial_local", "Oficina": "office",
    "Terreno": "land", "Cochera": "garage", "Galpon": "warehouse",
  };
  return m[tipo] ?? "apartment";
}

function mapearAKiteProp(p: any) {
  return {
    title: p.titulo,
    description: p.descripcion ?? "",
    operation_type: p.operacion === "Venta" ? "sale" : p.operacion === "Alquiler" ? "rent" : "temporary_rent",
    property_type: mapTipoKiteProp(p.tipo),
    status: p.estado === "activa" ? "available" : p.estado === "reservada" ? "reserved" : "sold",
    price: p.precio ?? 0,
    currency: p.moneda,
    address: p.direccion ?? "",
    city: p.ciudad ?? "Rosario",
    province: "Santa Fe",
    country: "Argentina",
    neighborhood: p.zona ?? "",
    rooms: p.dormitorios ?? 0,
    bathrooms: p.banos ?? 0,
    covered_surface: p.superficie_cubierta ?? 0,
    total_surface: p.superficie_total ?? 0,
    credit_accepted: p.apto_credito ?? false,
    garage: p.con_cochera ?? false,
    video_url: p.video_url ?? "",
    photos: (p.fotos ?? []).map((url: string) => ({ url })),
    amenities: p.amenities ?? [],
    external_reference: p.id,
  };
}

async function getPerUserKey(perfilId: string, portal: "tokko" | "kiteprop"): Promise<string | null> {
  try {
    const { data } = await supabase.from("portal_credenciales").select(`${portal}_key`).eq("perfil_id", perfilId).single();
    return data?.[`${portal}_key`] ?? null;
  } catch { return null; }
}

async function syncTokko(p: any, tokkoId: string | null, perfilId?: string) {
  const apiKey = (perfilId ? await getPerUserKey(perfilId, "tokko") : null) ?? process.env.TOKKO_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      pendiente: true,
      error: "API key de Tokko no configurada. Cuando tengas el acceso API activo en tu plan de Tokko Broker, agregá TOKKO_API_KEY en las variables de entorno de Vercel.",
    };
  }
  const body = mapearATokko(p);
  const url = tokkoId
    ? `https://www.tokkobroker.com/api/v1/property/${tokkoId}/?key=${apiKey}`
    : `https://www.tokkobroker.com/api/v1/property/?key=${apiKey}`;
  try {
    const res = await fetch(url, { method: tokkoId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Sin acceso a la API de Tokko. Verificá que tengas el add-on 'Acceso APIs' activo en tu plan de Tokko Broker." };
    if (!res.ok) { const err = await res.text(); return { ok: false, error: `Tokko ${res.status}: ${err}` }; }
    const data = await res.json();
    return { ok: true, id: data.id ?? tokkoId };
  } catch (e: any) {
    return { ok: false, error: `Error de conexión con Tokko: ${e.message}` };
  }
}

async function syncKiteProp(p: any, kiteId: string | null, perfilId?: string) {
  const apiKey = (perfilId ? await getPerUserKey(perfilId, "kiteprop") : null) ?? process.env.KITEPROP_API_KEY;
  const apiUrl = process.env.KITEPROP_API_URL ?? "https://api.kiteprop.com/v1";
  if (!apiKey) {
    return {
      ok: false,
      pendiente: true,
      error: "API key de KiteProp no configurada. Cuando tengas el acceso API activo, agregá KITEPROP_API_KEY en las variables de entorno de Vercel.",
    };
  }
  const body = mapearAKiteProp(p);
  const url = kiteId ? `${apiUrl}/properties/${kiteId}` : `${apiUrl}/properties`;
  try {
    const res = await fetch(url, { method: kiteId ? "PUT" : "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }, body: JSON.stringify(body) });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Sin acceso a la API de KiteProp. Verificá que tu API key sea válida." };
    if (!res.ok) { const err = await res.text(); return { ok: false, error: `KiteProp ${res.status}: ${err}` }; }
    const data = await res.json();
    return { ok: true, id: data.id ?? kiteId };
  } catch (e: any) {
    return { ok: false, error: `Error de conexión con KiteProp: ${e.message}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { propiedad_id, portales } = await req.json();
    if (!propiedad_id || !portales?.length) {
      return NextResponse.json({ error: "propiedad_id y portales requeridos" }, { status: 400 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY no configurada en variables de entorno de Vercel" }, { status: 500 });
    }
    const { data: prop, error: propErr } = await supabase.from("cartera_propiedades").select("*").eq("id", propiedad_id).single();
    if (propErr || !prop) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
    const { data: sync } = await supabase.from("cartera_sync_portales").select("*").eq("propiedad_id", propiedad_id).single();
    const resultados: Record<string, any> = {};
    if (portales.includes("tokko")) {
      const r = await syncTokko(prop, sync?.tokko_id ?? null, prop.perfil_id);
      resultados.tokko = r;
      if (r.ok) await supabase.from("cartera_sync_portales").upsert({ propiedad_id, tokko_id: r.id, tokko_synced_at: new Date().toISOString(), tokko_error: null }, { onConflict: "propiedad_id" });
      else if (!r.pendiente) await supabase.from("cartera_sync_portales").upsert({ propiedad_id, tokko_error: r.error }, { onConflict: "propiedad_id" });
    }
    if (portales.includes("kiteprop")) {
      const r = await syncKiteProp(prop, sync?.kiteprop_id ?? null, prop.perfil_id);
      resultados.kiteprop = r;
      if (r.ok) await supabase.from("cartera_sync_portales").upsert({ propiedad_id, kiteprop_id: r.id, kiteprop_synced_at: new Date().toISOString(), kiteprop_error: null }, { onConflict: "propiedad_id" });
      else if (!r.pendiente) await supabase.from("cartera_sync_portales").upsert({ propiedad_id, kiteprop_error: r.error }, { onConflict: "propiedad_id" });
    }
    return NextResponse.json({ ok: true, resultados });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    tokko: { configurado: !!process.env.TOKKO_API_KEY, mensaje: !process.env.TOKKO_API_KEY ? "Pendiente — necesitás el add-on 'Acceso APIs' en tu plan Tokko Broker" : "Configurado" },
    kiteprop: { configurado: !!process.env.KITEPROP_API_KEY, mensaje: !process.env.KITEPROP_API_KEY ? "Pendiente — necesitás tu API key de KiteProp" : "Configurado" },
  });
}
