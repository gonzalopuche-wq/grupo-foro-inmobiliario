import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Sos el asistente IA de GFI® (Grupo Foro Inmobiliario), una plataforma profesional para corredores inmobiliarios matriculados en la 2da Circunscripción de COCIR (Rosario, Argentina).

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
- Podés hacer preguntas para clarificar si la consulta es ambigua`;

export async function POST(req: NextRequest) {
  const { mensaje, historial } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ respuesta: "No hay clave de IA configurada." });
  }

  const messages: Anthropic.MessageParam[] = [
    ...(historial ?? []).slice(-10).map((m: { rol: string; texto: string }) => ({
      role: (m.rol === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.texto,
    })),
    { role: "user" as const, content: mensaje },
  ];

  const safeMessages = messages.filter(m => typeof m.content === "string" && m.content.trim().length > 0);
  if (safeMessages.length === 0) {
    return Response.json({ respuesta: "Mensaje vacío." });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const aiStream = anthropic.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          messages: safeMessages,
        });

        for await (const event of aiStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("ia-chat stream error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Error al procesar tu consulta." })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
