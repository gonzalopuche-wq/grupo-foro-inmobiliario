import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — admin cobra la mensualidad de un sponsor usando RPC atómico
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { proveedor_id, mes } = await req.json();
  if (!proveedor_id || !mes) {
    return NextResponse.json({ error: "proveedor_id y mes requeridos" }, { status: 400 });
  }

  // Validar formato YYYY-MM estrictamente (P2 fix)
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: "Formato de mes inválido. Usar YYYY-MM" }, { status: 400 });
  }
  const [year, month] = mes.split("-").map(Number);
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Mes fuera de rango (01-12)" }, { status: 400 });
  }
  if (year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Año fuera de rango" }, { status: 400 });
  }

  // RPC atómico — usa FOR UPDATE para prevenir cobros duplicados concurrentes (P1 fix)
  const { data, error } = await sb.rpc("cobrar_suscripcion_sponsor", {
    p_proveedor_id: proveedor_id,
    p_mes: mes,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { ok?: boolean; error?: string; saldo_nuevo?: number; vence?: string };
  if (result.error) {
    const status = result.error.includes("insuficiente") ? 422
      : result.error.includes("Ya se cobró") ? 409
      : result.error.includes("no encontrado") ? 404
      : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, saldo_nuevo: result.saldo_nuevo, vence: result.vence });
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
