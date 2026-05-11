import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

// Protección: solo Vercel Cron puede llamar este endpoint
function verificarCron(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const hoy = new Date();
    const primeroDeMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDeMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    // Es el último día del mes?
    const esUltimoDia = hoy.getDate() === ultimoDeMes.getDate();
    if (!esUltimoDia) {
      return NextResponse.json({ ok: true, mensaje: "No es el último día del mes, nada que hacer" });
    }

    // Buscar corredores con suscripción activa
    const { data: suscripciones } = await supabaseAdmin
      .from("suscripciones")
      .select(`
        id,
        perfil_id,
        plan,
        monto_usd,
        fecha_vencimiento,
        perfiles!perfil_id (
          nombre,
          apellido,
          matricula
        )
      `)
      .eq("estado", "activa");

    if (!suscripciones || suscripciones.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0 });
    }

    // Buscar CBU desde indicadores (misma fuente que la página de suscripción)
    const { data: indicadores } = await supabaseAdmin
      .from("indicadores")
      .select("clave, valor")
      .in("clave", ["cbu_cvu", "cbu_alias", "cbu_titular", "cbu_banco"]);

    const ind = Object.fromEntries((indicadores ?? []).map((r: any) => [r.clave, r.valor]));
    const cbu = ind.cbu_cvu ?? "CVU no configurado";
    const cbuAlias = ind.cbu_alias ?? "";
    const cbuTitular = ind.cbu_titular ?? "";

    // Monto según plan
    const montoMatriculado = 15;
    const montoColaborador = 5;

    let enviados = 0;
    const errores: string[] = [];

    for (const s of suscripciones) {
      const perfil = s.perfiles as any;

      // Obtener email desde auth usando perfil_id (= auth.users.id)
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(s.perfil_id);
      const email = authUser?.user?.email;

      if (!email) continue;

      const nombre = perfil
        ? `${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim()
        : "Corredor";

      const monto = s.plan === "colaborador" ? montoColaborador : montoMatriculado;
      const mesProximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
        .toLocaleDateString("es-AR", { month: "long", year: "numeric" });

      const { error } = await resend.emails.send({
        from: "GFI® Foro Inmobiliario <noreply@foroinmobiliario.com.ar>",
        to: email,
        subject: `Recordatorio de suscripción — ${mesProximo}`,
        html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de suscripción GFI®</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid rgba(200,0,0,0.2);border-radius:10px;overflow:hidden;max-width:580px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:#0d0d0d;padding:24px 32px;border-bottom:1px solid rgba(200,0,0,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:'Montserrat',Arial,sans-serif;font-size:18px;font-weight:800;color:#fff;letter-spacing:0.02em;">
                      GFI<span style="color:#cc0000;">®</span>
                    </span>
                    <span style="display:block;font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;margin-top:2px;">
                      Grupo Foro Inmobiliario
                    </span>
                  </td>
                  <td align="right">
                    <span style="background:rgba(200,0,0,0.1);border:1px solid rgba(200,0,0,0.25);color:#cc0000;font-size:10px;font-family:'Montserrat',Arial,sans-serif;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:4px 10px;border-radius:4px;">
                      Suscripción
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 8px;">
                Hola <strong style="color:#fff;">${nombre}</strong>,
              </p>
              <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 28px;line-height:1.6;">
                Tu suscripción a GFI® vence hoy. Para continuar con acceso completo a la plataforma, realizá la transferencia bancaria antes de las 23:59 de hoy.
              </p>

              <!-- Monto -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(200,0,0,0.06);border:1px solid rgba(200,0,0,0.15);border-radius:8px;margin-bottom:20px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <span style="display:block;font-size:10px;color:rgba(255,255,255,0.3);font-family:'Montserrat',Arial,sans-serif;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">
                      Monto a abonar
                    </span>
                    <span style="font-size:32px;font-weight:800;color:#fff;font-family:'Montserrat',Arial,sans-serif;">
                      USD ${monto}
                    </span>
                    <span style="display:block;font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">
                      Equivalente en ARS al tipo de cambio del día
                    </span>
                  </td>
                </tr>
              </table>

              <!-- CBU -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <span style="display:block;font-size:10px;color:rgba(255,255,255,0.3);font-family:'Montserrat',Arial,sans-serif;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">
                      Datos de transferencia
                    </span>
                    <span style="display:block;font-size:13px;color:#fff;font-family:'Courier New',monospace;letter-spacing:0.05em;">
                      CVU: ${cbu}
                    </span>
                    ${cbuAlias ? `<span style="display:block;font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">Alias: ${cbuAlias}</span>` : ""}
                    ${cbuTitular ? `<span style="display:block;font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">Titular: ${cbuTitular}</span>` : ""}
                    <span style="display:block;font-size:11px;color:rgba(255,255,255,0.3);margin-top:6px;">
                      Concepto: GFI ${mesProximo} — Mat. ${perfil?.matricula ?? ""}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://foroinmobiliario.com.ar/suscripcion"
                       style="display:inline-block;background:#cc0000;color:#fff;font-family:'Montserrat',Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:6px;">
                      Avisar que pagué →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:rgba(255,255,255,0.25);font-size:11px;text-align:center;margin:24px 0 0;line-height:1.6;">
                Si ya realizaste la transferencia, el admin la verifica el mismo día hábil.<br>
                Tenés 3 días de gracia. Al 4to día sin confirmar, el acceso se suspende automáticamente.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d0d0d;padding:16px 32px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="color:rgba(255,255,255,0.2);font-size:10px;margin:0;font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.05em;">
                GFI® Grupo Foro Inmobiliario · 2da Circunscripción COCIR · Rosario, Santa Fe
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      });

      if (error) {
        errores.push(`${email}: ${error.message}`);
      } else {
        enviados++;
        // Push de recordatorio si el usuario tiene suscripcion.push = true
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";
        fetch(`${siteUrl}/api/push/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": process.env.CRON_SECRET ?? "" },
          body: JSON.stringify({
            perfil_id: s.perfil_id,
            titulo: "⏳ Recordatorio de suscripción GFI®",
            body: `Tu suscripción vence el ${new Date(s.fecha_vencimiento).toLocaleDateString("es-AR")}. Realizá la transferencia para continuar.`,
            url: "/suscripcion",
            tipo_modulo: "suscripcion",
          }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      enviados,
      total: suscripciones.length,
      errores,
    });

  } catch (err) {
    console.error("Error en cron recordatorio:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
