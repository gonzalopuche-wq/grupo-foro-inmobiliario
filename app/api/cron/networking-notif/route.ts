import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export const maxDuration = 60;

const TIPO_LABEL: Record<string, string> = {
  oportunidad: "💎 Oportunidad",
  urgencia: "🔥 Urgencia de venta",
  necesidad: "🔍 Busco propiedad",
  otro: "💬 Info",
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ahora = new Date();
  const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

  // Posts nuevos activos de las últimas 24h
  const { data: posts, error } = await sb
    .from("networking_posts")
    .select("id, titulo, tipo, ubicacion, user_id")
    .eq("estado", "activo")
    .gte("created_at", hace24h.toISOString());

  if (error) return NextResponse.json({ ok: false, error: error.message });
  if (!posts || posts.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, message: "Sin nuevas publicaciones" });
  }

  // Obtener suscripciones de corredores y admins con networking_nuevo en notif_config
  const { data: perfiles } = await sb
    .from("perfiles")
    .select("id")
    .in("tipo", ["corredor", "admin"]);

  const perfilIds = (perfiles ?? []).map((p: { id: string }) => p.id);
  if (perfilIds.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, message: "Sin perfiles corredor/admin" });
  }

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, perfil_id")
    .in("perfil_id", perfilIds);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, message: "Sin suscriptores push" });
  }

  // Un solo push resumen si hay varios posts nuevos
  const titulo = posts.length === 1
    ? `${TIPO_LABEL[posts[0].tipo] ?? "🤝 Networking"} — ${posts[0].titulo}`
    : `🤝 ${posts.length} nuevas publicaciones en Networking`;

  const body = posts.length === 1
    ? (posts[0].ubicacion ? `📍 ${posts[0].ubicacion}` : "Ver publicación")
    : posts.slice(0, 3).map(p => `· ${p.titulo}`).join("\n");

  const payload = JSON.stringify({ titulo, body, url: "/networking" });

  let enviados = 0;
  const fallidos: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        enviados++;
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) fallidos.push(sub.endpoint);
      }
    })
  );

  if (fallidos.length > 0) {
    await sb.from("push_subscriptions").delete().in("endpoint", fallidos);
  }

  return NextResponse.json({ ok: true, posts: posts.length, enviados });
}
