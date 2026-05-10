import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { denunciante_id, tipo_contenido, contenido_id, motivo, descripcion } = await req.json();

  if (!denunciante_id || !tipo_contenido || !contenido_id || !motivo) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const { error } = await supabase.from("denuncias").insert({
    denunciante_id,
    tipo_contenido,
    contenido_id,
    motivo,
    descripcion: descripcion || null,
    estado: "pendiente",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
