import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

function verificarCron(req: NextRequest) {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Obtener todos los leads de los últimos 7 días
  const { data: leads, error } = await sb
    .from("web_leads")
    .select("perfil_id, nombre, email, telefono, tipo, created_at, propiedad_id, cartera_propiedades(titulo)")
    .gte("created_at", hace7)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads || leads.length === 0) return NextResponse.json({ enviados: 0, msg: "Sin leads esta semana" });

  // Agrupar por perfil_id
  const porPerfil = new Map<string, typeof leads>();
  for (const lead of leads) {
    const lista = porPerfil.get(lead.perfil_id) ?? [];
    lista.push(lead);
    porPerfil.set(lead.perfil_id, lista);
  }

  // Obtener datos de los corredores
  const perfilIds = Array.from(porPerfil.keys());
  const { data: perfiles } = await sb
    .from("perfiles")
    .select("id, nombre, apellido, email, inmobiliaria")
    .in("id", perfilIds);

  const perfilMap = new Map((perfiles ?? []).map((p: any) => [p.id, p]));
  const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";

  let enviados = 0;
  let errores = 0;

  for (const [perfilId, leadsDelCorredor] of porPerfil) {
    const perfil = perfilMap.get(perfilId) as any;
    if (!perfil?.email) continue;

    const corredor = `${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim() || "Corredor";
    const inmob = perfil.inmobiliaria ? `${perfil.inmobiliaria} · ` : "";
    const noLeidos = leadsDelCorredor.length;

    const filas = leadsDelCorredor.map((l: any) => {
      const prop = (l.cartera_propiedades as any)?.titulo ?? "—";
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;font-weight:600;">${esc(l.nombre)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">
            ${l.telefono ? `<a href="tel:${esc(l.telefono)}" style="color:#990000;text-decoration:none;">${esc(l.telefono)}</a>` : "—"}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">
            ${l.email ? `<a href="mailto:${esc(l.email)}" style="color:#990000;text-decoration:none;">${esc(l.email)}</a>` : "—"}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#888;">${esc(prop)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#aaa;">${fmt(l.created_at)}</td>
        </tr>
      `;
    }).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#222;">
        <div style="background:#990000;padding:22px 28px;">
          <div style="color:#fff;font-size:18px;font-weight:bold;">GFI® · ${esc(inmob)}${esc(corredor)}</div>
          <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Resumen semanal de consultas</div>
        </div>
        <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;background:#fff;">
          <p style="font-size:15px;margin-top:0;">Hola ${esc(perfil.nombre ?? corredor)},</p>
          <p style="font-size:14px;color:#555;">
            Esta semana recibiste <strong style="color:#990000;">${noLeidos} consulta${noLeidos !== 1 ? "s" : ""}</strong> desde el sitio web.
          </p>
          <div style="overflow-x:auto;margin-top:20px;">
            <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">
              <thead>
                <tr style="background:#f8f8f8;">
                  <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999;border-bottom:2px solid #e5e7eb;">Nombre</th>
                  <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999;border-bottom:2px solid #e5e7eb;">Teléfono</th>
                  <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999;border-bottom:2px solid #e5e7eb;">Email</th>
                  <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999;border-bottom:2px solid #e5e7eb;">Propiedad</th>
                  <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#999;border-bottom:2px solid #e5e7eb;">Fecha</th>
                </tr>
              </thead>
              <tbody>${filas}</tbody>
            </table>
          </div>
          <div style="margin-top:24px;text-align:center;">
            <a href="${BASE}/mi-web/leads" style="background:#990000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:13px;font-weight:700;display:inline-block;">Ver todas las consultas →</a>
          </div>
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#bbb;text-align:center;">
            Resumen semanal GFI® · ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>
    `;

    try {
      await resend.emails.send({
        from: "GFI® Resumen <noreply@foroinmobiliario.com.ar>",
        to: perfil.email,
        subject: `Tu resumen semanal: ${noLeidos} consulta${noLeidos !== 1 ? "s" : ""} recibida${noLeidos !== 1 ? "s" : ""}`,
        html,
      });
      enviados++;
    } catch {
      errores++;
    }
  }

  return NextResponse.json({ enviados, errores, total_leads: leads.length, perfiles: perfilIds.length });
}
