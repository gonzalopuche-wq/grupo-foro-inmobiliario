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

// Solo se permite descargar imágenes de orígenes de confianza (anti-SSRF):
// las salidas de Replicate y el storage del propio Supabase.
function origenPermitido(rawUrl: string): boolean {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  const supabaseHost = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.toLowerCase(); }
    catch { return ""; }
  })();
  const permitidos = [
    "replicate.delivery",
    "replicate.com",
  ];
  const okReplicate = permitidos.some(d => host === d || host.endsWith("." + d));
  const okSupabase = !!supabaseHost && (host === supabaseHost || host.endsWith(".supabase.co"));
  return okReplicate || okSupabase;
}

export async function POST(req: NextRequest) {
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error: authErr } = await sb.auth.getUser(authToken);
  if (authErr || !data?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = data.user;

  let body: { propiedadId?: string; imagenUrl?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { propiedadId, imagenUrl } = body ?? {};
  if (!propiedadId || !imagenUrl) {
    return NextResponse.json({ error: "Faltan parámetros (propiedadId, imagenUrl)" }, { status: 400 });
  }
  const esDataUrl = imagenUrl.startsWith("data:image/");
  // Se acepta un data URL (imagen generada en memoria) o una URL https de origen confiable.
  if (!esDataUrl && !origenPermitido(imagenUrl)) {
    return NextResponse.json({ error: "URL de imagen no permitida" }, { status: 400 });
  }

  // Verificar propiedad y ownership
  const { data: prop, error: propErr } = await sb
    .from("cartera_propiedades")
    .select("id, perfil_id, fotos")
    .eq("id", propiedadId)
    .single();
  if (propErr || !prop) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (prop.perfil_id !== user.id) return NextResponse.json({ error: "No tenés permiso sobre esta propiedad" }, { status: 403 });

  // Obtener los bytes de la imagen — desde un data URL (en memoria) o descargando la URL
  let buffer: Buffer | ArrayBuffer;
  let contentType = "image/png";
  if (esDataUrl) {
    const m = imagenUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) return NextResponse.json({ error: "Data URL inválido" }, { status: 400 });
    contentType = m[1];
    buffer = Buffer.from(m[2], "base64");
  } else {
    try {
      const imgRes = await fetch(imagenUrl);
      if (!imgRes.ok) return NextResponse.json({ error: "No se pudo descargar la imagen generada" }, { status: 502 });
      contentType = imgRes.headers.get("content-type")?.split(";")[0] || "image/png";
      buffer = await imgRes.arrayBuffer();
    } catch {
      return NextResponse.json({ error: "Error al descargar la imagen generada" }, { status: 502 });
    }
  }

  // Subir al bucket
  const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const path = `${user.id}/staging-${propiedadId}-${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage
    .from("fotos_cartera")
    .upload(path, buffer, { cacheControl: "3600", upsert: false, contentType });
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
