import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await sb
    .from("noticias")
    .select("id, titulo, cuerpo, link, imagen_url, fuente, created_at, aprobado_at, destacado")
    .eq("estado", "aprobada")
    .order("destacado", { ascending: false })
    .order("aprobado_at", { ascending: false })
    .limit(6);

  if (error) return NextResponse.json({ noticias: [] });
  return NextResponse.json({ noticias: data ?? [] });
}
