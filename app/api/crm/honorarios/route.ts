import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: cobros, error } = await sb
    .from("crm_honorarios_cobros")
    .select("*, crm_negocios(titulo, tipo_operacion)")
    .eq("perfil_id", user.id)
    .order("fecha_cobro", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cobros: cobros ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { negocio_id, concepto, monto, moneda, fecha_cobro, metodo_cobro, notas, comprobante_url } = body;

  if (!concepto || !monto || !fecha_cobro) {
    return NextResponse.json({ error: "concepto, monto y fecha_cobro son requeridos" }, { status: 400 });
  }

  const { data, error } = await sb.from("crm_honorarios_cobros").insert({
    perfil_id: user.id,
    negocio_id: negocio_id ?? null,
    concepto,
    monto: parseFloat(monto),
    moneda: moneda ?? "USD",
    fecha_cobro,
    metodo_cobro: metodo_cobro ?? null,
    notas: notas ?? null,
    comprobante_url: comprobante_url ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cobro: data });
}

export async function DELETE(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { error } = await sb.from("crm_honorarios_cobros").delete()
    .eq("id", id).eq("perfil_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
