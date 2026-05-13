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

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ahora = new Date();

  // Eventos publicados, con notif activa, que aún no ocurrieron (o recurrentes con sesiones futuras)
  const { data: eventos, error: evErr } = await sb
    .from("eventos")
    .select("id, titulo, fecha, fecha_fin, tipo, notif_frecuencia, notif_audiencia, notif_ultimo_envio, notif_total_enviadas, es_recurrente, fechas_recurrentes, recurrencia_desc")
    .eq("estado", "publicado")
    .eq("notif_activa", true);

  if (evErr) return NextResponse.json({ ok: false, error: evErr.message });
  if (!eventos || eventos.length === 0) {
    return NextResponse.json({ ok: true, procesados: 0, message: "Sin eventos para notificar" });
  }

  // Filtrar: solo eventos con fechas futuras
  const eventosFuturos = eventos.filter(ev => {
    if (ev.es_recurrente && ev.fechas_recurrentes && ev.fechas_recurrentes.length > 0) {
      // Recurrente: al menos una sesión futura
      return ev.fechas_recurrentes.some((f: string) => new Date(f + "T23:59:00") > ahora);
    }
    const fechaCierre = ev.fecha_fin ? new Date(ev.fecha_fin) : new Date(ev.fecha);
    return fechaCierre > ahora;
  });

  const resultados: { id: string; titulo: string; enviados: number; omitido?: string }[] = [];

  for (const ev of eventosFuturos) {
    const frecuencia = Math.max(1, Math.min(7, ev.notif_frecuencia ?? 2));
    // Intervalo mínimo entre envíos en horas
    const intervaloHoras = (7 / frecuencia) * 24;
    const ultimoEnvio = ev.notif_ultimo_envio ? new Date(ev.notif_ultimo_envio) : null;
    const horasDesdeUltimo = ultimoEnvio
      ? (ahora.getTime() - ultimoEnvio.getTime()) / (1000 * 60 * 60)
      : Infinity;

    if (horasDesdeUltimo < intervaloHoras) {
      resultados.push({ id: ev.id, titulo: ev.titulo, enviados: 0, omitido: "intervalo no cumplido" });
      continue;
    }

    // Obtener suscripciones según audiencia
    const audiencia = ev.notif_audiencia ?? "todos";
    let subs: { endpoint: string; p256dh: string; auth: string }[] = [];

    if (audiencia === "corredores") {
      const { data: perfilesIds } = await sb
        .from("perfiles")
        .select("id")
        .in("tipo", ["corredor", "admin"]);
      const ids = (perfilesIds ?? []).map((p: any) => p.id);
      if (ids.length > 0) {
        const { data } = await sb
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("eventos", true)
          .in("perfil_id", ids);
        subs = data ?? [];
      }
    } else if (audiencia === "vip") {
      const { data: perfilesIds } = await sb
        .from("perfiles")
        .select("id")
        .eq("categoria", "vip");
      const ids = (perfilesIds ?? []).map((p: any) => p.id);
      if (ids.length > 0) {
        const { data } = await sb
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("eventos", true)
          .in("perfil_id", ids);
        subs = data ?? [];
      }
    } else {
      // todos
      const { data } = await sb
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("eventos", true);
      subs = data ?? [];
    }

    if (subs.length === 0) {
      resultados.push({ id: ev.id, titulo: ev.titulo, enviados: 0, omitido: "sin suscriptores" });
      continue;
    }

    let cuandoMsg: string;
    if (ev.es_recurrente && ev.fechas_recurrentes && ev.fechas_recurrentes.length > 0) {
      const proximaFecha = ev.fechas_recurrentes
        .filter((f: string) => new Date(f + "T23:59:00") > ahora)
        .sort()[0];
      const diasProxima = Math.ceil((new Date(proximaFecha + "T12:00:00").getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
      cuandoMsg = diasProxima <= 1 ? "¡Próxima sesión mañana!" :
        diasProxima <= 7 ? `Próxima sesión en ${diasProxima} días` :
        `Próxima sesión el ${new Date(proximaFecha + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`;
    } else {
      const diasRestantes = Math.ceil(
        (new Date(ev.fecha + "T12:00:00").getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
      );
      cuandoMsg =
        diasRestantes <= 1 ? "¡Es mañana!" :
        diasRestantes <= 7 ? `En ${diasRestantes} días` :
        `El ${new Date(ev.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`;
    }

    const payload = JSON.stringify({
      titulo: `📅 ${ev.titulo}`,
      body: cuandoMsg,
      url: "/eventos",
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
          if (e.statusCode === 410 || e.statusCode === 404) {
            fallidos.push(sub.endpoint);
          }
        }
      })
    );

    // Eliminar suscripciones vencidas
    if (fallidos.length > 0) {
      await sb.from("push_subscriptions").delete().in("endpoint", fallidos);
    }

    // Actualizar estadísticas del evento
    await sb.from("eventos").update({
      notif_ultimo_envio: ahora.toISOString(),
      notif_total_enviadas: (ev.notif_total_enviadas ?? 0) + enviados,
    }).eq("id", ev.id);

    resultados.push({ id: ev.id, titulo: ev.titulo, enviados });
  }

  return NextResponse.json({ ok: true, procesados: resultados.length, resultados });
}
