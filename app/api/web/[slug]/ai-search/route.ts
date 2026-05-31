import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { propiedadesComponentDefinitions } from "@/app/lib/json-render/catalog";

const anthropic = new Anthropic();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { query } = await req.json();
  if (!query?.trim()) return NextResponse.json({ error: "query requerida" }, { status: 400 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Obtener config del corredor
  const { data: cfg } = await sb
    .from("web_corredor_config")
    .select("perfil_id")
    .eq("slug", slug)
    .eq("activa", true)
    .single();

  if (!cfg) return NextResponse.json({ error: "portal no encontrado" }, { status: 404 });

  // Obtener propiedades activas del corredor
  const { data: props } = await sb
    .from("cartera_propiedades")
    .select("id,titulo,operacion,tipo,precio,moneda,ciudad,zona,dormitorios,banos,superficie_cubierta,fotos,descripcion,estado")
    .eq("perfil_id", cfg.perfil_id)
    .eq("publicada_web", true)
    .eq("estado", "activa")
    .limit(200);

  const propiedades = (props ?? []).map((p: any) => ({
    id: p.id,
    titulo: p.titulo,
    operacion: p.operacion,
    tipo: p.tipo,
    precio: p.precio,
    moneda: p.moneda,
    ciudad: p.ciudad,
    zona: p.zona,
    dormitorios: p.dormitorios,
    banos: p.banos,
    superficie_cubierta: p.superficie_cubierta,
    foto: Array.isArray(p.fotos) && p.fotos.length > 0 ? p.fotos[0] : null,
    destacada: false,
    slug,
  }));

  // Construir el catálogo en texto para el prompt
  const catalogStr = JSON.stringify(propiedadesComponentDefinitions, null, 2);
  const propsStr = JSON.stringify(propiedades.slice(0, 50), null, 2);  // max 50 para el prompt

  const systemPrompt = `Eres un asistente de búsqueda inmobiliaria. El usuario busca propiedades y vos generás una UI estructurada usando el catálogo de componentes disponibles.

CATÁLOGO DE COMPONENTES:
${catalogStr}

PROPIEDADES DISPONIBLES (${propiedades.length} total, mostrando las primeras 50):
${propsStr}

Respondé ÚNICAMENTE con un objeto JSON válido que represente un spec de json-render.
El spec debe ser un objeto con:
- "component": nombre del componente raíz (usa PropGrid para múltiples resultados, MensajeVacio si no hay resultados)
- "props": props del componente
- "children": array de specs hijos si aplica

No incluyas markdown, solo JSON puro.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: `Búsqueda: "${query}"` }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("respuesta inesperada");

    // Extraer JSON del texto
    let spec;
    try {
      spec = JSON.parse(content.text);
    } catch {
      const match = content.text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no se encontró JSON en la respuesta");
      spec = JSON.parse(match[0]);
    }

    return NextResponse.json({ spec });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
