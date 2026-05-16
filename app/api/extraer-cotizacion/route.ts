import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const cotizacionTool: Anthropic.Tool = {
  name: "cotizacion_extraida",
  description: "Valores de compra y venta del dólar USD en pesos argentinos ARS",
  input_schema: {
    type: "object" as const,
    properties: {
      compra: { type: ["number","null"], description: "Precio de compra del USD en ARS (número entero)" },
      venta:  { type: ["number","null"], description: "Precio de venta del USD en ARS (número entero)" },
    },
    required: ["compra","venta"],
  },
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { imageBase64, mediaType, texto } = body;

    if (!imageBase64 && !texto) {
      return NextResponse.json({ error: "Falta imageBase64 o texto." }, { status: 400 });
    }

    const content: Anthropic.MessageParam["content"] = [];

    if (imageBase64 && mediaType) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: imageBase64,
        },
      });
      content.push({
        type: "text",
        text: "Analizá esta imagen de cotización de divisas. Extraé los valores de compra y venta del dólar estadounidense (USD) en pesos argentinos (ARS). Si hay múltiples cotizaciones, tomá la del dólar blue o informal. Los valores deben ser números enteros. Usá la herramienta cotizacion_extraida.",
      });
    } else {
      content.push({
        type: "text",
        text: `Sos un experto en cotizaciones de casas de cambio argentinas.
Analizá el siguiente texto y extraé los valores de compra y venta del dólar (USD) en pesos argentinos (ARS).

El texto puede venir en cualquier formato informal de WhatsApp:
- "USD 1400/1450", "compra 1400 venta 1450", "dólar: c $1.400 v $1.450"
- puede llamarlo "blue", "informal", "paralelo", "billete", o simplemente "dólar"
- puede tener otras cotizaciones (EUR, BRL, etc.) — solo extraé USD/ARS

TEXTO:
"""
${texto}
"""

Usá la herramienta cotizacion_extraida con los valores encontrados. Si no podés determinar un valor, usá null.`,
      });
    }

    // content is always an array of blocks here; filter out empty text blocks
    const safeContent = content.filter(
      b => b.type !== "text" || ((b as { type: "text"; text: string }).text || "").trim().length > 0
    );

    const safeMessages = safeContent.length > 0
      ? [{ role: "user" as const, content: safeContent }]
      : [];

    if (safeMessages.length === 0) {
      return NextResponse.json({ error: "Sin contenido para procesar." }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      tools: [cotizacionTool],
      tool_choice: { type: "tool", name: "cotizacion_extraida" },
      messages: safeMessages,
    });

    const toolUse = response.content.find(b => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "No se pudo extraer la cotización." }, { status: 500 });
    }

    return NextResponse.json(toolUse.input);
  } catch (error) {
    console.error("Error en extraer-cotizacion:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
