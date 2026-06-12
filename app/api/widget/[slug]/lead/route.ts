// Captura de lead desde el chatbot embebible: guarda el lead, lo sincroniza al
// CRM (contacto + interacción) con origen 'chatbot-web' y avisa al corredor
// (push + WhatsApp opcional). Público + CORS + rate limit.
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getIp } from "../../../../lib/ratelimit";
import { corsJson, corsPreflight } from "../../../../lib/cors";
import { sendWhatsAppMessage } from "../../../../../lib/whatsapp";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // 5 leads por IP por hora.
  if (!rateLimit(`widget-lead:${getIp(req)}`, 5, 60 * 60 * 1000)) {
    return corsJson({ error: "Demasiadas solicitudes. Intentá más tarde." }, { status: 429 });
  }

  let body: { nombre?: string; telefono?: string; email?: string; mensaje?: string };
  try { body = await req.json(); } catch { return corsJson({ error: "Body inválido" }, { status: 400 }); }
  const nombre = (body.nombre ?? "").toString().trim().slice(0, 120);
  const telefono = (body.telefono ?? "").toString().trim().slice(0, 40) || null;
  const email = (body.email ?? "").toString().trim().slice(0, 160) || null;
  const mensaje = (body.mensaje ?? "").toString().trim().slice(0, 1000) || null;
  if (!nombre || (!telefono && !email)) {
    return corsJson({ error: "Dejá tu nombre y un teléfono o email." }, { status: 400 });
  }

  const { data: cfg } = await supabase
    .from("web_corredor_config")
    .select("perfil_id, activa, chatbot_activo, chatbot_notif_whatsapp, whatsapp")
    .eq("slug", slug)
    .maybeSingle();
  if (!cfg || !cfg.activa || !cfg.chatbot_activo) {
    return corsJson({ error: "No disponible." }, { status: 404 });
  }

  // Guardar lead
  try {
    await supabase.from("web_leads").insert({
      perfil_id: cfg.perfil_id, slug, tipo: "contacto",
      nombre, email, telefono, mensaje,
    });
  } catch { /* no bloquear */ }

  // Sinergia → CRM: contacto + interacción en el inbox unificado
  try {
    let contactoId: string | null = null;
    if (email) {
      const { data: existente } = await supabase.from("crm_contactos")
        .select("id").eq("perfil_id", cfg.perfil_id).eq("email", email).maybeSingle();
      contactoId = existente?.id ?? null;
    }
    if (!contactoId) {
      const [primerNombre, ...resto] = nombre.split(" ");
      const { data: nuevo } = await supabase.from("crm_contactos").insert({
        perfil_id: cfg.perfil_id,
        nombre: primerNombre,
        apellido: resto.join(" ") || null,
        email, telefono,
        estado: "prospecto",
        interes: "Consulta desde chatbot",
        notas: `Lead automático desde el chatbot web (${new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}). ${mensaje ? `Mensaje: ${mensaje}` : ""}`,
        origen: "chatbot-web",
      }).select("id").maybeSingle();
      contactoId = nuevo?.id ?? null;
    }
    const ahora = new Date().toISOString();
    await supabase.from("crm_interacciones").insert({
      perfil_id: cfg.perfil_id, contacto_id: contactoId,
      tipo: "portal_lead", direccion: "entrante",
      cuerpo: mensaje || "Dejó sus datos desde el chatbot web",
      leido: false, created_at: ahora, updated_at: ahora,
    });
  } catch { /* no bloquear */ }

  // Push al corredor
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar"}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({
        perfil_id: cfg.perfil_id,
        titulo: "🤖 Nuevo lead desde el chatbot",
        body: `${nombre}${telefono ? ` · ${telefono}` : ""}${email ? ` · ${email}` : ""}`,
        url: "/mi-web/leads",
        tipo_modulo: "web_lead",
      }),
    }).catch(() => {});
  } catch { /* no bloquear */ }

  // WhatsApp al corredor (opcional)
  if (cfg.chatbot_notif_whatsapp) {
    const dest = (cfg.whatsapp || "").toString().replace(/\D/g, "");
    if (dest) {
      try {
        await sendWhatsAppMessage(dest,
          `🤖 Nuevo lead desde tu chatbot web:\n${nombre}${telefono ? `\n📞 ${telefono}` : ""}${email ? `\n✉️ ${email}` : ""}${mensaje ? `\n💬 ${mensaje}` : ""}`);
      } catch { /* no bloquear */ }
    }
  }

  return corsJson({ ok: true });
}
