import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getIp } from "../../lib/ratelimit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_SYSTEM = `Sos el asistente IA de GFI® (Grupo Foro Inmobiliario), una plataforma profesional para corredores inmobiliarios matriculados en la 2da Circunscripción de COCIR (Rosario, Argentina).

MÓDULOS DE LA PLATAFORMA GFI®:
- Cartera: gestión de propiedades propias, con fotos, datos completos, publicación en portales y generación de descripciones IA
- MIR (Mercado Inmobiliario Rosario): propiedades ofrecidas por otros corredores GFI para compartir honorarios, con mapa y ficha anónima
- Red GFI: cartera compartida entre corredores con honorarios divididos, mapa de zonas, búsqueda por cuadrante de calles
- CRM: gestión de contactos/clientes, negocios, visitas, listas de búsqueda personalizadas, matching IA propiedad-cliente, firma digital, envío de emails
- Padrón COCIR: directorio completo de matriculados, con mapa de zonas por dirección
- Foro: comunidad privada de corredores GFI con categorías (mercado, operaciones, consultas legales, etc.)
- Tasador IA: valuación de propiedades con comparables de portales (ZonaProp, Argenprop, MercadoLibre)
- Contratos IA: generación de contratos (compraventa, alquiler, autorización, reserva, cesión, mandato) según derecho argentino
- Listas de búsqueda (/b/[slug]): páginas públicas para compartir propiedades seleccionadas con clientes
- Perfil: datos del corredor, suscripción, matrícula

FUNCIONES IA DISPONIBLES (en los módulos):
- Descripción de propiedad (4 tonos: profesional, premium, amigable, vendedor)
- Post para redes sociales desde cartera
- Matching contacto ↔ propiedad (score 0-100%)
- Sugerencia de nota de interacción CRM
- Staging virtual de fotos (6 estilos)
- Contratos con marco legal vigente (Cód. Civil 2015 + Ley 27.551)

Tu rol: asistente operativo del corredor. Ayudás con:
- Dudas sobre cualquier módulo de GFI (cómo usarlo, qué hace, dónde está)
- Redacción de textos inmobiliarios (descripciones, emails, mensajes a clientes)
- Cálculos inmobiliarios (honorarios 3%+3%, expensas, actualizaciones ICL/IPC)
- Normativa COCIR y buenas prácticas del sector
- Estrategias de captación y venta en el mercado rosarino

Reglas:
- Respondé siempre en español rioplatense (vos, te, etc.)
- Respuestas cortas y directas (máximo 150 palabras salvo que pidan algo largo)
- No inventes datos de propiedades ni precios reales
- Si no sabés algo, decilo claramente
- Podés hacer preguntas para clarificar si la consulta es ambigua`;

async function getForumContext(query: string): Promise<string> {
  try {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (keywords.length === 0) return "";

    const { data: topics } = await supabaseAdmin
      .from("forum_topics")
      .select("title, body, created_at, forum_categories(name)")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!topics || topics.length === 0) return "";

    const relevant = topics.filter(t => {
      const text = `${t.title} ${t.body ?? ""}`.toLowerCase();
      return keywords.some(kw => text.includes(kw));
    }).slice(0, 4);

    if (relevant.length === 0) return "";

    const snippets = relevant.map(t => {
      const cat = (t.forum_categories as any)?.name ?? "";
      const body = (t.body ?? "").slice(0, 200);
      return `[${cat}] "${t.title}": ${body}`;
    }).join("\n");

    return `\n\n---\nMEMORIA COLECTIVA DEL FORO GFI® (posts recientes relacionados con la consulta):\n${snippets}\n---\nUsá esta info como contexto adicional si es relevante para responder.`;
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  // 30 messages per IP per hour
  if (!rateLimit(`ia-chat:${getIp(req)}`, 30, 60 * 60 * 1000)) {
    return Response.json({ respuesta: "Límite de mensajes alcanzado. Intentá en 1 hora." }, { status: 429 });
  }

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

  const forumContext = await getForumContext(mensaje);
  const systemPrompt = BASE_SYSTEM + forumContext;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const aiStream = anthropic.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 600,
          system: systemPrompt,
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
