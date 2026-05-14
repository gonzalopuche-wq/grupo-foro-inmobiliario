import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { campana_id, cant_administraciones_declaradas } = await req.json();
  if (!campana_id) return NextResponse.json({ error: "campana_id requerido" }, { status: 400 });

  // Verificar que la campaña existe y está activa
  const { data: campana } = await sb
    .from("sponsor_campanas")
    .select("id, proveedor_id, titulo, costo_por_admin_usd, activa, vigente_hasta")
    .eq("id", campana_id)
    .eq("activa", true)
    .single();
  if (!campana) return NextResponse.json({ error: "Campaña no encontrada o inactiva" }, { status: 404 });
  if (campana.vigente_hasta && new Date(campana.vigente_hasta) < new Date()) {
    return NextResponse.json({ error: "Campaña vencida" }, { status: 400 });
  }

  // Verificar que el corredor no se adhirió ya
  const { data: existente } = await sb
    .from("sponsor_adhesiones")
    .select("id, token_ref")
    .eq("campana_id", campana_id)
    .eq("corredor_id", user.id)
    .maybeSingle();
  if (existente) {
    return NextResponse.json({ ok: true, token_ref: existente.token_ref, yaExistia: true });
  }

  // Obtener cantidad de administraciones del corredor
  const { data: perfil } = await sb
    .from("perfiles")
    .select("cant_administraciones_declaradas")
    .eq("id", user.id)
    .single();

  let cant = cant_administraciones_declaradas ?? perfil?.cant_administraciones_declaradas ?? 0;
  if (cant <= 0) return NextResponse.json({ error: "Debés declarar tu cantidad de administraciones" }, { status: 400 });

  const monto = Number((cant * campana.costo_por_admin_usd).toFixed(2));

  // Verificar saldo del sponsor
  const { data: saldo } = await sb
    .from("sponsor_saldo")
    .select("saldo_usd")
    .eq("proveedor_id", campana.proveedor_id)
    .single();
  if (!saldo || saldo.saldo_usd < monto) {
    return NextResponse.json({ error: "El sponsor no tiene saldo suficiente para esta adhesión" }, { status: 402 });
  }

  // Crear adhesión
  const { data: adhesion, error: errAdh } = await sb
    .from("sponsor_adhesiones")
    .insert({
      campana_id,
      corredor_id: user.id,
      cant_administraciones: cant,
      monto_cobrado_usd: monto,
    })
    .select("id, token_ref")
    .single();
  if (errAdh || !adhesion) return NextResponse.json({ error: "Error al crear adhesión" }, { status: 500 });

  // Guardar cant_administraciones_declaradas en el perfil si vino del form
  if (cant_administraciones_declaradas && !perfil?.cant_administraciones_declaradas) {
    await sb.from("perfiles").update({ cant_administraciones_declaradas: cant }).eq("id", user.id);
  }

  // Debitar saldo del sponsor
  await sb.from("sponsor_saldo")
    .update({ saldo_usd: saldo.saldo_usd - monto, updated_at: new Date().toISOString() })
    .eq("proveedor_id", campana.proveedor_id);

  // Registrar movimiento
  await sb.from("sponsor_movimientos").insert({
    proveedor_id: campana.proveedor_id,
    tipo: "debito_adhesion",
    monto_usd: -monto,
    descripcion: `Adhesión corredor ${user.id} — ${cant} administraciones — campaña: ${campana.titulo}`,
    adhesion_id: adhesion.id,
  });

  return NextResponse.json({ ok: true, token_ref: adhesion.token_ref, monto_cobrado: monto });
}
