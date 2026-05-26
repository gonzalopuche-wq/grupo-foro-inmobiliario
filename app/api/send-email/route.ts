import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getIp } from "../../lib/ratelimit";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  // Require authenticated session OR internal server secret
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternal = internalSecret === process.env.CRON_SECRET;

  if (!token && !isInternal) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (token) {
    const { data: { user } } = await sbAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (!rateLimit(`email:${user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Intentá más tarde." }, { status: 429 });
    }
  } else {
    // Internal calls: still rate limit by IP
    if (!rateLimit(`email:${getIp(req)}`, 50, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    }
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
