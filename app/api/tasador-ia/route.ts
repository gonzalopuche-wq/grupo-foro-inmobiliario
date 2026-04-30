import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const datos = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });

  const prompt = `Sos un tasador inmobiliario experto en el mercado argentino (especialmente Buenos Aires y Gran Buenos Aires).
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

Respondé con un JSON con exactamente esta estructura (sin texto adicional fuera del JSON):
{
  "valor_min": número en USD,
  "valor_max": número en USD,
  "valor_sugerido": número en USD,
  "precio_m2": número en USD,
  "moneda": "USD",
  "alquiler_estimado": número en ARS (si aplica, sino null),
  "analisis": "2-3 párrafos de análisis del mercado y justificación del precio",
  "factores_positivos": ["factor1", "factor2", ...],
  "factores_negativos": ["factor1", "factor2", ...],
  "comparables": [
    { "descripcion": "texto breve", "precio": número en USD, "m2": número }
  ],
  "recomendacion": "texto corto con recomendación para el corredor"
}`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await resp.json();
    const text = data.content?.[0]?.text ?? "";
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Respuesta inválida de IA." }, { status: 500 });
    const resultado = JSON.parse(jsonMatch[0]);
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json({ error: "Error al procesar la tasación." }, { status: 500 });
  }
}
