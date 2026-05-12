import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { datos, editandoId } = body;

  // Forzar perfil_id al usuario autenticado (seguridad)
  datos.perfil_id = user.id;
  datos.updated_at = new Date().toISOString();

  let propId: string | null = null;

  if (editandoId) {
    const { error } = await supabaseAdmin
      .from("cartera_propiedades")
      .update(datos)
      .eq("id", editandoId)
      .eq("perfil_id", user.id);
    if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    propId = editandoId;
  } else {
    const { data: nueva, error } = await supabaseAdmin
      .from("cartera_propiedades")
      .insert(datos)
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    propId = nueva?.id ?? null;
  }

  return NextResponse.json({ ok: true, propId });
}
