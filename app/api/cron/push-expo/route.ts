// Cron: despacha push notifications nativas (Expo) por las notificaciones de la
// app que todavía no se enviaron (notificaciones.push_enviada = false).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Notificaciones pendientes de push (últimas 24h, para no spamear histórico)
  const { data: notis } = await sb
    .from("notificaciones")
    .select("id, user_id, titulo, cuerpo")
    .eq("push_enviada", false)
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .limit(300);

  if (!notis || notis.length === 0) return NextResponse.json({ ok: true, enviadas: 0 });

  // Tokens de los usuarios involucrados
  const userIds = [...new Set(notis.map((n) => n.user_id).filter(Boolean))];
  if (userIds.length === 0) {
    await sb.from("notificaciones").update({ push_enviada: true }).in("id", notis.map((n) => n.id));
    return NextResponse.json({ ok: true, notificaciones: notis.length, push: 0, enviadas: 0 });
  }

  const { data: tokens } = await sb
    .from("expo_push_tokens")
    .select("perfil_id, token")
    .in("perfil_id", userIds);

  const tokensPorUsuario = new Map<string, string[]>();
  (tokens ?? []).forEach((t) => {
    const arr = tokensPorUsuario.get(t.perfil_id) ?? [];
    arr.push(t.token);
    tokensPorUsuario.set(t.perfil_id, arr);
  });

  // Armar los mensajes Expo
  const mensajes: Array<{ to: string; title: string; body: string; sound: string; data: any }> = [];
  for (const n of notis) {
    for (const token of tokensPorUsuario.get(n.user_id) ?? []) {
      mensajes.push({
        to: token,
        title: n.titulo ?? "GFI®",
        body: (n.cuerpo ?? "").slice(0, 240),
        sound: "default",
        data: { notiId: n.id },
      });
    }
  }

  // Enviar a Expo en lotes de 100. Las notis cuyo lote falla NO se marcan, para reintentar.
  let enviadas = 0;
  const idsFallidos = new Set<string>();
  for (let i = 0; i < mensajes.length; i += 100) {
    const lote = mensajes.slice(i, i + 100);
    if (lote.length === 0) continue;
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(lote),
      });
      if (res.ok) enviadas += lote.length;
      else lote.forEach((m) => idsFallidos.add(m.data.notiId));
    } catch {
      lote.forEach((m) => idsFallidos.add(m.data.notiId));
    }
  }

  // Marcar como despachadas las que no fallaron (las que no tenían token también
  // se marcan, para no reintentar para siempre).
  const idsAMarcar = notis.map((n) => n.id).filter((id) => !idsFallidos.has(id));
  if (idsAMarcar.length > 0) {
    await sb.from("notificaciones").update({ push_enviada: true }).in("id", idsAMarcar);
  }

  return NextResponse.json({ ok: true, notificaciones: notis.length, push: mensajes.length, enviadas });
}
