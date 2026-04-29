import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { contacto, interacciones, tipo } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ text: "No hay clave de IA configurada." });

  const historial = (interacciones ?? []).slice(0, 8).map((i: any) =>
    `[${i.tipo}] ${i.descripcion}`
  ).join("\n");

  const prompt = `Sos un asistente para un corredor inmobiliario argentino.
El corredor necesita registrar una ${tipo ?? "nota"} sobre el contacto "${contacto?.nombre} ${contacto?.apellido}".
Historial reciente de interacciones:
${historial || "Sin historial previo."}

Sugerí un texto corto y profesional (máximo 3 oraciones) para registrar en el CRM como nueva interacción del tipo "${tipo ?? "nota"}". Respondé SOLO con el texto sugerido, sin saludos ni explicaciones.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await resp.json();
    const text = data.content?.[0]?.text ?? "No se pudo generar sugerencia.";
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ text: "Error al conectar con IA." });
  }
}
