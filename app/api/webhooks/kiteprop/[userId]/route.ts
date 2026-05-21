import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KP_TIPO: Record<string, string> = {
  apartments: "departamento", houses: "casa", ph: "ph", duplex: "duplex",
  offices: "oficina", locals: "local", land: "terreno", parking: "cochera",
  warehouses: "galpón", buildings: "edificio", field: "campo", shop: "local",
};
const KP_ESTADO: Record<string, string> = {
  active: "disponible", inactive: "suspendida", sold: "vendida", rented: "alquilada",
};

function checkHmac(body: string, secret: string, sigHeader: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sigHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Sincroniza una propiedad KiteProp → cartera_propiedades usando kiteprop_id como clave
async function syncProperty(userId: string, kp: Record<string, unknown>) {
  const kpId = String(kp.id ?? "");
  if (!kpId) return;

  const imgs = (kp.images_list as { lg?: string }[] | null) ?? [];
  const fotos = imgs.map(i => i.lg).filter(Boolean);
  const operacion = kp.for_sale && kp.for_rent ? "ambas" : kp.for_sale ? "venta" : "alquiler";
  const precio = (kp.for_sale_price ?? kp.for_rent_price ?? null) as number | null;
  const geo = kp.geo as { lat?: number; lon?: number } | null;

  const payload = {
    perfil_id: userId,
    kiteprop_id: kpId,
    kiteprop_sync_at: new Date().toISOString(),
    titulo: kp.title ?? kp.address,
    tipo: KP_TIPO[(kp.type as string) ?? ""] ?? (kp.type as string) ?? null,
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
    estado: KP_ESTADO[(kp.status as string) ?? "active"] ?? "disponible",
    origen: "kiteprop",
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await sb
    .from("cartera_propiedades")
    .select("id")
    .eq("perfil_id", userId)
    .eq("kiteprop_id", kpId)
    .maybeSingle();

  if (existing) {
    await sb.from("cartera_propiedades").update(payload).eq("id", existing.id);
  } else {
    await sb.from("cartera_propiedades").insert(payload);
  }
}

// Sincroniza un contacto de KiteProp → crm_contactos
async function syncContact(userId: string, data: Record<string, unknown>) {
  const email = String(data.email ?? "").trim().toLowerCase() || null;
  const telefono = String(data.phone ?? data.mobile ?? "").trim() || null;
  const payload = {
    perfil_id: userId,
    nombre: String(data.first_name ?? data.name ?? "Sin nombre"),
    apellido: String(data.last_name ?? "") || null,
    email,
    telefono,
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

// Crea o actualiza un contacto a partir de un mensaje/lead recibido desde KiteProp
async function syncLead(userId: string, data: Record<string, unknown>) {
  const sender = data.sender as Record<string, unknown> | null;
  if (!sender) return;

  const email = String(sender.email ?? "").trim().toLowerCase() || null;
  const telefono = String(sender.phone ?? sender.mobile ?? "").trim() || null;
  const nombre = String(sender.name ?? sender.first_name ?? "Sin nombre");
  const prop = data.property as Record<string, unknown> | null;
  const nota = [
    data.message ? `Mensaje: ${data.message}` : null,
    prop?.title ? `Propiedad: ${prop.title}` : null,
  ].filter(Boolean).join(" | ");

  const contactPayload = {
    perfil_id: userId,
    nombre,
    email,
    telefono,
    origen: "kiteprop",
    notas: nota || null,
  };

  if (email) {
    const { data: existing } = await sb
      .from("crm_contactos")
      .select("id")
      .eq("perfil_id", userId)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      await sb.from("crm_contactos").update(contactPayload).eq("id", existing.id);
      return;
    }
  }
  await sb.from("crm_contactos").insert(contactPayload);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const rawBody = await req.text();

  const { data: configRow } = await sb
    .from("crm_integraciones_config")
    .select("config")
    .eq("perfil_id", userId)
    .eq("tipo", "kiteprop")
    .single();

  const config = configRow?.config as Record<string, string> | null;
  if (!config) return NextResponse.json({ error: "No configurado" }, { status: 404 });

  // Verificación HMAC si el secret está guardado
  if (config.webhook_secret) {
    const sig = req.headers.get("x-kiteprop-signature") ?? "";
    if (!sig || !checkHmac(rawBody, config.webhook_secret, sig)) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
  }

  let body: { event?: string; data?: Record<string, unknown> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const event = body.event ?? "";
  const data = body.data ?? {};

  try {
    switch (event) {
      case "property.created":
      case "property.updated":
        await syncProperty(userId, data);
        break;

      case "contact.created":
      case "contact.updated":
        await syncContact(userId, data);
        break;

      case "message.received":
      case "message.replied":
        await syncLead(userId, data);
        break;

      case "visit.confirmed":
      case "visit.cancelled":
      case "signature.completed":
        // Registrados en el log, sin acción adicional por ahora
        break;
    }

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
