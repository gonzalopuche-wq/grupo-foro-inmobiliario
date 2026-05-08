import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { propiedad, tono } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  const tonoInstruccion: Record<string, string> = {
    profesional: "Tono profesional, formal y objetivo. Sin adjetivos exagerados.",
    premium:     "Tono premium y exclusivo, orientado a compradores de alto poder adquisitivo. Elegante.",
    amigable:    "Tono cálido y cercano, como si le hablaras a un amigo. Natural y accesible.",
    vendedor:    "Tono persuasivo orientado a generar urgencia de compra. Destacá los beneficios clave.",
  };

  const especificaciones = [
    propiedad.tipo && `Tipo: ${propiedad.tipo}`,
    propiedad.operacion && `Operación: ${propiedad.operacion}`,
    propiedad.ciudad && `Ciudad/Zona: ${[propiedad.zona, propiedad.ciudad].filter(Boolean).join(", ")}`,
    propiedad.superficie_cubierta && `Superficie cubierta: ${propiedad.superficie_cubierta} m²`,
    propiedad.superficie_total && `Superficie total: ${propiedad.superficie_total} m²`,
    propiedad.dormitorios && `Dormitorios: ${propiedad.dormitorios}`,
    propiedad.banos && `Baños: ${propiedad.banos}`,
    propiedad.ambientes && `Ambientes: ${propiedad.ambientes}`,
    propiedad.cocheras && `Cocheras: ${propiedad.cocheras}`,
    propiedad.antiguedad !== null && propiedad.antiguedad !== undefined && `Antigüedad: ${propiedad.antiguedad === 0 ? "A estrenar" : `${propiedad.antiguedad} años`}`,
    propiedad.piso && `Piso: ${propiedad.piso}`,
    propiedad.orientacion && `Orientación: ${propiedad.orientacion}`,
    propiedad.amenities?.length > 0 && `Amenities: ${propiedad.amenities.join(", ")}`,
  ].filter(Boolean).join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Sos un experto en marketing inmobiliario argentino. Redactá una descripción de propiedad para un portal de ventas/alquileres.

CARACTERÍSTICAS:
${especificaciones || "Sin especificaciones detalladas."}

ESTILO: ${tonoInstruccion[tono] ?? tonoInstruccion.profesional}

REGLAS:
- Máximo 4 oraciones (150-200 palabras)
- No menciones el precio
- No uses emojis
- No uses frases como "¡Oportunidad única!" ni "No te pierdas"
- El texto debe ser adecuado para el mercado rosarino/argentino
- Respondé SOLO con el texto de la descripción, sin título ni aclaraciones`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    return NextResponse.json({ descripcion: text });
  } catch (err) {
    console.error("ia-descripcion error:", err);
    return NextResponse.json({ error: "Error generando descripción." }, { status: 500 });
  }
}
