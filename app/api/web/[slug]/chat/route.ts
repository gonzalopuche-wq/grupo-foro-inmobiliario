import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { streamText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { messages } = await req.json();

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: cfg } = await sb
    .from("web_corredor_config")
    .select("perfil_id")
    .eq("slug", slug)
    .eq("activa", true)
    .single();

  if (!cfg) return new Response("Portal no encontrado", { status: 404 });

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: `Sos un asistente inmobiliario para un portal de propiedades en Rosario, Argentina.
Ayudás a los usuarios a encontrar propiedades. Usá la herramienta searchProperties para buscar.
Respondé en español, de forma concisa y directa. Cuando encontrés propiedades, mencioná la cantidad
y los aspectos más relevantes. Si no hay resultados, sugerí alternativas (cambiar precio, zona, etc.).`,
    messages,
    tools: {
      searchProperties: tool({
        description: "Busca propiedades en la cartera según los criterios del usuario",
        parameters: z.object({
          operacion: z.enum(["venta", "alquiler"]).optional(),
          tipo: z.string().optional().describe("departamento, casa, ph, local, terreno"),
          precioMin: z.number().optional(),
          precioMax: z.number().optional(),
          moneda: z.enum(["USD", "ARS"]).optional(),
          dormitorios: z.number().optional(),
          zona: z.string().optional().describe("Barrio o zona de Rosario"),
          limit: z.number().optional(),
        }),
        execute: async ({ operacion, tipo, precioMin, precioMax, moneda, dormitorios, zona, limit }) => {
          let query = sb
            .from("cartera_propiedades")
            .select("id,titulo,operacion,tipo,precio,moneda,ciudad,zona,dormitorios,banos,superficie_cubierta,fotos,estado")
            .eq("perfil_id", cfg.perfil_id)
            .eq("publicada_web", true)
            .eq("estado", "activa");

          if (operacion) query = query.eq("operacion", operacion);
          if (tipo) query = query.ilike("tipo", `%${tipo}%`);
          if (precioMax) query = query.lte("precio", precioMax);
          if (precioMin) query = query.gte("precio", precioMin);
          if (moneda && (precioMin || precioMax)) query = query.eq("moneda", moneda);
          if (dormitorios) query = query.eq("dormitorios", dormitorios);
          if (zona) query = query.ilike("zona", `%${zona}%`);

          const { data } = await query.limit(limit ?? 12);

          return {
            total: data?.length ?? 0,
            propiedades: (data ?? []).map((p: any) => ({
              id: p.id,
              titulo: p.titulo,
              operacion: p.operacion,
              tipo: p.tipo,
              precio: p.precio,
              moneda: p.moneda,
              ciudad: p.ciudad,
              zona: p.zona,
              dormitorios: p.dormitorios,
              banos: p.banos,
              superficie_cubierta: p.superficie_cubierta,
              foto: Array.isArray(p.fotos) && p.fotos.length > 0 ? p.fotos[0] : null,
            })),
          };
        },
      }),
    },
    maxSteps: 3,
  });

  return result.toDataStreamResponse();
}
