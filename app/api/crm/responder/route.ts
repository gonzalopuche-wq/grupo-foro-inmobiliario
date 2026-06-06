// Respuesta unificada del inbox CRM — despacha por el canal real (WhatsApp / Email)
// y registra la interacción saliente en crm_interacciones.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendWhatsAppMessage } from "../../../../lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(authToken);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: {
    tipo?: string; to?: string; cuerpo?: string; contacto_id?: string | null; asunto?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { tipo, to, cuerpo, contacto_id, asunto } = body ?? {};
  if (!cuerpo || !cuerpo.trim()) return NextResponse.json({ error: "El mensaje está vacío" }, { status: 400 });

  const canal = String(tipo ?? "").toLowerCase();
  let enviado = false;
  let canalAviso: string | null = null;

  if (canal === "whatsapp") {
    const numero = String(to ?? "").replace(/[\s+\-()]/g, "");
    if (!/^\d{10,15}$/.test(numero)) {
      return NextResponse.json({ error: "El contacto no tiene un número de WhatsApp válido (10-15 dígitos con código de país)." }, { status: 400 });
    }
    enviado = await sendWhatsAppMessage(numero, cuerpo.trim());
    if (!enviado) canalAviso = "No se pudo enviar por WhatsApp. Verificá que WHATSAPP_PHONE_ID y WHATSAPP_ACCESS_TOKEN estén configurados en el entorno.";
  } else if (canal === "email") {
    const email = String(to ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "El contacto no tiene un email válido." }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      canalAviso = "No se pudo enviar el email. Falta configurar RESEND_API_KEY en el entorno.";
    } else {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;white-space:pre-wrap">${escapeHtml(cuerpo.trim())}</div>`;
        const { error } = await resend.emails.send({
          from: "GFI® <noreply@foroinmobiliario.com.ar>",
          to: email,
          subject: asunto?.trim() || "Respuesta a tu consulta — GFI®",
          html,
        });
        enviado = !error;
        if (error) canalAviso = "El proveedor de email rechazó el envío.";
      } catch {
        canalAviso = "Error al enviar el email.";
      }
    }
  } else {
    // Canales sin despacho automático (portal_lead, sms, llamada): solo se registra.
    enviado = false;
    canalAviso = null;
  }

  // Registrar la interacción saliente (siempre, para mantener el hilo)
  const ahora = new Date().toISOString();
  const { error: insErr } = await sb.from("crm_interacciones").insert({
    perfil_id: user.id,
    contacto_id: contacto_id ?? null,
    tipo: canal || "nota",
    direccion: "saliente",
    cuerpo: cuerpo.trim(),
    leido: true,
    created_at: ahora,
    updated_at: ahora,
  });
  if (insErr) {
    return NextResponse.json({ error: "Se intentó enviar, pero falló el registro: " + insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enviado, aviso: canalAviso });
}
