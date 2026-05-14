import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — admin agrega crédito al saldo del sponsor
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { proveedor_id, monto_usd, descripcion } = await req.json();
  if (!proveedor_id || !monto_usd || monto_usd <= 0) {
    return NextResponse.json({ error: "proveedor_id y monto_usd requeridos" }, { status: 400 });
  }

  // Upsert saldo
  const { data: saldoActual } = await sb
    .from("sponsor_saldo")
    .select("saldo_usd")
    .eq("proveedor_id", proveedor_id)
    .maybeSingle();

  const nuevoSaldo = (saldoActual?.saldo_usd ?? 0) + monto_usd;

  await sb.from("sponsor_saldo").upsert({
    proveedor_id,
    saldo_usd: nuevoSaldo,
    updated_at: new Date().toISOString(),
  }, { onConflict: "proveedor_id" });

  await sb.from("sponsor_movimientos").insert({
    proveedor_id,
    tipo: "recarga",
    monto_usd,
    descripcion: descripcion ?? `Recarga manual — admin ${user.id}`,
  });

  return NextResponse.json({ ok: true, saldo_nuevo: nuevoSaldo });
}

// GET — obtener saldo y movimientos de un sponsor
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const proveedor_id = searchParams.get("proveedor_id");

  // Verificar que es admin o es el sponsor dueño
  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  const esAdmin = perfil?.tipo === "admin";

  let provId = proveedor_id;
  if (!esAdmin) {
    const { data: prov } = await sb
      .from("red_proveedores")
      .select("id")
      .eq("portal_user_id", user.id)
      .single();
    if (!prov) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    provId = prov.id;
  }
  if (!provId) return NextResponse.json({ error: "proveedor_id requerido" }, { status: 400 });

  const [{ data: saldo }, { data: movimientos }] = await Promise.all([
    sb.from("sponsor_saldo").select("saldo_usd, updated_at").eq("proveedor_id", provId).maybeSingle(),
    sb.from("sponsor_movimientos").select("*").eq("proveedor_id", provId).order("created_at", { ascending: false }).limit(50),
  ]);

  return NextResponse.json({ saldo: saldo?.saldo_usd ?? 0, movimientos: movimientos ?? [] });
}
