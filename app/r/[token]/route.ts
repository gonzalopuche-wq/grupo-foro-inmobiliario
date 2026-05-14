import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Buscar la adhesión por token
  const { data: adhesion } = await sb
    .from("sponsor_adhesiones")
    .select("id, clics, campana_id, sponsor_campanas(proveedor_id, red_proveedores(sitio_web, nombre))")
    .eq("token_ref", token)
    .single();

  if (!adhesion) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Incrementar clics
  await sb
    .from("sponsor_adhesiones")
    .update({ clics: (adhesion.clics ?? 0) + 1 })
    .eq("id", adhesion.id);

  // Redirigir al sitio del sponsor
  const campana = adhesion.campana_id as any;
  const proveedor = campana?.red_proveedores as any;
  const sitioWeb = proveedor?.sitio_web ?? "/proveedores";

  const destino = sitioWeb.startsWith("http") ? sitioWeb : `https://${sitioWeb}`;
  return NextResponse.redirect(destino);
}
