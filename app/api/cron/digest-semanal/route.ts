// Cron: digest semanal — cada lunes a las 8am ARG envia resumen a cada corredor
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";

function verificarCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

async function enviarPush(perfil_id: string, titulo: string, body: string) {
  return fetch(`${siteUrl}/api/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": process.env.CRON_SECRET ?? "" },
    body: JSON.stringify({ perfil_id, titulo, body, url: "/crm/estadisticas" }),
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Rango: últimos 7 días
  const hoy = new Date();
  const hace7 = new Date(hoy);
  hace7.setDate(hace7.getDate() - 7);
  const desde = hace7.toISOString();

  // Traer todos los corredores activos con email
  const { data: perfiles } = await sb
    .from("perfiles")
    .select("id, nombre, apellido, email")
    .in("tipo", ["corredor", "admin", "master"])
    .not("email", "is", null);

  if (!perfiles?.length) return NextResponse.json({ ok: true, enviados: 0 });

  let enviados = 0;
  for (const p of perfiles) {
    try {
      // Stats de la semana para este corredor
      const [
        { count: nuevosLeads },
        { count: negociosActivos },
        { count: tareasHoy },
        { data: negociosCerca },
      ] = await Promise.all([
        sb.from("crm_contactos").select("*", { count: "exact", head: true })
          .eq("perfil_id", p.id).gte("created_at", desde),
        sb.from("crm_negocios").select("*", { count: "exact", head: true })
          .eq("perfil_id", p.id).not("etapa", "in", '("cerrado","perdido")').eq("archivado", false),
        sb.from("crm_tareas").select("*", { count: "exact", head: true })
          .eq("perfil_id", p.id).eq("estado", "pendiente"),
        sb.from("crm_negocios").select("id, titulo, etapa, contacto_id, crm_contactos(nombre, apellido)")
          .eq("perfil_id", p.id).in("etapa", ["negociacion", "reserva", "escritura"]).eq("archivado", false).limit(5),
      ]);

      const nombresNegCerca = (negociosCerca ?? [])
        .map((n: any) => `<li>${n.crm_contactos?.nombre ?? "?"} ${n.crm_contactos?.apellido ?? ""} — <strong>${n.etapa}</strong></li>`)
        .join("");

      // Email HTML
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#fff;border-radius:8px;overflow:hidden;">
          <div style="background:#cc0000;padding:20px 28px;">
            <div style="font-size:22px;font-weight:800;letter-spacing:0.04em;">GFI® Resumen Semanal</div>
            <div style="font-size:13px;opacity:0.8;margin-top:4px;">Hola ${p.nombre}, esto pasó esta semana:</div>
          </div>
          <div style="padding:28px;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:28px;">
              <div style="background:rgba(255,255,255,0.06);border-radius:6px;padding:16px;text-align:center;">
                <div style="font-size:32px;font-weight:800;color:#22c55e;">${nuevosLeads ?? 0}</div>
                <div style="font-size:11px;opacity:0.5;margin-top:4px;text-transform:uppercase;letter-spacing:0.1em;">Leads nuevos</div>
              </div>
              <div style="background:rgba(255,255,255,0.06);border-radius:6px;padding:16px;text-align:center;">
                <div style="font-size:32px;font-weight:800;color:#3b82f6;">${negociosActivos ?? 0}</div>
                <div style="font-size:11px;opacity:0.5;margin-top:4px;text-transform:uppercase;letter-spacing:0.1em;">Negocios activos</div>
              </div>
              <div style="background:rgba(255,255,255,0.06);border-radius:6px;padding:16px;text-align:center;">
                <div style="font-size:32px;font-weight:800;color:#f59e0b;">${tareasHoy ?? 0}</div>
                <div style="font-size:11px;opacity:0.5;margin-top:4px;text-transform:uppercase;letter-spacing:0.1em;">Tareas pendientes</div>
              </div>
            </div>
            ${negociosCerca?.length ? `
              <div style="margin-bottom:20px;">
                <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:10px;">Cerca de cerrar 🔥</div>
                <ul style="padding-left:20px;line-height:1.8;color:rgba(255,255,255,0.8);">${nombresNegCerca}</ul>
              </div>
            ` : ""}
            <div style="text-align:center;margin-top:24px;">
              <a href="${siteUrl}/crm/estadisticas" style="background:#cc0000;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Ver estadísticas completas →</a>
            </div>
          </div>
          <div style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:rgba(255,255,255,0.3);">GFI® Grupo Foro Inmobiliario · Rosario, Argentina</div>
        </div>
      `;

      if (p.email) {
        await resend.emails.send({
          from: "GFI Resumen <noreply@foroinmobiliario.com.ar>",
          to: [p.email],
          subject: `📊 Tu resumen semanal — ${nuevosLeads ?? 0} leads nuevos, ${negociosActivos ?? 0} negocios activos`,
          html,
        });
      }

      await enviarPush(
        p.id,
        "📊 Tu resumen semanal está listo",
        `${nuevosLeads ?? 0} leads nuevos · ${negociosActivos ?? 0} negocios activos · ${tareasHoy ?? 0} tareas pendientes`
      );

      enviados++;
    } catch { /* continuar con el siguiente */ }
  }

  return NextResponse.json({ ok: true, enviados });
}
