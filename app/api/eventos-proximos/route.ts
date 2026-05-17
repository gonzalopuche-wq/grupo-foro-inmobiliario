import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const hoy = new Date().toISOString().split("T")[0];
  const { data, error } = await sb
    .from("eventos")
    .select("id, titulo, descripcion, fecha, tipo, gratuito, precio_entrada, moneda, lugar, plataforma, imagen_url")
    .eq("estado", "publicado")
    .gte("fecha", hoy)
    .order("fecha", { ascending: true })
    .limit(3);

  if (error) return NextResponse.json({ eventos: [] });
  return NextResponse.json({ eventos: data ?? [] });
}
