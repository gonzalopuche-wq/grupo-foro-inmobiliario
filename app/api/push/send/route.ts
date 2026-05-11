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

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-internal-secret");
  return secret === process.env.CRON_SECRET;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; perfiles?: { notif_config?: Record<string, Record<string, boolean>> } };

// Returns true if the user hasn't explicitly disabled push for this module (default: enabled)
function pushHabilitado(sub: Sub, tipo_modulo?: string): boolean {
  if (!tipo_modulo) return true;
  const cfg = sub.perfiles?.notif_config;
  if (!cfg) return true;
  return cfg[tipo_modulo]?.push !== false;
}

async function despacharPush(subs: Sub[], payload: string): Promise<{ enviados: number; fallidos: string[] }> {
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
  return { enviados, fallidos };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { titulo, body, url, tipo, perfil_id, tipo_modulo } = await req.json();

    if (!titulo || !body) {
      return NextResponse.json({ error: "Faltan título y body" }, { status: 400 });
    }

    // Always join with perfiles to get notif_config for preference filtering
    let query = supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, perfiles!perfil_id(notif_config)");

    if (perfil_id) query = query.eq("perfil_id", perfil_id);
    else if (tipo === "eventos") query = query.eq("eventos", true);

    const { data: rawSubs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rawSubs || rawSubs.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

    const subs = (rawSubs as unknown as Sub[]).filter(s => pushHabilitado(s, tipo_modulo));
    if (subs.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

    const payload = JSON.stringify({ title: titulo, body, url: url || "/dashboard" });
    const { enviados, fallidos } = await despacharPush(subs, payload);

    if (fallidos.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", fallidos);
    }

    return NextResponse.json({ ok: true, enviados, fallidos: fallidos.length });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
