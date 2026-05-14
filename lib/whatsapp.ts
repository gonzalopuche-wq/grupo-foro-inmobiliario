import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createHmac } from "crypto";

const WA_GRAPH_URL = "https://graph.facebook.com/v18.0";

// Grupos del Foro que tienen parser MIR activo
const GRUPOS_MIR = new Set([
  "ventas-ofrecidos",
  "ventas-busqueda",
  "alquileres-ofrecidos",
  "alquileres-busqueda",
  "alquileres-temporarios",
  "permutas",
  "campos-chacras",
  "inmuebles-comerciales",
  "fondos-comercio",
]);

// ── Envío de mensajes via Cloud API ──────────────────────────────────────────

export async function sendWhatsAppMessage(to: string, body: string): Promise<boolean> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token   = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) return false;
  try {
    const res = await fetch(`${WA_GRAPH_URL}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Verificación de firma Meta (X-Hub-Signature-256) ─────────────────────────

export function verifyMetaSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // Dev: skip if not configured
  try {
    const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
    return expected === signature;
  } catch {
    return false;
  }
}

// ── Inferencia de grupo GFI desde contenido del mensaje ──────────────────────

export function inferGrupoGfi(texto: string): string {
  const lower = texto.toLowerCase();
  const esBusqueda = /^(busco|necesito|busca|cliente busca|buscamos|busco para cliente|necesitamos)\b/i.test(texto);
  const esAlquiler = /\balquil/i.test(lower);
  const esTemporal = /\btempor/i.test(lower);
  const esComercial = /\b(local|comercio|oficina|fondo de comercio|galp[oó]n)\b/i.test(lower);
  const esPermuta   = /\bpermut/i.test(lower);
  const esCampo     = /\b(campo|chacra|tambo|lote rural)\b/i.test(lower);

  if (esPermuta)   return "permutas";
  if (esCampo)     return "campos-chacras";
  if (esComercial) return "inmuebles-comerciales";

  if (esBusqueda) {
    if (esTemporal || esAlquiler) return "alquileres-busqueda";
    return "ventas-busqueda";
  }
  if (esTemporal) return "alquileres-temporarios";
  if (esAlquiler) return "alquileres-ofrecidos";
  return "ventas-ofrecidos";
}

// ── Smart Prospecting: notifica corredores con búsquedas compatibles ─────────
// Llamado justo después de insertar un nuevo mir_ofrecido desde WhatsApp

export async function runSmartProspecting(ofrecidoId: string): Promise<void> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@gfi.com.ar",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }

  const { data: o } = await sb.from("mir_ofrecidos").select("*").eq("id", ofrecidoId).single();
  if (!o) return;

  // venta → compra para buscar en busquedas
  const opBusqueda = o.operacion === "venta" ? "compra" : o.operacion;

  let query = sb
    .from("mir_busquedas")
    .select("id, perfil_id")
    .eq("activo", true)
    .eq("tipo_propiedad", o.tipo_propiedad)
    .eq("operacion", opBusqueda)
    .neq("perfil_id", o.perfil_id);

  if (o.dormitorios) query = query.lte("dormitorios_min", o.dormitorios);

  if (o.precio && o.moneda) {
    query = query
      .eq("moneda", o.moneda)
      .or(`presupuesto_max.is.null,presupuesto_max.gte.${o.precio}`)
      .or(`presupuesto_min.is.null,presupuesto_min.lte.${o.precio}`);
  }

  const { data: busquedas } = await query;
  if (!busquedas?.length) return;

  const perfilIds = [...new Set(busquedas.map((b) => b.perfil_id as string))];

  const tipoProp = o.tipo_propiedad ?? "propiedad";
  const zona     = o.zona ? ` en ${o.zona}` : "";
  const pushBody = `Ingresó ${tipoProp}${zona} compatible con tu búsqueda. ¿Enviás la ficha al cliente?`;

  // Push notifications
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("perfil_id", perfilIds);

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "🏠 Smart Prospecting — GFI®",
            body:  pushBody,
            url:   "/mir",
            tag:   `sp-${ofrecidoId}`,
          })
        );
      } catch {}
    }
  }

  // In-app notifications
  const notifs = perfilIds.map((uid) => ({
    user_id: uid,
    titulo:  "Smart Prospecting — Nueva propiedad compatible",
    mensaje: pushBody,
    tipo:    "smart_prospecting",
    url:     "/mir",
    leido:   false,
  }));
  if (notifs.length) await sb.from("notificaciones").insert(notifs);
}

// ── Parser inline (reutiliza lógica del /api/comunidad/parser) ────────────────
// Normalizar operación para mir_busquedas
const OPERACION_BUSQUEDA: Record<string, string> = {
  venta: "compra", alquiler: "alquiler",
  alquiler_temporario: "alquiler_temporario",
  permuta: "permuta", campo: "campo",
  comercial: "comercial", fondo_comercio: "fondo_comercio",
  compra: "compra",
};
const SUBTIPO: Record<string, "ofrecido" | "busqueda"> = {
  "ventas-ofrecidos": "ofrecido", "ventas-busqueda": "busqueda",
  "alquileres-ofrecidos": "ofrecido", "alquileres-busqueda": "busqueda",
  "alquileres-temporarios": "ofrecido", "permutas": "ofrecido",
  "campos-chacras": "ofrecido", "inmuebles-comerciales": "ofrecido",
  "fondos-comercio": "ofrecido",
};
const OPERACION_GRUPO: Record<string, string> = {
  "ventas-ofrecidos": "venta", "ventas-busqueda": "venta",
  "alquileres-ofrecidos": "alquiler", "alquileres-busqueda": "alquiler",
  "alquileres-temporarios": "alquiler_temporario",
  "permutas": "permuta", "campos-chacras": "campo",
  "inmuebles-comerciales": "comercial", "fondos-comercio": "fondo_comercio",
};

export { GRUPOS_MIR, SUBTIPO, OPERACION_GRUPO, OPERACION_BUSQUEDA };
