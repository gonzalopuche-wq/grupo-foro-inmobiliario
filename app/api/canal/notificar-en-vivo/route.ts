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

export async function POST(req: NextRequest) {
  // Verificar que el llamador es admin vía JWT
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  ).auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { titulo } = await req.json();

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

  const payload = JSON.stringify({
    titulo: "📡 ¡Canal del Foro en vivo ahora!",
    body: titulo ?? "Transmisión en vivo",
    url: "/canal-educativo",
  });

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

  return NextResponse.json({ ok: true, enviados });
}
