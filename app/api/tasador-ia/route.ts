import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tasacionTool: Anthropic.Tool = {
  name: "tasacion_result",
  description: "Devuelve el resultado de la tasación inmobiliaria profesional",
  input_schema: {
    type: "object" as const,
    properties: {
      valor_min:          { type: "number",  description: "Valor mínimo de tasación en USD" },
      valor_max:          { type: "number",  description: "Valor máximo de tasación en USD" },
      valor_sugerido:     { type: "number",  description: "Valor sugerido de tasación en USD" },
      precio_m2:          { type: "number",  description: "Precio por m² en USD" },
      moneda:             { type: "string",  enum: ["USD"] },
      alquiler_estimado:  { type: ["number","null"], description: "Alquiler estimado mensual en ARS, o null" },
      analisis:           { type: "string",  description: "2-3 párrafos de análisis del mercado y justificación" },
      factores_positivos: { type: "array",   items: { type: "string" } },
      factores_negativos: { type: "array",   items: { type: "string" } },
      comparables: {
        type: "array",
        items: {
          type: "object",
          properties: {
            descripcion: { type: "string" },
            precio:      { type: "number" },
            m2:          { type: "number" },
          },
          required: ["descripcion","precio","m2"],
        },
      },
      recomendacion: { type: "string", description: "Recomendación corta para el corredor" },
    },
    required: ["valor_min","valor_max","valor_sugerido","precio_m2","moneda","analisis","factores_positivos","factores_negativos","comparables","recomendacion"],
  },
};

export async function POST(req: NextRequest) {
  const datos = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      tools: [tasacionTool],
      tool_choice: { type: "tool", name: "tasacion_result" },
      messages: [{
        role: "user",
        content: `Sos un tasador inmobiliario experto en el mercado argentino (especialmente Rosario y Gran Buenos Aires).
Analizá la siguiente propiedad y generá una tasación profesional:

DATOS DE LA PROPIEDAD:
- Tipo: ${datos.tipo}
- Operación: ${datos.operacion}
- Dirección/Zona: ${datos.direccion}
- Barrio: ${datos.barrio}
- Superficie cubierta: ${datos.sup_cubierta} m²
${datos.sup_total ? `- Superficie total: ${datos.sup_total} m²` : ""}
- Ambientes: ${datos.ambientes}
- Dormitorios: ${datos.dormitorios}
- Baños: ${datos.banos}
- Antigüedad: ${datos.antiguedad} años
- Estado de conservación: ${datos.estado}
- Piso: ${datos.piso || "No aplica"}
- Cochera: ${datos.cochera ? "Sí" : "No"}
- Amenities: ${datos.amenities || "Ninguno"}
- Observaciones: ${datos.observaciones || "Ninguna"}

Usá la herramienta tasacion_result para devolver el análisis completo.`,
      }],
    });

    const toolUse = response.content.find(b => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Respuesta inválida de IA." }, { status: 500 });
    }

    return NextResponse.json(toolUse.input);
  } catch {
    return NextResponse.json({ error: "Error al procesar la tasación." }, { status: 500 });
  }
}
