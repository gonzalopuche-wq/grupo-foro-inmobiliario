import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { mensaje, historial } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ respuesta: "No hay clave de IA configurada." });
  }

  const messages: Anthropic.MessageParam[] = [
    ...(historial ?? []).slice(-10).map((m: { rol: string; texto: string }) => ({
      role: (m.rol === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.texto,
    })),
    { role: "user" as const, content: mensaje },
  ];

  const safeMessages = messages.filter(m => typeof m.content === "string" && m.content.trim().length > 0);
  if (safeMessages.length === 0) return NextResponse.json({ respuesta: "Mensaje vacío." });

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `Sos el asistente IA de GFI® (Grupo Foro Inmobiliario), una plataforma profesional para corredores inmobiliarios matriculados en la 2da Circunscripción de COCIR (Rosario, Argentina).

Tu rol: asistente operativo del corredor. Ayudás con:
- Dudas sobre la plataforma GFI (módulos, funcionalidades, cómo usar)
- Redacción de textos inmobiliarios (descripciones, emails, mensajes)
- Cálculos inmobiliarios (honorarios 3%+3%, expensas, actualizaciones ICL/IPC)
- Normativa COCIR y buenas prácticas del sector
- Estrategias de captación y venta
- Consultas sobre el mercado rosarino

Reglas:
- Respondé siempre en español rioplatense (vos, te, etc.)
- Respuestas cortas y directas (máximo 150 palabras salvo que pidan algo largo)
- No inventes datos de propiedades ni precios reales
- Si no sabés algo, decilo claramente
- Podés hacer preguntas para clarificar si la consulta es ambigua`,
      messages: safeMessages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "No pude generar una respuesta.";
    return NextResponse.json({ respuesta: text });
  } catch (err) {
    console.error("ia-chat error:", err);
    return NextResponse.json({ respuesta: "Error al procesar tu consulta. Intentá de nuevo." });
  }
}
