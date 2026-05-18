import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { rateLimit, getIp } from "../../lib/ratelimit";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function POST(req: NextRequest) {
  if (!rateLimit(`ficha-lead:${getIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intentá más tarde." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { propiedad_id, nombre, email, telefono, mensaje } = body as {
      propiedad_id: string;
      nombre: string;
      email?: string;
      telefono?: string;
      mensaje?: string;
    };

    if (!propiedad_id || !nombre?.trim()) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Buscar la propiedad para obtener el perfil del corredor
    const { data: prop } = await supabase
      .from("cartera_propiedades")
      .select("id, titulo, ciudad, perfil_id")
      .eq("id", propiedad_id)
      .single();

    if (!prop) {
      return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
    }

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, apellido, email, inmobiliaria")
      .eq("id", prop.perfil_id)
      .single();

    const corredor = perfil ? `${perfil.nombre} ${perfil.apellido}` : "Corredor";
    const emailDestino = perfil?.email;

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;color:#222;">
        <div style="background:#cc0000;padding:20px 24px;">
          <div style="color:#fff;font-size:18px;font-weight:bold;">GFI® · ${esc(perfil?.inmobiliaria || corredor)}</div>
          <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Nueva consulta sobre una propiedad</div>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;">
          <div style="margin-bottom:16px;padding:12px 16px;background:#f9f9f9;border-radius:6px;font-size:13px;color:#444;">
            <strong>Propiedad:</strong> ${esc(prop.titulo)}${prop.ciudad ? ` · ${esc(prop.ciudad)}` : ""}
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;font-size:12px;color:#666;width:120px;">Nombre</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${esc(nombre)}</td></tr>
            ${email ? `<tr><td style="padding:8px 0;font-size:12px;color:#666;">Email</td><td style="padding:8px 0;font-size:14px;"><a href="mailto:${esc(email)}" style="color:#cc0000;">${esc(email)}</a></td></tr>` : ""}
            ${telefono ? `<tr><td style="padding:8px 0;font-size:12px;color:#666;">Teléfono</td><td style="padding:8px 0;font-size:14px;"><a href="tel:${esc(telefono)}" style="color:#cc0000;">${esc(telefono)}</a></td></tr>` : ""}
          </table>
          ${mensaje ? `<div style="margin-top:16px;padding:16px;background:#f9f9f9;border-radius:6px;border-left:3px solid #cc0000;"><div style="font-size:12px;color:#666;margin-bottom:6px;">MENSAJE</div><div style="font-size:14px;white-space:pre-wrap;">${esc(mensaje)}</div></div>` : ""}
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#999;">
            Recibido desde la ficha pública GFI® · ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    `;

    if (emailDestino) {
      await resend.emails.send({
        from: "GFI® Web <noreply@foroinmobiliario.com.ar>",
        to: emailDestino,
        replyTo: email || undefined,
        subject: `Nueva consulta: ${prop.titulo}`,
        html: htmlBody,
      });
    }

    try {
      await supabase.from("web_leads").insert({
        perfil_id: prop.perfil_id,
        slug: null,
        tipo: "contacto",
        nombre,
        email: email || null,
        telefono: telefono || null,
        mensaje: mensaje || null,
        propiedad_id,
      });
    } catch { /* silenciar si falla */ }

    // Sinergia: crear contacto en CRM
    try {
      if (email || telefono) {
        const { data: existente } = await supabase
          .from("crm_contactos")
          .select("id")
          .eq("perfil_id", prop.perfil_id)
          .eq("email", email || "")
          .maybeSingle();

        if (!existente) {
          const [primerNombre, ...resto] = nombre.trim().split(" ");
          await supabase.from("crm_contactos").insert({
            perfil_id: prop.perfil_id,
            nombre: primerNombre,
            apellido: resto.join(" ") || null,
            email: email || null,
            telefono: telefono || null,
            estado: "prospecto",
            interes: `${prop.titulo}${prop.ciudad ? ` (${prop.ciudad})` : ""}`,
            notas: `Lead desde ficha pública (${new Date().toLocaleDateString("es-AR")}). Mensaje: ${mensaje || "Sin mensaje"}`,
            origen: "web_propia",
          });
        }
      }
    } catch { /* no bloquear */ }

    // Sinergia: push notification al corredor
    try {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("subscription")
        .eq("perfil_id", prop.perfil_id);

      if (subs && subs.length > 0) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar"}/api/push/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": process.env.CRON_SECRET ?? "" },
          body: JSON.stringify({
            perfil_id: prop.perfil_id,
            titulo: "🏠 Nueva consulta sobre una propiedad",
            cuerpo: `${nombre}${telefono ? ` · ${telefono}` : ""}${email ? ` · ${email}` : ""} — ${prop.titulo}`,
            url: "/mi-web/leads",
          }),
        }).catch(() => {});
      }
    } catch { /* no bloquear */ }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ficha-lead error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
