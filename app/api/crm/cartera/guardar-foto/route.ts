// Persiste una foto generada por IA (home staging) en el bucket fotos_cartera
// y la agrega al array de fotos de la propiedad. Verifica que la propiedad
// pertenezca al corredor autenticado.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(authToken);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { propiedadId, imagenUrl } = body ?? {};
  if (!propiedadId || !imagenUrl) {
    return NextResponse.json({ error: "Faltan parámetros (propiedadId, imagenUrl)" }, { status: 400 });
  }

  // Verificar propiedad y ownership
  const { data: prop, error: propErr } = await sb
    .from("cartera_propiedades")
    .select("id, perfil_id, fotos")
    .eq("id", propiedadId)
    .single();
  if (propErr || !prop) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (prop.perfil_id !== user.id) return NextResponse.json({ error: "No tenés permiso sobre esta propiedad" }, { status: 403 });

  // Descargar la imagen generada
  let buffer: ArrayBuffer;
  try {
    const imgRes = await fetch(imagenUrl);
    if (!imgRes.ok) return NextResponse.json({ error: "No se pudo descargar la imagen generada" }, { status: 502 });
    buffer = await imgRes.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "Error al descargar la imagen generada" }, { status: 502 });
  }

  // Subir al bucket
  const path = `${user.id}/staging-${propiedadId}-${Date.now()}.png`;
  const { error: upErr } = await sb.storage
    .from("fotos_cartera")
    .upload(path, buffer, { cacheControl: "3600", upsert: false, contentType: "image/png" });
  if (upErr) {
    return NextResponse.json({ error: `No se pudo guardar la imagen: ${upErr.message}` }, { status: 500 });
  }
  const { data: urlData } = sb.storage.from("fotos_cartera").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // Agregar al array de fotos
  const fotosActuales: string[] = Array.isArray(prop.fotos) ? prop.fotos : [];
  const nuevasFotos = [...fotosActuales, publicUrl];
  const { error: updErr } = await sb
    .from("cartera_propiedades")
    .update({ fotos: nuevasFotos, usa_home_staging: true })
    .eq("id", propiedadId);
  if (updErr) {
    return NextResponse.json({ error: `Imagen subida, pero no se pudo asociar: ${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
