import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "image/*,*/*",
};

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { propiedad_id } = await req.json();
  if (!propiedad_id) return NextResponse.json({ error: "propiedad_id requerido" }, { status: 400 });

  // Verificar que la propiedad pertenece al usuario
  const { data: prop } = await supabase
    .from("cartera_propiedades")
    .select("id, fotos, perfil_id")
    .eq("id", propiedad_id)
    .single();

  if (!prop) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (prop.perfil_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const fotosActuales: string[] = prop.fotos ?? [];
  if (fotosActuales.length === 0) return NextResponse.json({ ok: true, reparadas: 0, fotos: [] });

  const supabaseStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace("https://", "https://").split(".supabase.co")[0] + ".supabase.co";

  const nuevasFotos: string[] = [];
  let reparadas = 0;

  for (let i = 0; i < fotosActuales.length; i++) {
    const url = fotosActuales[i];
    // Si ya es de nuestro storage, mantener tal cual
    if (url.includes(supabaseStorageUrl) || url.includes("supabase.co/storage")) {
      nuevasFotos.push(url);
      continue;
    }
    // URL externa — descargar y re-subir
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (!res.ok) { nuevasFotos.push(url); continue; }
      const buffer = await res.arrayBuffer();
      const ct = res.headers.get("content-type") || "image/jpeg";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const path = `${user.id}/${propiedad_id}/rep_${Date.now()}_${i}.${ext}`;
      const { data, error } = await supabase.storage
        .from("fotos_cartera")
        .upload(path, buffer, { contentType: ct, upsert: false });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("fotos_cartera").getPublicUrl(data.path);
        nuevasFotos.push(urlData.publicUrl);
        reparadas++;
      } else {
        nuevasFotos.push(url);
      }
    } catch {
      nuevasFotos.push(url);
    }
  }

  if (reparadas > 0) {
    await supabase
      .from("cartera_propiedades")
      .update({ fotos: nuevasFotos })
      .eq("id", propiedad_id);
  }

  return NextResponse.json({ ok: true, reparadas, fotos: nuevasFotos });
}
