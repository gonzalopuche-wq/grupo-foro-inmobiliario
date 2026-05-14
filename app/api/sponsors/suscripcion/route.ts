import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — admin cobra la mensualidad de un sponsor debitando del saldo prepago
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { proveedor_id, mes } = await req.json(); // mes = "YYYY-MM"
  if (!proveedor_id || !mes) {
    return NextResponse.json({ error: "proveedor_id y mes requeridos" }, { status: 400 });
  }

  const [{ data: prov }, { data: saldo }] = await Promise.all([
    sb.from("red_proveedores").select("id, nombre, plan_mensual_usd").eq("id", proveedor_id).single(),
    sb.from("sponsor_saldo").select("saldo_usd").eq("proveedor_id", proveedor_id).maybeSingle(),
  ]);

  if (!prov) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });

  const monto = Number(prov.plan_mensual_usd ?? 50);
  const saldoActual = Number(saldo?.saldo_usd ?? 0);

  if (saldoActual < monto) {
    return NextResponse.json({
      error: `Saldo insuficiente. Disponible: $${saldoActual.toFixed(2)}, requerido: $${monto}`,
    }, { status: 422 });
  }

  const { data: existing } = await sb.from("sponsor_suscripciones")
    .select("id, pagada").eq("proveedor_id", proveedor_id).eq("mes", mes).maybeSingle();
  if (existing?.pagada) {
    return NextResponse.json({ error: `Ya se cobró la suscripción de ${mes}` }, { status: 409 });
  }

  // Vencimiento = primer día del mes siguiente
  const [year, month] = mes.split("-").map(Number);
  const vence = new Date(year, month, 1).toISOString().split("T")[0];
  const nuevoSaldo = saldoActual - monto;

  await sb.from("sponsor_saldo").upsert(
    { proveedor_id, saldo_usd: nuevoSaldo, updated_at: new Date().toISOString() },
    { onConflict: "proveedor_id" }
  );

  await sb.from("sponsor_movimientos").insert({
    proveedor_id,
    tipo: "debito_suscripcion",
    monto_usd: -monto,
    descripcion: `Suscripción mensual ${mes}`,
  });

  await sb.from("sponsor_suscripciones").upsert(
    { proveedor_id, mes, monto_usd: monto, pagada: true, fecha_pago: new Date().toISOString() },
    { onConflict: "proveedor_id,mes" }
  );

  await sb.from("red_proveedores").update({
    suscripcion_activa: true,
    suscripcion_vence: vence,
  }).eq("id", proveedor_id);

  return NextResponse.json({ ok: true, saldo_nuevo: nuevoSaldo, vence });
}

// GET — historial de suscripciones de un sponsor
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const proveedor_id = searchParams.get("proveedor_id");

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  const esAdmin = perfil?.tipo === "admin";

  let provId = proveedor_id;
  if (!esAdmin) {
    const { data: prov } = await sb.from("red_proveedores").select("id").eq("portal_user_id", user.id).single();
    if (!prov) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    provId = prov.id;
  }
  if (!provId) return NextResponse.json({ error: "proveedor_id requerido" }, { status: 400 });

  const [{ data: suscripciones }, { data: prov }] = await Promise.all([
    sb.from("sponsor_suscripciones").select("*").eq("proveedor_id", provId).order("mes", { ascending: false }),
    sb.from("red_proveedores").select("plan_mensual_usd, suscripcion_activa, suscripcion_vence").eq("id", provId).single(),
  ]);

  return NextResponse.json({
    suscripciones: suscripciones ?? [],
    plan_mensual_usd: prov?.plan_mensual_usd ?? 50,
    suscripcion_activa: prov?.suscripcion_activa ?? false,
    suscripcion_vence: prov?.suscripcion_vence ?? null,
  });
}
