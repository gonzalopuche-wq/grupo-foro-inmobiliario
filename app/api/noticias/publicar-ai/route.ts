// API: Publica una noticia del feed AI → tabla noticias (con un clic)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (!["admin", "master", "admin_contenido"].includes(perfil?.tipo ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { id } = body as { id: string };
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  // Traer la noticia del feed
  const { data: feedItem, error: fetchErr } = await sb
    .from("noticias_ai_feed")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !feedItem) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Insertar en noticias (ya aprobada)
  const { data: nueva, error: insErr } = await sb
    .from("noticias")
    .insert({
      autor_id: user.id,
      titulo: feedItem.titulo,
      cuerpo: feedItem.resumen ?? feedItem.titulo,
      link: feedItem.url,
      imagen_url: feedItem.imagen_url ?? null,
      fuente: feedItem.fuente ?? null,
      destacado: false,
      estado: "aprobada",
      aprobado_por: user.id,
      aprobado_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Marcar en feed como publicada
  await sb.from("noticias_ai_feed").update({
    estado: "publicada",
    publicada_como: nueva?.id ?? null,
  }).eq("id", id);

  return NextResponse.json({ ok: true, noticiaId: nueva?.id });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (!["admin", "master", "admin_contenido"].includes(perfil?.tipo ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  await sb.from("noticias_ai_feed").update({ estado: "descartada" }).eq("id", id);
  return NextResponse.json({ ok: true });
}
