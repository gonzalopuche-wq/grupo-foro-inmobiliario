import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const fuente = req.nextUrl.searchParams.get("fuente") ?? "";

  if (fuente === "gfi") {
    const { data, error } = await sb
      .from("cartera_propiedades")
      .select("id,titulo,operacion,tipo,precio,moneda,zona,ciudad,direccion,dormitorios,banos,superficie_cubierta,descripcion,fotos,estado,created_at,updated_at")
      .eq("id", id)
      .single();

    if (error || !data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    return NextResponse.json({
      id: data.id,
      fuente: "gfi",
      titulo: data.titulo ?? null,
      operacion: data.operacion ?? null,
      tipo: data.tipo ?? null,
      precio: data.precio ?? null,
      moneda: data.moneda ?? null,
      barrio: data.zona ?? null,
      ciudad: data.ciudad ?? null,
      provincia: "Santa Fe",
      direccion: data.direccion ?? null,
      dormitorios: data.dormitorios ?? null,
      banos: data.banos ?? null,
      superficie_cubierta: data.superficie_cubierta ?? null,
      descripcion: data.descripcion ?? null,
      imagenes: Array.isArray(data.fotos) ? data.fotos : [],
      url: `/crm/cartera/ficha/${id}`,
      datos_raw: data,
    });
  } else {
    const { data, error } = await sb
      .from("propiedades_externas")
      .select("id,portal,portal_id,url,titulo,operacion,tipo,precio,moneda,barrio,ciudad,provincia,direccion,dormitorios,banos,superficie_cubierta,descripcion,imagenes,activa,synced_at,created_at")
      .eq("id", id)
      .single();

    if (error || !data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    let imagenes: string[] = [];
    if (Array.isArray(data.imagenes)) {
      imagenes = data.imagenes as string[];
    } else if (typeof data.imagenes === "string") {
      try { imagenes = JSON.parse(data.imagenes); } catch { imagenes = []; }
    }

    return NextResponse.json({
      id: data.id,
      fuente: fuente || data.portal,
      titulo: data.titulo ?? null,
      operacion: data.operacion ?? null,
      tipo: data.tipo ?? null,
      precio: data.precio ?? null,
      moneda: data.moneda ?? null,
      barrio: data.barrio ?? null,
      ciudad: data.ciudad ?? null,
      provincia: data.provincia ?? null,
      direccion: data.direccion ?? null,
      dormitorios: data.dormitorios ?? null,
      banos: data.banos ?? null,
      superficie_cubierta: data.superficie_cubierta ?? null,
      descripcion: data.descripcion ?? null,
      imagenes,
      url: data.url ?? null,
      datos_raw: data,
    });
  }
}
