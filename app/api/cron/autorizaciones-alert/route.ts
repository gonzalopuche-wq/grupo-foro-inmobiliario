import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Días antes de vencimiento para alertar
const UMBRALES = [
  { dias: 30, campo: "notif_30_enviada" as const, emoji: "📋", nivel: "30 días" },
  { dias: 15, campo: "notif_15_enviada" as const, emoji: "⚠️", nivel: "15 días" },
  { dias: 7,  campo: "notif_7_enviada"  as const, emoji: "🚨", nivel: "7 días" },
];

async function enviarPush(userId: string, title: string, body: string, url: string) {
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return;

  const webpush = await import("web-push");
  webpush.default.setVapidDetails(
    "mailto:soporte@grupoforo.com.ar",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  await Promise.allSettled(subs.map(s =>
    webpush.default.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ title, body, url })
    ).catch(async err => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    })
  ));
}

async function insertarNotifInApp(userId: string, titulo: string, cuerpo: string) {
  await sb.from("notificaciones").insert({
    user_id: userId,
    titulo,
    cuerpo,
    tipo: "sistema",
    leida: false,
  }).maybeSingle();
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Marcar como vencidas las pasadas
  await sb.rpc("marcar_autorizaciones_vencidas").maybeSingle();

  let enviadas = 0;

  for (const { dias, campo, emoji, nivel } of UMBRALES) {
    const fechaTarget = new Date();
    fechaTarget.setDate(fechaTarget.getDate() + dias);
    const fechaStr = fechaTarget.toISOString().slice(0, 10);

    const { data: proximas } = await sb
      .from("autorizaciones_venta")
      .select("id, user_id, direccion, propietario_nombre, fecha_vencimiento")
      .eq("estado", "vigente")
      .eq(campo, false)
      .eq("fecha_vencimiento", fechaStr);

    if (!proximas?.length) continue;

    for (const aut of proximas) {
      const titulo = `${emoji} Autorización por vencer — ${nivel}`;
      const cuerpo = `La autorización de ${aut.propietario_nombre} (${aut.direccion}) vence en ${dias} días. Contactá al propietario para renovar.`;

      await Promise.all([
        enviarPush(aut.user_id, titulo, cuerpo, "/crm/autorizaciones"),
        insertarNotifInApp(aut.user_id, titulo, cuerpo),
        sb.from("autorizaciones_venta").update({ [campo]: true, updated_at: new Date().toISOString() }).eq("id", aut.id),
      ]);

      enviadas++;
    }
  }

  return NextResponse.json({ ok: true, enviadas });
}
