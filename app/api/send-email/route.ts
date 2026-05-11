import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { rateLimit, getIp } from "../../lib/ratelimit";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  // 10 emails per user per hour
  if (!rateLimit(`email:${getIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intentá más tarde." }, { status: 429 });
  }

  try {
    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: "GFI® <noreply@foroinmobiliario.com.ar>",
      to,
      subject,
      html,
    });

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
