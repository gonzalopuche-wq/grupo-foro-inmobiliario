import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mediaType, texto } = body;

    // Debe venir imagen O texto
    if (!imageBase64 && !texto) {
      return NextResponse.json(
        { error: "Falta imageBase64 o texto." },
        { status: 400 }
      );
    }

    // Construir el contenido del mensaje según el modo
    const content: object[] = [];

    if (imageBase64 && mediaType) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: imageBase64,
        },
      });
      content.push({
        type: "text",
        text: `Analizá esta imagen de cotización de divisas. Extraé los valores de compra y venta del dólar estadounidense (USD) en pesos argentinos (ARS). Respondé SOLO con un JSON con este formato exacto, sin texto adicional: {"compra": 1380, "venta": 1420}. Si no podés determinar algún valor con certeza, ponelo como null. Si hay múltiples cotizaciones, tomá la del dólar blue o informal. Los valores deben ser números enteros sin puntos ni comas.`,
      });
    } else {
      // Modo texto libre
      content.push({
        type: "text",
        text: `Sos un experto en cotizaciones de casas de cambio argentinas.
Analizá el siguiente texto y extraé los valores de compra y venta del dólar (USD) en pesos argentinos (ARS).

El texto puede venir en cualquier formato informal de WhatsApp, por ejemplo:
- "USD 1400/1450"
- "compra 1400 venta 1450"
- "dólar: c $1.400 v $1.450"
- mensajes de catálogo con listas de precios
- textos con emojis, viñetas, formato libre
- puede tener muchas otras cotizaciones (EUR, BRL, etc.) — solo extraé USD/ARS
- puede llamarlo "blue", "informal", "paralelo", "billete", o simplemente "dólar"

TEXTO A ANALIZAR:
"""
${texto}
"""

Respondé ÚNICAMENTE con un JSON, sin texto adicional, sin markdown, sin explicaciones:
{"compra": 1400, "venta": 1450}
Si no podés determinar un valor con certeza, usá null. Los valores son números enteros sin puntos ni comas.`,
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: "Error en Anthropic API", detail: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error en extraer-cotizacion:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
