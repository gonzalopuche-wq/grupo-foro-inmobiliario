// API: Genera y envía comprobante de pago de alquiler por email
// POST /api/crm/comprobante-pago
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

function generarNroComprobante(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `GFI-${ts}-${rand}`;
}

function buildHtml(data: {
  nro: string;
  inquilino: string;
  propietario: string;
  direccion: string;
  mes: string;
  monto: number;
  moneda: string;
  fecha_pago: string;
  corredor: string;
  matricula?: string;
  telefono?: string;
  notas?: string;
}): string {
  const mesLabel = (() => {
    const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const [y, m] = data.mes.split("-");
    return `${MESES[parseInt(m) - 1]} ${y}`;
  })();

  const montoFmt = data.moneda === "USD"
    ? `USD ${data.monto.toLocaleString("es-AR")}`
    : `$ ${data.monto.toLocaleString("es-AR")}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Comprobante de Pago · GFI</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#0d0d0d;padding:28px 32px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:0.04em;">GFI®</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.1em;margin-top:2px;">GRUPO FORO INMOBILIARIO</div>
      </div>
      <div style="text-align:right;">
        <div style="background:#cc0000;color:#fff;padding:6px 16px;border-radius:5px;font-size:12px;font-weight:700;letter-spacing:0.06em;">COMPROBANTE DE PAGO</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:6px;">${data.nro}</div>
      </div>
    </div>

    <!-- Contenido -->
    <div style="padding:32px;">
      <!-- Monto destacado -->
      <div style="text-align:center;padding:24px;background:#f9f9f9;border-radius:8px;margin-bottom:28px;border:1px solid #eee;">
        <div style="font-size:11px;color:#888;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">Monto abonado · ${mesLabel}</div>
        <div style="font-size:40px;font-weight:800;color:#cc0000;">${montoFmt}</div>
        <div style="font-size:12px;color:#888;margin-top:6px;">Fecha de pago: ${new Date(data.fecha_pago).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</div>
      </div>

      <!-- Datos -->
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888;width:40%;font-weight:600;">Inquilino</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;font-weight:700;">${data.inquilino}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888;font-weight:600;">Propietario</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;">${data.propietario}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888;font-weight:600;">Propiedad</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;">${data.direccion}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888;font-weight:600;">Período</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;">${mesLabel}</td>
        </tr>
        ${data.notas ? `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888;font-weight:600;">Notas</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;font-style:italic;">${data.notas}</td>
        </tr>` : ""}
      </table>

      <!-- Corredor -->
      <div style="margin-top:24px;padding:16px;background:#0a0a0a;border-radius:8px;color:#fff;">
        <div style="font-size:13px;font-weight:700;">${data.corredor}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:3px;">
          ${data.matricula ? `Mat. ${data.matricula} · COCIR` : "Corredor Inmobiliario · COCIR"}
        </div>
        ${data.telefono ? `<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:3px;">${data.telefono}</div>` : ""}
      </div>

      <!-- Footer legal -->
      <div style="margin-top:20px;font-size:10px;color:#bbb;line-height:1.6;">
        Este comprobante fue generado electrónicamente por GFI® Grupo Foro Inmobiliario, Rosario, Argentina.
        Número de comprobante: <strong>${data.nro}</strong>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb
    .from("perfiles")
    .select("nombre, apellido, matricula, telefono")
    .eq("id", user.id)
    .single();

  const body = await req.json() as {
    pago_id?: string;
    inquilino: string;
    propietario: string;
    direccion: string;
    mes: string;
    monto: number;
    moneda: string;
    fecha_pago: string;
    email_inquilino?: string;
    email_propietario?: string;
    notas?: string;
  };

  const nro = generarNroComprobante();
  const corredor = perfil ? `${perfil.nombre} ${perfil.apellido}` : "Corredor GFI";

  const html = buildHtml({
    nro,
    inquilino: body.inquilino,
    propietario: body.propietario,
    direccion: body.direccion,
    mes: body.mes,
    monto: body.monto,
    moneda: body.moneda ?? "ARS",
    fecha_pago: body.fecha_pago,
    corredor,
    matricula: perfil?.matricula ?? undefined,
    telefono: perfil?.telefono ?? undefined,
    notas: body.notas ?? undefined,
  });

  const destinatarios: string[] = [];
  if (body.email_inquilino) destinatarios.push(body.email_inquilino);
  if (body.email_propietario) destinatarios.push(body.email_propietario);

  const mesLabel = (() => {
    const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const [y, m] = body.mes.split("-");
    return `${MESES[parseInt(m) - 1]} ${y}`;
  })();

  let enviado = false;
  if (destinatarios.length > 0) {
    const { error } = await resend.emails.send({
      from: "GFI Comprobantes <noreply@foroinmobiliario.com.ar>",
      to: destinatarios,
      subject: `🧾 Comprobante de pago ${mesLabel} · ${body.direccion}`,
      html,
    });
    enviado = !error;
  }

  return NextResponse.json({ ok: true, nro, html, enviado, destinatarios });
}
