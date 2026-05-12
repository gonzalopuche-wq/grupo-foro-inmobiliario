import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BENEFICIOS_CATEGORY_SLUG = "beneficios-sponsors";
const BENEFICIOS_CATEGORY_NAME = "Beneficios Sponsors";

function verificarCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

function proximaFecha(frecuencia: string): string {
  const d = new Date();
  if (frecuencia === "diaria") d.setDate(d.getDate() + 1);
  else if (frecuencia === "2x_semana") d.setDate(d.getDate() + 3);
  else if (frecuencia === "semanal") d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const hoy = new Date().toISOString().slice(0, 10);
  const publicados: string[] = [];
  const errores: string[] = [];

  // Obtener o crear categoría "Beneficios Sponsors" en foro
  let categoryId: string | null = null;
  const { data: cats } = await supabaseAdmin.from("forum_categories").select("id").eq("slug", BENEFICIOS_CATEGORY_SLUG).maybeSingle();
  if (cats?.id) {
    categoryId = cats.id;
  } else {
    const { data: newCat } = await supabaseAdmin.from("forum_categories").insert({
      name: BENEFICIOS_CATEGORY_NAME,
      slug: BENEFICIOS_CATEGORY_SLUG,
      description: "Ofertas y descuentos exclusivos para corredores GFI® de nuestros sponsors",
      is_active: true,
      sort_order: 50,
    }).select("id").single();
    categoryId = newCat?.id ?? null;
  }

  // Admin user para postear
  const { data: adminUser } = await supabaseAdmin
    .from("perfiles")
    .select("id")
    .eq("tipo", "admin")
    .limit(1)
    .single();
  const authorId = adminUser?.id;
  if (!authorId || !categoryId) {
    return NextResponse.json({ error: "No se encontró admin o categoría", publicados: 0 });
  }

  // Beneficios activos que deben republicarse hoy
  const { data: beneficios } = await supabaseAdmin
    .from("sponsor_beneficios")
    .select("id, titulo, descripcion, imagen_url, vigente_hasta, republica_frecuencia, proveedor_id, red_proveedores!sponsor_beneficios_proveedor_id_fkey(nombre,suscripcion_estado)")
    .eq("activo", true)
    .neq("republica_frecuencia", "ninguna")
    .lte("republica_proxima", hoy)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`);

  for (const b of (beneficios ?? []) as any[]) {
    if (b.red_proveedores?.suscripcion_estado !== "activa") continue;

    const titulo = `🎁 ${b.titulo} — ${b.red_proveedores.nombre}`;
    const vencimiento = b.vigente_hasta ? `\n\n_Válido hasta ${new Date(b.vigente_hasta + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}._` : "";
    const imagen = b.imagen_url ? `\n\n![${b.titulo}](${b.imagen_url})` : "";
    const body = `${b.descripcion ?? ""}${imagen}\n\n_Beneficio exclusivo para corredores GFI® de **${b.red_proveedores.nombre}**.${vencimiento}_\n\nMiralo completo en [Beneficios GFI®](/beneficios).`;

    const { error: topicError } = await supabaseAdmin.from("forum_topics").insert({
      author_id: authorId,
      category_id: categoryId,
      title: titulo,
      body: body.trim(),
      is_pinned: false,
      is_urgent: false,
    });

    if (topicError) {
      errores.push(`${b.id}: ${topicError.message}`);
      continue;
    }

    await supabaseAdmin.from("sponsor_beneficios").update({
      republica_proxima: proximaFecha(b.republica_frecuencia),
    }).eq("id", b.id);

    publicados.push(b.titulo);
  }

  return NextResponse.json({ publicados: publicados.length, titulos: publicados, errores });
}
