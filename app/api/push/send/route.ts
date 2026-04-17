import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { titulo, body, url, tipo } = await req.json();

    if (!titulo || !body) {
      return NextResponse.json({ error: "Faltan título y body" }, { status: 400 });
    }

    // Traer todos los suscriptores según el tipo
    let query = supabaseAdmin.from("push_subscriptions").select("*");
    if (tipo === "eventos") query = query.eq("eventos", true);

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
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          enviados++;
        } catch (err: any) {
          // Si el endpoint ya no es válido (410 Gone), eliminarlo
          if (err.statusCode === 410 || err.statusCode === 404) {
            fallidos.push(sub.id);
          }
        }
      })
    );

    // Limpiar suscripciones inválidas
    if (fallidos.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", fallidos);
    }

    return NextResponse.json({ ok: true, enviados, fallidos: fallidos.length });
  } catch (error) {
    console.error("Error enviando push:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
