import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, tipo, nombre, email, telefono, mensaje, direccion } = body;

    if (!slug || !nombre || !tipo) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Obtener corredor y su email
    const { data: cfg } = await supabase
      .from("web_corredor_config")
      .select("perfil_id, titulo_sitio")
      .eq("slug", slug)
      .eq("activa", true)
      .single();

    if (!cfg) return NextResponse.json({ error: "Web no encontrada" }, { status: 404 });

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, apellido, email")
      .eq("id", cfg.perfil_id)
      .single();

    const corredor = perfil ? `${perfil.nombre} ${perfil.apellido}` : "Corredor";
    const emailDestino = perfil?.email;

    const esTasacion = tipo === "tasacion";
    const asunto = esTasacion
      ? `Nueva solicitud de tasación desde tu web`
      : `Nuevo mensaje de contacto desde tu web`;

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;color:#222;">
        <div style="background:#cc0000;padding:20px 24px;">
          <div style="color:#fff;font-size:18px;font-weight:bold;">GFI® · ${cfg.titulo_sitio || corredor}</div>
          <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">${esTasacion ? "Nueva solicitud de tasación" : "Nuevo mensaje de contacto"}</div>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;font-size:12px;color:#666;width:120px;">Nombre</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${nombre}</td></tr>
            ${email ? `<tr><td style="padding:8px 0;font-size:12px;color:#666;">Email</td><td style="padding:8px 0;font-size:14px;"><a href="mailto:${email}" style="color:#cc0000;">${email}</a></td></tr>` : ""}
            ${telefono ? `<tr><td style="padding:8px 0;font-size:12px;color:#666;">Teléfono</td><td style="padding:8px 0;font-size:14px;"><a href="tel:${telefono}" style="color:#cc0000;">${telefono}</a></td></tr>` : ""}
            ${direccion ? `<tr><td style="padding:8px 0;font-size:12px;color:#666;">Dirección</td><td style="padding:8px 0;font-size:14px;">${direccion}</td></tr>` : ""}
          </table>
          ${mensaje ? `<div style="margin-top:16px;padding:16px;background:#f9f9f9;border-radius:6px;border-left:3px solid #cc0000;"><div style="font-size:12px;color:#666;margin-bottom:6px;">MENSAJE</div><div style="font-size:14px;white-space:pre-wrap;">${mensaje}</div></div>` : ""}
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#999;">
            Recibido desde tu web GFI® · ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    `;

    if (emailDestino) {
      await resend.emails.send({
        from: "GFI® Web <noreply@foroinmobiliario.com.ar>",
        to: emailDestino,
        replyTo: email || undefined,
        subject: asunto,
        html: htmlBody,
      });
    }

    // Guardar lead en Supabase para el corredor
    try {
      await supabase.from("web_leads").insert({
        perfil_id: cfg.perfil_id,
        slug,
        tipo,
        nombre,
        email: email || null,
        telefono: telefono || null,
        mensaje: mensaje || null,
        direccion_propiedad: direccion || null,
      });
    } catch { /* silenciar si la tabla no existe todavía */ }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("web-contacto error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
