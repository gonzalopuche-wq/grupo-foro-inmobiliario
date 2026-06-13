import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Modelo con visión: el corredor manda fotos de cada ambiente tomadas durante el
// recorrido + las medidas relevadas, y Claude redacta la descripción del aviso.
const MODEL = "claude-haiku-4-5-20251001";

// Tope de fotos por pedido (las imágenes ya vienen reescaladas/comprimidas desde la app).
const MAX_FOTOS = 8;

interface Ambiente {
  nombre?: string;
  largo?: number;
  ancho?: number;
  alto?: number;
  area?: number;
}

interface Foto {
  ambiente?: string;
  media_type?: string; // image/jpeg | image/png | image/webp
  data?: string;       // base64 SIN el prefijo data:
}

const TONO: Record<string, string> = {
  profesional: "Tono profesional, formal y objetivo. Sin adjetivos exagerados.",
  premium:     "Tono premium y exclusivo, orientado a compradores de alto poder adquisitivo. Elegante.",
  amigable:    "Tono cálido y cercano, como si le hablaras a un amigo. Natural y accesible.",
  vendedor:    "Tono persuasivo orientado a generar interés. Destacá los beneficios clave sin caer en clickbait.",
};

const MEDIA_OK = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error: authError } = await sb.auth.getUser(token);
  const user = data?.user;
  if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Vision es más cara: límite más conservador que la descripción de texto plano.
  if (!rateLimit(`mide-descripcion:${user.id}`, 12, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas consultas. Esperá un momento." }, { status: 429 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  const body = await req.json();
  const relevamiento = body.relevamiento ?? {};
  const tono: string = body.tono ?? relevamiento.tono ?? "profesional";
  const fotos: Foto[] = Array.isArray(body.fotos) ? body.fotos.slice(0, MAX_FOTOS) : [];

  const ambientes: Ambiente[] = Array.isArray(relevamiento.ambientes) ? relevamiento.ambientes : [];

  const lineasAmbientes = ambientes
    .map((a) => {
      const dim = a.largo && a.ancho ? `${a.largo} × ${a.ancho} m` : null;
      const area = a.area ? `${a.area.toFixed(1)} m²` : null;
      return `- ${a.nombre ?? "Ambiente"}${[dim, area].filter(Boolean).length ? ` (${[dim, area].filter(Boolean).join(", ")})` : ""}`;
    })
    .join("\n");

  const especificaciones = [
    relevamiento.tipo && `Tipo: ${relevamiento.tipo}`,
    relevamiento.operacion && `Operación: ${relevamiento.operacion}`,
    relevamiento.direccion && `Ubicación: ${relevamiento.direccion}`,
    relevamiento.superficie_total && `Superficie total relevada: ${Number(relevamiento.superficie_total).toFixed(1)} m²`,
    relevamiento.alto_techo && `Altura de techo: ${relevamiento.alto_techo} m`,
    ambientes.length > 0 && `Cantidad de ambientes relevados: ${ambientes.length}`,
  ].filter(Boolean).join("\n");

  const prompt = `Sos un experto en marketing inmobiliario argentino. A partir de un relevamiento hecho con la app (medidas de cada ambiente) y de fotos tomadas durante el recorrido, redactá la descripción de la propiedad para un portal de ventas/alquileres.

DATOS DEL RELEVAMIENTO:
${especificaciones || "Sin especificaciones generales."}

AMBIENTES MEDIDOS:
${lineasAmbientes || "Sin ambientes cargados."}

${fotos.length ? `Te adjunto ${fotos.length} foto(s) del recorrido. Usalas SOLO para describir terminaciones, luminosidad, estado y características visibles reales. No inventes lo que no se ve.` : "No hay fotos adjuntas: describí en base a las medidas."}

ESTILO: ${TONO[tono] ?? TONO.profesional}

REGLAS:
- Máximo 4-5 oraciones (150-220 palabras)
- No menciones el precio
- No uses emojis
- No uses frases como "¡Oportunidad única!" ni "No te pierdas"
- Mencioná las dimensiones/superficie solo si aportan (sin listar todo como planilla)
- Texto adecuado para el mercado rosarino/argentino
- Respondé SOLO con el texto de la descripción, sin título ni aclaraciones`;

  // Construcción del contenido multimodal: las fotos primero, después el texto.
  const content: Anthropic.MessageParam["content"] = [];
  for (const f of fotos) {
    if (!f?.data) continue;
    const mt = MEDIA_OK.has(f.media_type ?? "") ? (f.media_type as string) : "image/jpeg";
    if (f.ambiente) content.push({ type: "text", text: `Foto — ${f.ambiente}:` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: mt as "image/jpeg", data: f.data },
    });
  }
  content.push({ type: "text", text: prompt });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    return NextResponse.json({ descripcion: text });
  } catch (err) {
    console.error("mide-descripcion error:", err);
    return NextResponse.json({ error: "Error generando descripción." }, { status: 500 });
  }
}
