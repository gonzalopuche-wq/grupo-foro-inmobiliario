import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { propiedad_id } = await req.json();
    if (!propiedad_id) return NextResponse.json({ error: "propiedad_id requerido" }, { status: 400 });

    const { data: p } = await sb.from("cartera_propiedades").select("*").eq("id", propiedad_id).single();
    if (!p) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Sin ANTHROPIC_API_KEY" }, { status: 500 });

    const client = new Anthropic({ apiKey });

    const detalle = [
      `Tipo: ${p.tipo ?? ""} en ${p.operacion ?? ""}`,
      `Precio: ${p.moneda ?? "USD"} ${p.precio?.toLocaleString("es-AR") ?? "A consultar"}`,
      `Ubicación: ${[p.ciudad, p.zona].filter(Boolean).join(", ")}`,
      p.dormitorios ? `Dormitorios: ${p.dormitorios}` : null,
      p.banos ? `Baños: ${p.banos}` : null,
      p.superficie_cubierta ? `Superficie cubierta: ${p.superficie_cubierta}m²` : null,
      p.superficie_total ? `Superficie total: ${p.superficie_total}m²` : null,
      p.antiguedad ? `Antigüedad: ${p.antiguedad}` : null,
      p.descripcion ? `Descripción: ${p.descripcion.slice(0, 300)}` : null,
    ].filter(Boolean).join("\n");

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Generá un post atractivo para Instagram/Facebook para esta propiedad inmobiliaria argentina. Usá emojis, lenguaje emotivo y orientado a la venta. Máximo 250 palabras en el caption. Incluí hashtags relevantes para el mercado inmobiliario argentino. Respondé SOLO con JSON válido: {"caption": "...", "hashtags": "#inmobiliaria #propiedades ..."}

Propiedad: ${p.titulo ?? ""}
${detalle}`,
      }],
    });

    const text = (message.content[0] as any)?.text ?? "{}";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return NextResponse.json({ ok: true, caption: text, hashtags: "" });

    const json = JSON.parse(match[0]);
    return NextResponse.json({ ok: true, caption: json.caption ?? text, hashtags: json.hashtags ?? "" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
