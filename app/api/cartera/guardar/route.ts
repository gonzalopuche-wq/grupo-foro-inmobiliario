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

  // Resolve effective perfil_id: colaboradores work on behalf of their corredor
  let efectivoId = user.id;
  const { data: perfil } = await supabaseAdmin
    .from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo === "colaborador") {
    const { data: colab } = await supabaseAdmin
      .from("colaboradores").select("corredor_id").eq("user_id", user.id).single();
    if (colab?.corredor_id) efectivoId = colab.corredor_id;
  }

  datos.perfil_id = efectivoId;
  datos.updated_at = new Date().toISOString();

  let propId: string | null = null;

  if (editandoId) {
    const { error } = await supabaseAdmin
      .from("cartera_propiedades")
      .update(datos)
      .eq("id", editandoId)
      .eq("perfil_id", efectivoId);
    if (error) {
      console.error("[cartera/guardar] update error:", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    propId = editandoId;
  } else {
    const { data: nueva, error } = await supabaseAdmin
      .from("cartera_propiedades")
      .insert(datos)
      .select("id")
      .single();
    if (error) {
      console.error("[cartera/guardar] insert error:", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    propId = nueva?.id ?? null;
  }

  return NextResponse.json({ ok: true, propId });
}
