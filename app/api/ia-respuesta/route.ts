import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { contacto, interacciones, tipo } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ text: "No hay clave de IA configurada." });
  }

  const historial = (interacciones ?? []).slice(0, 8).map((i: { tipo: string; descripcion: string }) =>
    `[${i.tipo}] ${i.descripcion}`
  ).join("\n");

  try {
    const messages = [
      {
        role: "user" as const,
        content: `Sos un asistente para un corredor inmobiliario argentino.
El corredor necesita registrar una ${tipo ?? "nota"} sobre el contacto "${contacto?.nombre} ${contacto?.apellido}".
Historial reciente de interacciones:
${historial || "Sin historial previo."}

Sugerí un texto corto y profesional (máximo 3 oraciones) para registrar en el CRM como nueva interacción del tipo "${tipo ?? "nota"}". Respondé SOLO con el texto sugerido, sin saludos ni explicaciones.`,
      },
    ];

    const safeMessages = messages
      .map(m => ({ role: m.role, content: (m.content || "").trim() }))
      .filter(m => m.content.length > 0);

    if (safeMessages.length === 0) {
      return NextResponse.json({ text: "Sin contenido para procesar." });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: safeMessages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "No se pudo generar sugerencia.";
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ text: "Error al conectar con IA." });
  }
}
