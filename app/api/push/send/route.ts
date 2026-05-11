import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Only callable from internal server code via CRON_SECRET header
function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-internal-secret");
  return secret === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { titulo, body, url, tipo, perfil_id } = await req.json();

    if (!titulo || !body) {
      return NextResponse.json({ error: "Faltan título y body" }, { status: 400 });
    }

    let query = supabaseAdmin.from("push_subscriptions").select("*");
    if (perfil_id) query = query.eq("perfil_id", perfil_id);
    else if (tipo === "eventos") query = query.eq("eventos", true);

    const { data: subs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

    const payload = JSON.stringify({ title: titulo, body, url: url || "/eventos" });

    let enviados = 0;
    const fallidos: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          enviados++;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) fallidos.push(sub.id);
        }
      })
    );

    if (fallidos.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", fallidos);
    }

    return NextResponse.json({ ok: true, enviados, fallidos: fallidos.length });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
