import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface MensajeHistorial {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pregunta, perfil_id, historial = [] } = body as {
      pregunta: string;
      perfil_id: string;
      historial: MensajeHistorial[];
    };

    if (!pregunta || !perfil_id) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    // Buscar nombre del corredor
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, apellido")
      .eq("id", perfil_id)
      .single();

    const nombreCorredor = perfil
      ? `${perfil.nombre} ${perfil.apellido}`
      : "el corredor";

    // Buscar propiedades activas del corredor
    const { data: propiedades } = await supabase
      .from("cartera_propiedades")
      .select(
        "titulo, tipo, operacion, precio, moneda, ciudad, zona, dormitorios, banos, superficie_cubierta, descripcion"
      )
      .eq("perfil_id", perfil_id)
      .eq("estado", "activa");

    // Formatear propiedades para el system prompt
    const propiedadesTexto =
      propiedades && propiedades.length > 0
        ? propiedades
            .map((p, i) => {
              const detalles = [
                p.tipo,
                p.operacion,
                p.ciudad && p.zona ? `${p.zona}, ${p.ciudad}` : p.ciudad || p.zona || "",
                p.precio
                  ? p.moneda === "USD"
                    ? `USD ${p.precio.toLocaleString("es-AR")}`
                    : `$ ${p.precio.toLocaleString("es-AR")}`
                  : null,
                p.dormitorios ? `${p.dormitorios} dorm.` : null,
                p.banos ? `${p.banos} baños` : null,
                p.superficie_cubierta ? `${p.superficie_cubierta}m²` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              const desc = p.descripcion
                ? ` — ${p.descripcion.slice(0, 120)}${p.descripcion.length > 120 ? "…" : ""}`
                : "";
              return `${i + 1}. ${p.titulo} (${detalles})${desc}`;
            })
            .join("\n")
        : "No hay propiedades activas en este momento.";

    const systemPrompt = `Sos el asistente virtual de ${nombreCorredor}, corredor inmobiliario matriculado en Rosario, Argentina.
Tu rol es ayudar a los visitantes del portal a encontrar la propiedad ideal y responder sus consultas de manera amigable y profesional, siempre en español.

Propiedades activas en cartera:
${propiedadesTexto}

Instrucciones:
- Respondé siempre en español, con tono amigable y cercano.
- Si el usuario describe lo que busca, sugerile las propiedades más adecuadas de la lista.
- Si no hay propiedades que coincidan exactamente, sugerí las más cercanas y ofrecé contactar al corredor.
- No inventes propiedades ni información que no esté en la lista.
- Mantené respuestas concisas (máximo 3-4 párrafos).
- Al finalizar, siempre invitá al usuario a contactar a ${nombreCorredor} para más información o para coordinar una visita.`;

    // Construir mensajes para Anthropic
    const messages: Anthropic.MessageParam[] = [
      ...historial.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: pregunta },
    ];

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    const respuesta =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ respuesta });
  } catch (err) {
    console.error("[chat-portal] Error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
