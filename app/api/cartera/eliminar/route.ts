import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Verificar propiedad del corredor (o del corredor si es colaborador)
  const { data: perfil } = await supabaseAdmin
    .from("perfiles").select("tipo").eq("id", user.id).single();
  let perfilId = user.id;
  if (perfil?.tipo === "colaborador") {
    const { data: colab } = await supabaseAdmin
      .from("colaboradores").select("corredor_id").eq("user_id", user.id).single();
    if (colab?.corredor_id) perfilId = colab.corredor_id;
  }

  const { error } = await supabaseAdmin
    .from("cartera_propiedades")
    .delete()
    .eq("id", id)
    .eq("perfil_id", perfilId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
