// API: Genera y registra links rastreables para propiedades
// POST /api/cartera/link — genera/obtiene link tracking para una propiedad
// GET  /api/cartera/link?code=xxx — registra visita y retorna datos
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";

function makeCodigo(propId: string): string {
  // Código legible: primeros 8 chars del UUID sin guiones
  return propId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { propiedad_id, titulo } = await req.json() as { propiedad_id: string; titulo?: string };
  if (!propiedad_id) return NextResponse.json({ error: "Falta propiedad_id" }, { status: 400 });

  const codigo = makeCodigo(propiedad_id);

  // Upsert: si ya existe devuelve el existente
  const { data, error } = await sb
    .from("property_link_views")
    .upsert(
      { perfil_id: user.id, propiedad_id, codigo, titulo: titulo ?? null },
      { onConflict: "perfil_id,propiedad_id", ignoreDuplicates: false }
    )
    .select("codigo, vistas, primer_vista_at, ultima_vista_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = `${siteUrl}/crm/cartera/ficha/${propiedad_id}?ref=${data.codigo}`;
  return NextResponse.json({ ok: true, url, codigo: data.codigo, vistas: data.vistas ?? 0 });
}

// GET: registra una visita al link y devuelve stats (llamado internamente por ficha page)
export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get("code");
  if (!codigo) return NextResponse.json({ error: "Falta code" }, { status: 400 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: link } = await sb
    .from("property_link_views")
    .select("id, vistas, perfil_id, propiedad_id")
    .eq("codigo", codigo)
    .single();

  if (!link) return NextResponse.json({ vistas: 0 });

  const ahora = new Date().toISOString();
  await sb.from("property_link_views").update({
    vistas: (link.vistas ?? 0) + 1,
    ultima_vista_at: ahora,
    primer_vista_at: link.vistas === 0 ? ahora : undefined,
  }).eq("id", link.id);

  // Notificar al corredor si es la primera visita del día
  const visitas = (link.vistas ?? 0) + 1;
  if (visitas === 1 || visitas % 5 === 0) {
    await fetch(`${siteUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({
        perfil_id: link.perfil_id,
        titulo: visitas === 1 ? "👁️ Alguien vio tu propiedad" : `👁️ ${visitas} vistas en tu propiedad`,
        body: "Alguien abrió el link que compartiste. Revisá tu cartera.",
        url: `/crm/cartera/ficha/${link.propiedad_id}`,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, vistas: visitas });
}
