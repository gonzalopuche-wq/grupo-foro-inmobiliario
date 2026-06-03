import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

function fmtFechaLarga(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      contrato_id,
      nueva_fecha_fin,
      nuevo_monto,
      indice_ajuste,
      email_inquilino,
      email_propietario,
    } = body;

    if (!contrato_id || !nueva_fecha_fin || !nuevo_monto) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // Fetch existing contract
    const { data: contratoAnterior, error: fetchErr } = await sb
      .from("crm_contratos")
      .select("*")
      .eq("id", contrato_id)
      .eq("perfil_id", user.id)
      .single();

    if (fetchErr || !contratoAnterior) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    // Mark old contract as "renovado"
    await sb
      .from("crm_contratos")
      .update({ estado: "renovado", updated_at: new Date().toISOString() })
      .eq("id", contrato_id);

    // Create new contract with updated data
    const { data: nuevoContrato, error: insertErr } = await sb
      .from("crm_contratos")
      .insert({
        perfil_id: user.id,
        inquilino_nombre: contratoAnterior.inquilino_nombre,
        inquilino_telefono: contratoAnterior.inquilino_telefono ?? "",
        propietario_nombre: contratoAnterior.propietario_nombre,
        propietario_telefono: contratoAnterior.propietario_telefono ?? "",
        direccion: contratoAnterior.direccion,
        barrio: contratoAnterior.barrio ?? "",
        tipo_propiedad: contratoAnterior.tipo_propiedad ?? "",
        fecha_inicio: contratoAnterior.fecha_fin ?? new Date().toISOString().slice(0, 10),
        fecha_fin: nueva_fecha_fin,
        alquiler_inicial: Number(nuevo_monto),
        alquiler_actual: Number(nuevo_monto),
        moneda: contratoAnterior.moneda,
        indice_ajuste: indice_ajuste ?? contratoAnterior.indice_ajuste,
        periodo_ajuste_meses: contratoAnterior.periodo_ajuste_meses,
        tasa_ajuste_anual: contratoAnterior.tasa_ajuste_anual,
        deposito_meses: contratoAnterior.deposito_meses,
        honorarios_admin: contratoAnterior.honorarios_admin,
        estado: "vigente",
        notas: `Renovación del contrato anterior (ID: ${contrato_id})`,
        contrato_anterior_id: contrato_id,
      })
      .select("id")
      .single();

    if (insertErr || !nuevoContrato) {
      console.error("Error creando contrato renovado:", insertErr);
      return NextResponse.json({ error: "Error al crear el contrato renovado" }, { status: 500 });
    }

    // Send confirmation emails if provided
    const emailsSent: string[] = [];
    const monedaSimbolo = contratoAnterior.moneda === "USD" ? "USD " : "$ ";

    if (email_inquilino) {
      try {
        await resend.emails.send({
          from: "GFI <noticias@foroinmobiliario.com.ar>",
          to: email_inquilino,
          subject: "Renovación de contrato de alquiler confirmada",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
              <div style="background: #990000; padding: 24px 28px; border-radius: 8px 8px 0 0;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Grupo Foro Inmobiliario</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">Confirmación de renovación de contrato</p>
              </div>
              <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
                <p style="margin: 0 0 16px;">Estimado/a <strong>${contratoAnterior.inquilino_nombre}</strong>,</p>
                <p>Le confirmamos que su contrato de alquiler ha sido renovado exitosamente con los siguientes datos:</p>
                <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
                  <tr style="border-bottom: 1px solid #e5e5e5;">
                    <td style="padding: 10px 12px; font-size: 13px; color: #666; width: 40%;">Propiedad</td>
                    <td style="padding: 10px 12px; font-size: 13px; font-weight: 600;">${contratoAnterior.direccion}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e5e5e5;">
                    <td style="padding: 10px 12px; font-size: 13px; color: #666;">Inicio del nuevo contrato</td>
                    <td style="padding: 10px 12px; font-size: 13px; font-weight: 600;">${fmtFechaLarga(contratoAnterior.fecha_fin ?? new Date().toISOString().slice(0, 10))}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e5e5e5;">
                    <td style="padding: 10px 12px; font-size: 13px; color: #666;">Vencimiento</td>
                    <td style="padding: 10px 12px; font-size: 13px; font-weight: 600;">${fmtFechaLarga(nueva_fecha_fin)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 12px; font-size: 13px; color: #666;">Nuevo alquiler mensual</td>
                    <td style="padding: 10px 12px; font-size: 16px; font-weight: 700; color: #990000;">${monedaSimbolo}${Number(nuevo_monto).toLocaleString("es-AR")}</td>
                  </tr>
                </table>
                <p style="font-size: 13px; color: #666;">Ante cualquier consulta, no dude en comunicarse con nosotros.</p>
                <p style="margin-top: 24px;">Atentamente,<br><strong>Grupo Foro Inmobiliario</strong></p>
              </div>
            </div>
          `,
        });
        emailsSent.push(email_inquilino);
      } catch (emailErr) {
        console.error("Error enviando email a inquilino:", emailErr);
      }
    }

    if (email_propietario) {
      try {
        await resend.emails.send({
          from: "GFI <noticias@foroinmobiliario.com.ar>",
          to: email_propietario,
          subject: "Contrato de alquiler renovado — confirmación",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
              <div style="background: #990000; padding: 24px 28px; border-radius: 8px 8px 0 0;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Grupo Foro Inmobiliario</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">Renovación de contrato de alquiler</p>
              </div>
              <div style="background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
                <p style="margin: 0 0 16px;">Estimado/a <strong>${contratoAnterior.propietario_nombre}</strong>,</p>
                <p>Le informamos que el contrato de alquiler de su propiedad ha sido renovado:</p>
                <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
                  <tr style="border-bottom: 1px solid #e5e5e5;">
                    <td style="padding: 10px 12px; font-size: 13px; color: #666; width: 40%;">Propiedad</td>
                    <td style="padding: 10px 12px; font-size: 13px; font-weight: 600;">${contratoAnterior.direccion}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e5e5e5;">
                    <td style="padding: 10px 12px; font-size: 13px; color: #666;">Inquilino</td>
                    <td style="padding: 10px 12px; font-size: 13px; font-weight: 600;">${contratoAnterior.inquilino_nombre}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e5e5e5;">
                    <td style="padding: 10px 12px; font-size: 13px; color: #666;">Período renovado</td>
                    <td style="padding: 10px 12px; font-size: 13px; font-weight: 600;">${fmtFechaLarga(contratoAnterior.fecha_fin ?? new Date().toISOString().slice(0, 10))} → ${fmtFechaLarga(nueva_fecha_fin)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 12px; font-size: 13px; color: #666;">Nuevo alquiler mensual</td>
                    <td style="padding: 10px 12px; font-size: 16px; font-weight: 700; color: #990000;">${monedaSimbolo}${Number(nuevo_monto).toLocaleString("es-AR")}</td>
                  </tr>
                </table>
                <p style="font-size: 13px; color: #666;">El contrato anterior ha quedado registrado como "renovado" en el sistema.</p>
                <p style="margin-top: 24px;">Atentamente,<br><strong>Grupo Foro Inmobiliario</strong></p>
              </div>
            </div>
          `,
        });
        emailsSent.push(email_propietario);
      } catch (emailErr) {
        console.error("Error enviando email a propietario:", emailErr);
      }
    }

    return NextResponse.json({
      ok: true,
      nuevoContratoId: nuevoContrato.id,
      emailsSent,
    });
  } catch (err) {
    console.error("Error renovando contrato:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
