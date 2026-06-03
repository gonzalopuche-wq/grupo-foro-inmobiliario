// Cron: newsletter-leads — cada lunes a las 9am ARG
// Envía propiedades nuevas (últimos 7 días) a contactos CRM que matchean criterios de búsqueda
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
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";

const MAX_EMAILS = 50;

function verificarCron(req: NextRequest) {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function formatPrecio(precio: number | null | undefined, moneda: string | null | undefined) {
  if (!precio) return "Consultar";
  const sym = moneda === "USD" ? "USD" : "$";
  return `${sym} ${precio.toLocaleString("es-AR")}`;
}

function matchContacto(
  contacto: { zona_interes?: string | null; presupuesto_max?: number | null; moneda?: string | null; interes?: string | null },
  prop: { barrio?: string | null; ciudad?: string | null; precio?: number | null; moneda?: string | null; tipo_operacion?: string | null }
): boolean {
  // Zona: match parcial (zona_interes puede ser barrio o ciudad)
  if (contacto.zona_interes) {
    const zona = contacto.zona_interes.toLowerCase().trim();
    const barrio = (prop.barrio ?? "").toLowerCase();
    const ciudad = (prop.ciudad ?? "").toLowerCase();
    if (!barrio.includes(zona) && !ciudad.includes(zona) && !zona.includes(barrio) && !zona.includes(ciudad)) {
      return false;
    }
  }

  // Presupuesto: precio de la propiedad <= presupuesto_max del contacto
  if (contacto.presupuesto_max && prop.precio) {
    // Solo comparar si la moneda coincide
    if (contacto.moneda && prop.moneda && contacto.moneda === prop.moneda) {
      if (prop.precio > contacto.presupuesto_max) return false;
    }
  }

  // Interés: match con tipo_operacion (compra → venta, alquiler → alquiler)
  if (contacto.interes && prop.tipo_operacion) {
    const interes = contacto.interes.toLowerCase();
    const operacion = prop.tipo_operacion.toLowerCase();
    if (interes === "compra" && !operacion.includes("venta")) return false;
    if (interes === "alquiler" && !operacion.includes("alquiler")) return false;
  }

  return true;
}

function buildHtml(params: {
  contacto: { nombre?: string | null; apellido?: string | null };
  corredor: { nombre?: string | null; apellido?: string | null; inmobiliaria?: string | null; telefono?: string | null; celular?: string | null };
  propiedades: Array<{
    id: string;
    titulo?: string | null;
    tipo_operacion?: string | null;
    tipo_inmueble?: string | null;
    precio?: number | null;
    moneda?: string | null;
    barrio?: string | null;
    ciudad?: string | null;
  }>;
}) {
  const { contacto, corredor, propiedades } = params;

  const nombreContacto = esc(contacto.nombre ?? "");
  const nombreCorredor = esc(`${corredor.nombre ?? ""} ${corredor.apellido ?? ""}`.trim() || "Tu corredor");
  const inmobiliaria = corredor.inmobiliaria ? esc(corredor.inmobiliaria) : "GFI";
  const telCorredor = esc(corredor.celular ?? corredor.telefono ?? "");

  const cardsPropiedades = propiedades.map((prop) => {
    const titulo = esc(prop.titulo ?? "Propiedad");
    const tipo = [prop.tipo_operacion, prop.tipo_inmueble].filter(Boolean).map(esc).join(" · ");
    const precio = esc(formatPrecio(prop.precio, prop.moneda));
    const ubicacion = [prop.barrio, prop.ciudad].filter(Boolean).map(esc).join(", ");
    const link = `${siteUrl}/b/${prop.id}`;

    return `
      <div style="background:#121820;border:1px solid rgba(58,186,182,0.15);border-radius:8px;padding:18px 20px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:700;color:#eef2f6;margin-bottom:6px;">${titulo}</div>
        ${tipo ? `<div style="font-size:11px;color:#3abab6;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">${tipo}</div>` : ""}
        <div style="font-size:13px;color:#eef2f6;font-weight:600;margin-bottom:4px;">${precio}</div>
        ${ubicacion ? `<div style="font-size:12px;color:rgba(238,242,246,0.55);margin-bottom:10px;">${ubicacion}</div>` : ""}
        <a href="${link}" style="display:inline-block;background:#3abab6;color:#0a0e14;font-size:11px;font-weight:700;text-decoration:none;padding:6px 14px;border-radius:4px;letter-spacing:0.05em;">
          Ver propiedad →
        </a>
      </div>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0e14;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e14;padding:36px 16px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0a0e14;border:1px solid rgba(58,186,182,0.2);border-bottom:none;border-radius:10px 10px 0 0;padding:24px 28px;">
              <span style="font-family:Arial,sans-serif;font-size:20px;font-weight:800;color:#eef2f6;letter-spacing:-0.02em;">
                GFI<span style="color:#3abab6;">.</span>
              </span>
              <span style="display:block;font-size:10px;color:rgba(238,242,246,0.35);letter-spacing:0.15em;text-transform:uppercase;margin-top:3px;">
                Nuevas Propiedades
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#0a0e14;border:1px solid rgba(58,186,182,0.2);border-top:none;border-bottom:none;padding:28px 28px 8px;">
              <p style="color:#eef2f6;font-size:15px;margin:0 0 8px;font-weight:600;">
                Hola ${nombreContacto},
              </p>
              <p style="color:rgba(238,242,246,0.65);font-size:13px;margin:0 0 24px;line-height:1.6;">
                Tu corredor <strong style="color:#eef2f6;">${nombreCorredor}</strong> de <strong style="color:#eef2f6;">${inmobiliaria}</strong> encontró propiedades que coinciden con tu búsqueda:
              </p>

              ${cardsPropiedades}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0a0e14;border:1px solid rgba(58,186,182,0.2);border-top:1px solid rgba(58,186,182,0.08);border-radius:0 0 10px 10px;padding:18px 28px;">
              <p style="color:rgba(238,242,246,0.35);font-size:11px;margin:0;line-height:1.6;">
                Contacto: <span style="color:rgba(238,242,246,0.6);">${nombreCorredor}</span>
                ${telCorredor ? ` &mdash; <a href="tel:${telCorredor}" style="color:#3abab6;text-decoration:none;">${telCorredor}</a>` : ""}
              </p>
              <p style="color:rgba(238,242,246,0.2);font-size:10px;margin:8px 0 0;letter-spacing:0.04em;">
                GFI Foro Inmobiliario &middot; ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Propiedades de los últimos 7 días
  const { data: propiedades, error: errorProps } = await sb
    .from("cartera_propiedades")
    .select("id, perfil_id, titulo, tipo_operacion, tipo_inmueble, precio, moneda, barrio, ciudad, descripcion, created_at")
    .gte("created_at", hace7)
    .order("created_at", { ascending: false });

  if (errorProps) {
    return NextResponse.json({ error: errorProps.message }, { status: 500 });
  }
  if (!propiedades || propiedades.length === 0) {
    return NextResponse.json({ emails_enviados: 0, contactos_procesados: 0, errores: 0, msg: "Sin propiedades nuevas esta semana" });
  }

  // 2. Contactos con email, estado != 'perdido'
  const { data: contactos, error: errorContactos } = await sb
    .from("crm_contactos")
    .select("id, perfil_id, nombre, apellido, email, zona_interes, presupuesto_max, moneda, estado, interes")
    .not("email", "is", null)
    .neq("estado", "perdido");

  if (errorContactos) {
    return NextResponse.json({ error: errorContactos.message }, { status: 500 });
  }
  if (!contactos || contactos.length === 0) {
    return NextResponse.json({ emails_enviados: 0, contactos_procesados: 0, errores: 0, msg: "Sin contactos con email" });
  }

  // Agrupar propiedades por corredor (perfil_id)
  const propsPorCorredor = new Map<string, typeof propiedades>();
  for (const prop of propiedades) {
    const lista = propsPorCorredor.get(prop.perfil_id) ?? [];
    lista.push(prop);
    propsPorCorredor.set(prop.perfil_id, lista);
  }

  // Obtener datos de los corredores involucrados
  const corredorIds = Array.from(propsPorCorredor.keys());
  const { data: perfiles } = await sb
    .from("perfiles")
    .select("id, nombre, apellido, inmobiliaria, telefono, celular")
    .in("id", corredorIds);

  const perfilMap = new Map((perfiles ?? []).map((p: any) => [p.id, p]));

  let emails_enviados = 0;
  let contactos_procesados = 0;
  let errores = 0;

  // 3. Para cada contacto, filtrar propiedades del mismo corredor que matcheen
  for (const contacto of contactos) {
    if (emails_enviados >= MAX_EMAILS) break;
    if (!contacto.email) continue;

    contactos_procesados++;

    // Solo propiedades del corredor dueño del contacto
    const propsDelCorredor = propsPorCorredor.get(contacto.perfil_id) ?? [];
    if (propsDelCorredor.length === 0) continue;

    const propsMatch = propsDelCorredor.filter((prop) => matchContacto(contacto, prop));
    if (propsMatch.length === 0) continue;

    // 4. Datos del corredor
    const corredor = (perfilMap.get(contacto.perfil_id) ?? {}) as any;

    // 5. Armar y enviar email
    const html = buildHtml({ contacto, corredor, propiedades: propsMatch });

    try {
      await resend.emails.send({
        from: "GFI <noticias@foroinmobiliario.com.ar>",
        to: contacto.email,
        subject: "Propiedades nuevas para vos — GFI",
        html,
      });
      emails_enviados++;
    } catch {
      errores++;
    }
  }

  return NextResponse.json({ emails_enviados, contactos_procesados, errores });
}
