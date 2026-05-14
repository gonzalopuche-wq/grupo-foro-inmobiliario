import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const perfilId = url.searchParams.get("perfil_id");
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");

  if (perfilId) {
    // Valoraciones públicas de un corredor
    const { data, error } = await sb
      .from("valoraciones_corredores")
      .select("id, puntuacion, relacion, comentario, created_at, perfiles!valoraciones_corredores_valorador_id_fkey(nombre, apellido, foto_url)")
      .eq("valorado_id", perfilId)
      .eq("visible", true)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const resumen = data?.reduce((acc, v) => {
      acc.total++;
      acc.suma += v.puntuacion;
      acc.por_estrella[v.puntuacion] = (acc.por_estrella[v.puntuacion] ?? 0) + 1;
      return acc;
    }, { total: 0, suma: 0, por_estrella: {} as Record<number, number> });

    return NextResponse.json({
      valoraciones: data ?? [],
      promedio: resumen && resumen.total > 0 ? resumen.suma / resumen.total : null,
      total: resumen?.total ?? 0,
      por_estrella: resumen?.por_estrella ?? {},
    });
  }

  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Mis valoraciones dadas y recibidas
  const [{ data: dadas }, { data: recibidas }] = await Promise.all([
    sb.from("valoraciones_corredores")
      .select("*, perfiles!valoraciones_corredores_valorado_id_fkey(nombre, apellido, foto_url)")
      .eq("valorador_id", user.id)
      .order("created_at", { ascending: false }),
    sb.from("valoraciones_corredores")
      .select("*, perfiles!valoraciones_corredores_valorador_id_fkey(nombre, apellido, foto_url)")
      .eq("valorado_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({ dadas: dadas ?? [], recibidas: recibidas ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { valorado_id, puntuacion, relacion, comentario } = await req.json();
  if (!valorado_id || !puntuacion || !relacion) {
    return NextResponse.json({ error: "valorado_id, puntuacion y relacion son requeridos" }, { status: 400 });
  }
  if (valorado_id === user.id) {
    return NextResponse.json({ error: "No podés valorarte a vos mismo" }, { status: 400 });
  }

  const { data, error } = await sb.from("valoraciones_corredores").upsert({
    valorador_id: user.id,
    valorado_id,
    puntuacion: parseInt(puntuacion),
    relacion,
    comentario: comentario ?? null,
    visible: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "valorador_id,valorado_id" }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ valoracion: data });
}

export async function DELETE(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await req.json();
  const { error } = await sb.from("valoraciones_corredores").delete()
    .eq("id", id)
    .or(`valorador_id.eq.${user.id},valorado_id.eq.${user.id}`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
