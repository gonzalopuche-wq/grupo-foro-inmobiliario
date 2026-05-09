// Sincronización con ZonaProp / Argenprop (Navent Group API)
// Requiere:
//   NAVENT_API_KEY   → clave de la API de Navent (contrato con ZonaProp/Argenprop)
//   NAVENT_ACCOUNT_ID → ID de tu cuenta inmobiliaria en Navent
// Para obtener acceso: contactar a ZonaProp/Argenprop y solicitar integración API para inmobiliarias

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TIPO_NAVENT: Record<string, number> = {
  "Departamento": 2, "Casa": 3, "PH": 13, "Local": 7,
  "Oficina": 6, "Terreno": 9, "Cochera": 15, "Galpon": 18,
};

const OP_NAVENT: Record<string, number> = {
  "Venta": 1, "Alquiler": 2, "Alquiler temporal": 3,
};

function mapearANavent(p: any, accountId: string) {
  return {
    realestate_agency: { id: accountId },
    real_estate_type: { id: TIPO_NAVENT[p.tipo] ?? 2 },
    operation_type: { id: OP_NAVENT[p.operacion] ?? 1 },
    title: p.titulo,
    description: p.descripcion ?? "",
    price: { amount: p.precio ?? 0, currency: p.moneda === "USD" ? "USD" : "ARS" },
    address: {
      name: p.direccion ?? "",
      city: { name: p.ciudad ?? "Rosario" },
      state: { name: "Santa Fe" },
      zone: { name: p.zona ?? "" },
    },
    suite_amount: p.dormitorios ?? null,
    bathroom_amount: p.banos ?? null,
    total_surface: p.superficie_total ?? null,
    roofed_surface: p.superficie_cubierta ?? null,
    accepts_credit: p.apto_credito ?? false,
    has_parking: p.con_cochera ?? false,
    photos: (p.fotos ?? []).map((url: string) => ({ image: url })),
    video_url: p.video_url ?? null,
    status: p.estado === "activa" ? "active" : "paused",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { propiedad_id, portal = "zonaprop" } = await req.json();
    if (!propiedad_id) return NextResponse.json({ error: "propiedad_id requerido" }, { status: 400 });

    const apiKey = process.env.NAVENT_API_KEY;
    const accountId = process.env.NAVENT_ACCOUNT_ID;

    if (!apiKey || !accountId) {
      return NextResponse.json({
        ok: false, pendiente: true,
        error: `Para publicar en ${portal === "zonaprop" ? "ZonaProp" : "Argenprop"} necesitás un contrato de integración API con Navent Group. Contactá a tu ejecutivo de cuenta en ZonaProp/Argenprop y solicitá el acceso API para inmobiliarias. Luego agregá NAVENT_API_KEY y NAVENT_ACCOUNT_ID en las variables de Vercel.`,
      });
    }

    const { data: prop } = await sb.from("cartera_propiedades").select("*").eq("id", propiedad_id).single();
    if (!prop) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

    const { data: sync } = await sb.from("cartera_sync_portales").select("zonaprop_id,argenprop_id").eq("propiedad_id", propiedad_id).maybeSingle();
    const existingId = portal === "zonaprop" ? (sync as any)?.zonaprop_id : (sync as any)?.argenprop_id;

    const baseUrl = portal === "zonaprop"
      ? "https://api.zonaprop.com.ar/v2"
      : "https://api.argenprop.com/v2";

    const url = existingId ? `${baseUrl}/properties/${existingId}` : `${baseUrl}/properties`;
    const body = mapearANavent(prop, accountId);

    const res = await fetch(url, {
      method: existingId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "X-Account-Id": accountId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ ok: false, error: `${portal} ${res.status}: ${err}` });
    }

    const data = await res.json();
    const newId = data.id ?? existingId;

    const upsertData: any = { propiedad_id, updated_at: new Date().toISOString() };
    if (portal === "zonaprop") { upsertData.zonaprop_id = newId; upsertData.zonaprop_synced_at = new Date().toISOString(); }
    else { upsertData.argenprop_id = newId; upsertData.argenprop_synced_at = new Date().toISOString(); }

    await sb.from("cartera_sync_portales").upsert(upsertData, { onConflict: "propiedad_id" });

    return NextResponse.json({ ok: true, id: newId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
