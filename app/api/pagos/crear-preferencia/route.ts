import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.foroinmobiliario.com.ar");

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { contrato_id, concepto, monto, moneda = "ARS", email_pagador, descripcion } = body;

  if (!contrato_id || !concepto || !monto || !email_pagador) {
    return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json({ error: "MercadoPago no configurado" }, { status: 500 });
  }

  // Create preference in MercadoPago
  const mpPayload = {
    items: [
      {
        title: concepto,
        description: descripcion ?? concepto,
        unit_price: Number(monto),
        quantity: 1,
        currency_id: moneda,
      },
    ],
    payer: { email: email_pagador },
    back_urls: {
      success: `${SITE_URL}/crm/cobranzas?pago=exitoso`,
      failure: `${SITE_URL}/crm/cobranzas?pago=fallido`,
      pending: `${SITE_URL}/crm/cobranzas?pago=pendiente`,
    },
    auto_return: "approved",
    notification_url: `${SITE_URL}/api/pagos/webhook`,
    metadata: {
      contrato_id,
      perfil_id: user.id,
    },
  };

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mpPayload),
  });

  if (!mpRes.ok) {
    const mpErr = await mpRes.text();
    console.error("MercadoPago error:", mpErr);
    return NextResponse.json({ error: "Error al crear preferencia en MercadoPago" }, { status: 502 });
  }

  const mpData = await mpRes.json();
  const { id: preference_id, init_point } = mpData;

  // Save payment record in pagos_mp
  await sb.from("pagos_mp").insert({
    perfil_id: user.id,
    contrato_id,
    concepto,
    monto: Number(monto),
    moneda,
    email_pagador,
    descripcion: descripcion ?? concepto,
    preference_id,
    init_point,
    estado: "pendiente",
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ init_point, preference_id });
}
