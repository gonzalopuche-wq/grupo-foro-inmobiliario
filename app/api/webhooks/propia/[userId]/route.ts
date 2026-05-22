import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function str(v: unknown): string {
  return String(v ?? "").trim();
}

// Verifica firma HMAC si Propia la envía (opcional)
async function verificarFirma(req: NextRequest, body: string, userId: string): Promise<boolean> {
  const sig = req.headers.get("x-propia-signature") ?? req.headers.get("x-propia-hmac") ?? "";
  if (!sig) return true; // Sin firma → aceptar (Propia puede no enviar firma)

  const { data } = await sb
    .from("crm_integraciones_config")
    .select("config")
    .eq("perfil_id", userId)
    .eq("tipo", "propia")
    .maybeSingle();

  const secret = (data?.config as Record<string, string> | null)?.webhook_secret ?? "";
  if (!secret) return true;

  const { createHmac } = await import("crypto");
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig.replace("sha256=", "")), Buffer.from(expected));
  } catch {
    return false;
  }
}

interface WebhookPayload {
  event?: string; tipo?: string; type?: string;
  [key: string]: unknown;
}

async function syncContacto(userId: string, data: Record<string, unknown>) {
  const nombre = str(data.nombre ?? data.first_name ?? data.name) || "Sin nombre";
  const apellido = str(data.apellido ?? data.last_name ?? data.surname);
  const email = str(data.email ?? data.correo) || null;
  const telefono = str(data.telefono ?? data.phone ?? data.celular ?? data.mobile) || null;
  const notas = str(data.notas ?? data.notes ?? data.mensaje ?? data.message);
  const externoId = str(data.id ?? data.inquiry_id ?? data.contact_id);

  if (!email && !telefono) return;

  let contactoId: string | null = null;

  if (email) {
    const { data: ex } = await sb
      .from("crm_contactos").select("id, etiquetas").eq("perfil_id", userId).eq("email", email).maybeSingle();
    if (ex) {
      const ets: string[] = [...new Set([...(ex.etiquetas ?? []), "Propia"])];
      await sb.from("crm_contactos").update({ etiquetas: ets, origen: "propia" }).eq("id", ex.id);
      contactoId = ex.id as string;
    }
  }
  if (!contactoId && telefono) {
    const { data: ex } = await sb
      .from("crm_contactos").select("id, etiquetas").eq("perfil_id", userId).eq("telefono", telefono).maybeSingle();
    if (ex) {
      const ets: string[] = [...new Set([...(ex.etiquetas ?? []), "Propia"])];
      await sb.from("crm_contactos").update({ etiquetas: ets, origen: "propia" }).eq("id", ex.id);
      contactoId = ex.id as string;
    }
  }
  if (!contactoId) {
    const { data: nuevo } = await sb
      .from("crm_contactos")
      .insert({
        perfil_id: userId, nombre, apellido: apellido || null,
        email, telefono, etiquetas: ["Propia"], origen: "propia",
        notas: notas || null, tipo: "cliente", estado: "lead:nuevo",
      })
      .select("id").single();
    if (nuevo) contactoId = (nuevo as { id: string }).id;
  }

  // Crear búsqueda si hay criterios de búsqueda
  const criterios: Record<string, unknown> = {};
  const tipo = str(data.tipo_propiedad ?? data.property_type);
  const operacion = str(data.operacion ?? data.operation);
  const zona = str(data.zona ?? data.location ?? data.barrio);
  if (tipo)      criterios.tipo      = tipo;
  if (operacion) criterios.operacion = operacion;
  if (zona)      criterios.zona      = zona;

  if (contactoId && Object.keys(criterios).length > 0 && externoId) {
    await sb.from("crm_listas_busqueda").upsert({
      corredor_id: userId, contacto_id: contactoId,
      nombre: `Búsqueda Propia — ${nombre}${apellido ? " " + apellido : ""}`,
      criterios, origen: "propia",
      externo_id: `propia:${externoId}`,
      email_cliente: email, notificar_cliente: false, publica: false,
    }, { onConflict: "corredor_id,externo_id" });
  }
}

async function syncPropiedad(userId: string, data: Record<string, unknown>) {
  const propiaId = str(data.id ?? data.property_id ?? data.external_id);
  if (!propiaId) return;

  const operacionRaw = str(data.operation ?? data.operacion);
  const operacion = operacionRaw.includes("rent") || operacionRaw === "alquiler" ? "Alquiler"
    : operacionRaw.includes("sale") || operacionRaw === "venta" ? "Venta" : "Ambas";

  const payload = {
    propia_id: propiaId,
    propia_sync_at: new Date().toISOString(),
    titulo: str(data.title ?? data.titulo) || null,
    tipo: str(data.property_type ?? data.tipo) || null,
    operacion,
    precio: (data.price ?? data.precio ?? null) as number | null,
    moneda: str(data.currency ?? data.moneda) || "USD",
    direccion: str(data.address ?? data.direccion) || null,
    zona: str(data.neighbourhood ?? data.neighborhood ?? data.zona) || null,
    ciudad: str(data.city ?? data.ciudad) || null,
    ambientes: data.rooms ?? null,
    dormitorios: data.bedrooms ?? null,
    banos: data.bathrooms ?? null,
    superficie_total: data.total_meters ?? null,
    superficie_cubierta: data.covered_meters ?? null,
    fotos: Array.isArray(data.images) ? (data.images as { lg?: string; url?: string }[]).map(i => i.lg ?? i.url).filter(Boolean) : [],
    estado: "activa",
    origen: "propia",
    updated_at: new Date().toISOString(),
  };

  const { data: ex } = await sb
    .from("cartera_propiedades").select("id").eq("perfil_id", userId).eq("propia_id", propiaId).maybeSingle();

  if (ex) {
    await sb.from("cartera_propiedades").update(payload).eq("id", (ex as { id: string }).id);
  } else {
    await sb.from("cartera_propiedades").insert({ perfil_id: userId, ...payload });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const bodyText = await req.text();

  // Verificar firma si existe
  const firmaOk = await verificarFirma(req, bodyText, userId);
  if (!firmaOk) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const event = str(payload.event ?? payload.tipo ?? payload.type).toLowerCase();
  const data = (payload.data ?? payload.property ?? payload.contact ?? payload.inquiry ?? payload) as Record<string, unknown>;

  try {
    if (event.includes("inquiry") || event.includes("lead") || event.includes("contact") || event.includes("consulta")) {
      await syncContacto(userId, data);
    } else if (event.includes("property") || event.includes("propiedad")) {
      await syncPropiedad(userId, data);
    } else {
      // Evento desconocido — intentar inferir por campos presentes
      if ("email" in data || "telefono" in data || "phone" in data) {
        await syncContacto(userId, data);
      } else if ("property_type" in data || "tipo_propiedad" in data) {
        await syncPropiedad(userId, data);
      }
    }

    // Log en crm_integraciones_log
    await sb.from("crm_integraciones_log").insert({
      perfil_id: userId, tipo: "propia_webhook",
      estado: "completado", filas_importadas: 1, filas_error: 0,
      detalle: { event, ts: new Date().toISOString() },
    });
  } catch (e: unknown) {
    await sb.from("crm_integraciones_log").insert({
      perfil_id: userId, tipo: "propia_webhook",
      estado: "error", filas_importadas: 0, filas_error: 1,
      detalle: { event, error: e instanceof Error ? e.message : "Error", ts: new Date().toISOString() },
    });
  }

  return NextResponse.json({ ok: true });
}
