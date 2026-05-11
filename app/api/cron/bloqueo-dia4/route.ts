import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function verificarCron(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Skip suspensions during admin-configured free period
    const { data: freeConfig } = await supabaseAdmin
      .from("indicadores")
      .select("valor_texto")
      .eq("clave", "free_until")
      .maybeSingle();
    if ((freeConfig as any)?.valor_texto && new Date() < new Date((freeConfig as any).valor_texto)) {
      return NextResponse.json({ ok: true, bloqueados: 0, motivo: "periodo_gratuito" });
    }

    const hoy = new Date();
    // Fecha de hace 4 días (vencieron hace 4 días y no pagaron)
    const hace4dias = new Date(hoy);
    hace4dias.setDate(hace4dias.getDate() - 4);
    const fecha4dias = hace4dias.toISOString().split("T")[0];

    // Buscar suscripciones vencidas hace exactamente 4 días sin pago confirmado
    const { data: vencidas } = await supabaseAdmin
      .from("suscripciones")
      .select(`
        id,
        perfil_id,
        plan,
        fecha_vencimiento,
        perfiles!perfil_id (
          nombre,
          apellido,
          matricula
        )
      `)
      .eq("estado", "activa")
      .lte("fecha_vencimiento", fecha4dias);

    if (!vencidas || vencidas.length === 0) {
      return NextResponse.json({ ok: true, bloqueados: 0 });
    }

    let bloqueados = 0;
    const errores: string[] = [];

    for (const s of vencidas) {
      // 1. Bloquear: cambiar estado a suspendida
      const { error: errorBloqueo } = await supabaseAdmin
        .from("suscripciones")
        .update({ estado: "suspendida" })
        .eq("id", s.id);

      if (errorBloqueo) {
        errores.push(`Error bloqueando ${s.perfil_id}: ${errorBloqueo.message}`);
        continue;
      }

      // 2. Registrar en notificaciones in-app
      await supabaseAdmin
        .from("notificaciones")
        .insert({
          user_id: s.perfil_id,
          titulo: "Acceso suspendido",
          mensaje: "Tu suscripción venció y no se registró el pago. Realizá la transferencia para reactivar.",
          tipo: "suscripcion",
          url: "/suscripcion",
        });

      // 3. Buscar email del usuario (perfil_id = auth.users.id)
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(s.perfil_id);
      const email = authUser?.user?.email;
      const perfil = s.perfiles as any;
      const nombre = perfil ? `${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim() : "Corredor";

      // 4. Buscar CBU desde indicadores (misma fuente que la página de suscripción)
      const { data: indicadores } = await supabaseAdmin
        .from("indicadores")
        .select("clave, valor")
        .in("clave", ["cbu_cvu", "cbu_alias", "cbu_titular"]);
      const ind = Object.fromEntries((indicadores ?? []).map((r: any) => [r.clave, r.valor]));
      const cbu = ind.cbu_cvu ?? "CVU no configurado — contactar al administrador";
      const cbuAlias = ind.cbu_alias ?? "";

      // 5. Enviar email de suspensión
      if (email) {
        await resend.emails.send({
          from: "GFI® Foro Inmobiliario <noreply@foroinmobiliario.com.ar>",
          to: email,
          subject: "Acceso suspendido — GFI® Foro Inmobiliario",
          html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid rgba(200,0,0,0.3);border-radius:10px;overflow:hidden;max-width:580px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:#0d0d0d;padding:24px 32px;border-bottom:1px solid rgba(200,0,0,0.2);">
              <span style="font-family:'Montserrat',Arial,sans-serif;font-size:18px;font-weight:800;color:#fff;">
                GFI<span style="color:#cc0000;">®</span>
              </span>
              <span style="display:block;font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;margin-top:2px;">
                Grupo Foro Inmobiliario
              </span>
            </td>
          </tr>

          <!-- Alerta -->
          <tr>
            <td style="padding:0;">
              <div style="background:rgba(200,0,0,0.08);border-bottom:1px solid rgba(200,0,0,0.2);padding:16px 32px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:24px;">⚠️</span>
                <span style="font-family:'Montserrat',Arial,sans-serif;font-size:13px;font-weight:700;color:#cc0000;letter-spacing:0.05em;">
                  TU ACCESO FUE SUSPENDIDO
                </span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 16px;line-height:1.6;">
                Hola <strong style="color:#fff;">${nombre}</strong>,
              </p>
              <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 24px;line-height:1.6;">
                Tu acceso a GFI® fue suspendido porque han pasado 4 días desde el vencimiento de tu suscripción sin que se haya registrado el pago correspondiente.
              </p>

              <!-- Para reactivar -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <span style="display:block;font-size:10px;color:rgba(255,255,255,0.3);font-family:'Montserrat',Arial,sans-serif;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">
                      Para reactivar tu acceso
                    </span>
                    <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0 0 8px;line-height:1.6;">
                      1. Realizá la transferencia bancaria al siguiente CVU:
                    </p>
                    <span style="display:block;font-size:13px;color:#fff;font-family:'Courier New',monospace;letter-spacing:0.05em;margin-bottom:4px;">
                      CVU: ${cbu}
                    </span>
                    ${cbuAlias ? `<span style="display:block;font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:12px;">Alias: ${cbuAlias}</span>` : `<span style="display:block;margin-bottom:12px;"></span>`}
                    <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0 0 8px;line-height:1.6;">
                      2. Ingresá a GFI® y avisá que realizaste el pago desde la sección Suscripción.
                    </p>
                    <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0;line-height:1.6;">
                      3. El admin verifica el mismo día hábil y reactiva tu acceso.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Montos -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(200,0,0,0.06);border:1px solid rgba(200,0,0,0.15);border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.4);font-family:'Montserrat',Arial,sans-serif;">
                      Monto: <strong style="color:#fff;">USD ${s.plan === "colaborador" ? "5" : "15"} / mes</strong>
                      &nbsp;·&nbsp; Mat. ${perfil?.matricula ?? ""}
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

              <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;margin:24px 0 0;line-height:1.6;">
                Si tenés alguna consulta escribí a admin@foroinmobiliario.com.ar
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
      }

      bloqueados++;
    }

    return NextResponse.json({
      ok: true,
      bloqueados,
      total: vencidas.length,
      errores,
    });

  } catch (err) {
    console.error("Error en cron bloqueo día 4:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
