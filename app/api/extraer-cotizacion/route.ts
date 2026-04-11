import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();

    if (!imageBase64 || !mediaType) {
      return NextResponse.json(
        { error: "Faltan parámetros: imageBase64 y mediaType son requeridos." },
        { status: 400 }
      );
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
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: `Analizá esta imagen de cotización de divisas. Extraé los valores de compra y venta del dólar estadounidense (USD) en pesos argentinos (ARS). Respondé SOLO con un JSON con este formato exacto, sin texto adicional: {"compra": 1380, "venta": 1420}. Si no podés determinar algún valor con certeza, ponelo como null. Si hay múltiples cotizaciones, tomá la del dólar blue o informal. Los valores deben ser números enteros sin puntos ni comas.`,
              },
            ],
          },
        ],
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
