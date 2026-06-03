import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

// MercadoPago sends a GET to verify the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // MercadoPago notification types: payment, merchant_order, etc.
    if (body.type !== "payment") {
      return NextResponse.json({ ok: true });
    }

    const payment_id = body.data?.id;
    if (!payment_id) return NextResponse.json({ ok: true });

    // Fetch payment details from MercadoPago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    });

    if (!mpRes.ok) {
      console.error("MP webhook: could not fetch payment", payment_id);
      return NextResponse.json({ error: "Could not fetch payment" }, { status: 502 });
    }

    const payment = await mpRes.json();
    const { status, metadata, transaction_amount, currency_id } = payment;

    const contrato_id = metadata?.contrato_id;
    const perfil_id = metadata?.perfil_id;

    if (!contrato_id) {
      return NextResponse.json({ ok: true });
    }

    // Update the pagos_mp record
    const estadoMap: Record<string, string> = {
      approved: "aprobado",
      pending: "pendiente",
      in_process: "pendiente",
      rejected: "rechazado",
      cancelled: "cancelado",
    };
    const nuevoEstado = estadoMap[status] ?? "pendiente";

    await sb
      .from("pagos_mp")
      .update({
        estado: nuevoEstado,
        mp_payment_id: String(payment_id),
        updated_at: new Date().toISOString(),
      })
      .eq("preference_id", payment.preference_id ?? "")
      .eq("contrato_id", contrato_id);

    // If approved, also mark crm_pagos_alquiler as pagado and send email
    if (status === "approved") {
      // Update the monthly payment tracking record for the current month
      const mes = new Date().toISOString().slice(0, 7);
      const existing = await sb
        .from("crm_pagos_alquiler")
        .select("id")
        .eq("contrato_id", contrato_id)
        .eq("mes", mes)
        .maybeSingle();

      if (existing.data) {
        await sb.from("crm_pagos_alquiler").update({
          estado: "pagado",
          fecha_pago: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        }).eq("id", existing.data.id);
      } else if (perfil_id) {
        await sb.from("crm_pagos_alquiler").insert({
          perfil_id,
          contrato_id,
          mes,
          monto: transaction_amount,
          fecha_pago: new Date().toISOString().slice(0, 10),
          estado: "pagado",
          diferencia: 0,
          notas: `Pago online MP #${payment_id}`,
        });
      }

      // Fetch contract data for the confirmation email
      const { data: contrato } = await sb
        .from("crm_contratos")
        .select("inquilino_nombre, direccion, alquiler_actual, moneda")
        .eq("id", contrato_id)
        .single();

      // Fetch corredor email
      let corredorEmail: string | null = null;
      if (perfil_id) {
        const { data: perfil } = await sb
          .from("profiles")
          .select("email")
          .eq("id", perfil_id)
          .maybeSingle();
        corredorEmail = perfil?.email ?? null;
      }

      if (corredorEmail && contrato) {
        const montoFmt = new Intl.NumberFormat("es-AR").format(transaction_amount);
        await resend.emails.send({
          from: "GFI <noticias@foroinmobiliario.com.ar>",
          to: corredorEmail,
          subject: `Pago confirmado: ${contrato.inquilino_nombre}`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:12px;">
              <h2 style="color:#3abab6;margin-top:0;">Pago Online Confirmado</h2>
              <p>Se acreditó un pago online en MercadoPago.</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#94a3b8;">Inquilino</td><td style="padding:8px 0;font-weight:700;">${contrato.inquilino_nombre}</td></tr>
                <tr><td style="padding:8px 0;color:#94a3b8;">Propiedad</td><td style="padding:8px 0;">${contrato.direccion}</td></tr>
                <tr><td style="padding:8px 0;color:#94a3b8;">Monto pagado</td><td style="padding:8px 0;font-weight:700;color:#3abab6;">${currency_id} ${montoFmt}</td></tr>
                <tr><td style="padding:8px 0;color:#94a3b8;">Fecha</td><td style="padding:8px 0;">${new Date().toLocaleDateString("es-AR")}</td></tr>
                <tr><td style="padding:8px 0;color:#94a3b8;">ID de pago</td><td style="padding:8px 0;font-size:11px;color:#64748b;">${payment_id}</td></tr>
              </table>
              <p style="margin-top:24px;font-size:12px;color:#475569;">GFI — Foro Inmobiliario</p>
            </div>
          `,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("MP webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
