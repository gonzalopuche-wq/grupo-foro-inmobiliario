import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

async function getAdminUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;
  const { data: perfil } = await supabaseAdmin
    .from("perfiles")
    .select("tipo")
    .eq("id", user.id)
    .single();
  if (perfil?.tipo !== "admin") return null;
  return user;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; perfiles?: { notif_config?: Record<string, Record<string, boolean>> } };

function pushHabilitado(sub: Sub, tipo_modulo?: string): boolean {
  if (!tipo_modulo) return true;
  const cfg = sub.perfiles?.notif_config;
  if (!cfg) return true;
  return cfg[tipo_modulo]?.push !== false;
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { titulo, cuerpo, url, filtro, tipo_modulo } = await req.json();
  if (!titulo || !cuerpo) {
    return NextResponse.json({ error: "Faltan título y cuerpo" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, perfiles!perfil_id(notif_config)");

  if (filtro === "7d") {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", desde);
  } else if (filtro === "30d") {
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", desde);
  }

  const { data: rawSubs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const subs = ((rawSubs ?? []) as unknown as Sub[]).filter(s => pushHabilitado(s, tipo_modulo));

  const payload = JSON.stringify({ title: titulo, body: cuerpo, url: url || "/dashboard" });
  let enviados = 0;
  const fallidos: string[] = [];

  if (subs.length > 0) {
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
  }

  await supabaseAdmin.from("push_broadcasts").insert({
    admin_id: admin.id,
    titulo,
    cuerpo,
    url: url || null,
    filtro: filtro || "todos",
    enviados,
  });

  return NextResponse.json({ ok: true, enviados, fallidos: fallidos.length });
}

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("push_broadcasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ ok: true, broadcasts: data ?? [] });
}
