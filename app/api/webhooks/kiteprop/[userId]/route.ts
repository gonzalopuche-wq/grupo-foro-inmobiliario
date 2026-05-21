import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function checkHmac(body: string, secret: string, sigHeader: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return sigHeader.replace(/^sha256=/, "") === expected;
}

async function syncProperty(userId: string, data: Record<string, unknown>, update: boolean) {
  const origen = `kiteprop:${data.id ?? data.code ?? ""}`;
  const payload = {
    perfil_id: userId,
    titulo: String(data.title ?? data.address ?? "Propiedad Kiteprop"),
    tipo: String(data.property_type ?? data.type ?? "Otro"),
    operacion: String(data.operation_type ?? data.operation ?? "Venta"),
    precio: data.price ? parseFloat(String(data.price)) : null,
    moneda: String(data.currency ?? "USD"),
    direccion: String(data.address ?? data.street ?? "") || null,
    zona: String(data.neighborhood ?? data.zone ?? "") || null,
    ciudad: String(data.city ?? "") || null,
    dormitorios: data.bedrooms ? parseInt(String(data.bedrooms)) : null,
    superficie_cubierta: data.covered_area ? parseFloat(String(data.covered_area)) : null,
    estado: "activa",
    url_portal_origen: origen,
  };

  const { data: existing } = await sb
    .from("cartera_propiedades")
    .select("id")
    .eq("perfil_id", userId)
    .eq("url_portal_origen", origen)
    .maybeSingle();

  if (existing) {
    await sb.from("cartera_propiedades").update(payload).eq("id", existing.id);
  } else if (!update) {
    await sb.from("cartera_propiedades").insert(payload);
  }
}

async function syncContact(userId: string, data: Record<string, unknown>) {
  const email = String(data.email ?? "").trim().toLowerCase() || null;
  const payload = {
    perfil_id: userId,
    nombre: String(data.first_name ?? data.name ?? "Sin nombre"),
    apellido: String(data.last_name ?? "") || null,
    email,
    telefono: String(data.phone ?? data.mobile ?? "") || null,
    estado: "prospecto",
    origen: "kiteprop",
  };

  if (email) {
    const { data: existing } = await sb
      .from("crm_contactos")
      .select("id")
      .eq("perfil_id", userId)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      await sb.from("crm_contactos").update(payload).eq("id", existing.id);
      return;
    }
  }
  await sb.from("crm_contactos").insert(payload);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  const rawBody = await req.text();

  const { data: configRow } = await sb
    .from("crm_integraciones_config")
    .select("config")
    .eq("perfil_id", userId)
    .eq("tipo", "kiteprop")
    .single();

  const config = configRow?.config as Record<string, string> | null;
  if (!config) return NextResponse.json({ error: "No configurado" }, { status: 404 });

  if (config.webhook_secret) {
    const sig =
      req.headers.get("x-signature") ??
      req.headers.get("x-webhook-signature") ??
      req.headers.get("x-kiteprop-signature") ?? "";
    if (!sig || !checkHmac(rawBody, config.webhook_secret, sig)) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
  }

  let body: { event: string; data: Record<string, unknown> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { event, data } = body;

  try {
    if (event === "property.created") await syncProperty(userId, data, false);
    else if (event === "property.updated") await syncProperty(userId, data, true);
    else if (event === "contact.created" || event === "contact.updated") await syncContact(userId, data);
    // visit.confirmed, visit.cancelled, message.*, signature.completed → acknowledged but not persisted yet

    await sb.from("crm_integraciones_log").insert({
      perfil_id: userId,
      tipo: "kiteprop_webhook",
      estado: "completado",
      filas_importadas: 1,
      filas_error: 0,
      detalle: { event },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    await sb.from("crm_integraciones_log").insert({
      perfil_id: userId,
      tipo: "kiteprop_webhook",
      estado: "error",
      filas_importadas: 0,
      filas_error: 1,
      detalle: { event, error: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
