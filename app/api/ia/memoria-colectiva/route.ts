import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

async function buscarEnForo(query: string): Promise<{ topics: any[]; replies: any[] }> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 8);

  if (terms.length === 0) return { topics: [], replies: [] };

  // FTS con tsvector (índice de migration 048) o fallback ILIKE
  const ftsQuery = terms.join(" | "); // OR semántico

  const [{ data: topicsFts }, { data: topicsLike }] = await Promise.all([
    sb
      .from("forum_topics")
      .select("id, title, body, created_at, forum_categories(name)")
      .eq("is_deleted", false)
      .textSearch("fts_vector", ftsQuery, { type: "websearch", config: "spanish" })
      .order("created_at", { ascending: false })
      .limit(10),
    sb
      .from("forum_topics")
      .select("id, title, body, created_at, forum_categories(name)")
      .eq("is_deleted", false)
      .ilike("title", `%${terms[0]}%`)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // Merge deduplicando por id
  const vistosIds = new Set<string>();
  const topics: any[] = [];
  for (const t of [...(topicsFts ?? []), ...(topicsLike ?? [])]) {
    if (!vistosIds.has(t.id)) {
      vistosIds.add(t.id);
      topics.push(t);
    }
  }

  // Respuestas más votadas que contengan los términos
  const { data: replies } = await sb
    .from("forum_replies")
    .select("id, topic_id, body, created_at, forum_topics(title)")
    .eq("is_deleted", false)
    .textSearch("fts_vector", ftsQuery, { type: "websearch", config: "spanish" })
    .order("created_at", { ascending: false })
    .limit(8);

  return { topics: topics.slice(0, 8), replies: replies ?? [] };
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "IA no configurada" }, { status: 500 });
  }

  const { consulta } = await req.json();
  if (!consulta?.trim()) return NextResponse.json({ error: "consulta requerida" }, { status: 400 });

  const { topics, replies } = await buscarEnForo(consulta);

  if (topics.length === 0 && replies.length === 0) {
    return NextResponse.json({
      respuesta: "No encontré discusiones en el foro sobre ese tema. ¿Querés ser el primero en preguntar?",
      fuentes: [],
    });
  }

  // Construir contexto para Claude
  const contextoTopics = topics.map(t => {
    const cat = (t.forum_categories as any)?.name ?? "General";
    const body = (t.body ?? "").slice(0, 400);
    return `[${cat}] "${t.title}" (${new Date(t.created_at).toLocaleDateString("es-AR")})\n${body}`;
  }).join("\n\n");

  const contextoReplies = replies.map((r: any) => {
    const topTitulo = (r.forum_topics as any)?.title ?? "";
    const body = (r.body ?? "").slice(0, 300);
    return `Re: "${topTitulo}" — ${body}`;
  }).join("\n\n");

  const system = `Sos el asistente de Memoria Colectiva del Foro GFI® (Grupo Foro Inmobiliario, Rosario, Argentina).
Tu tarea es sintetizar el conocimiento que existe en el foro sobre la consulta del corredor.

REGLAS:
- Respondé en español rioplatense (vos, te, etc.)
- Basate SOLO en el contexto del foro que te proveo. No inventes información.
- Si el contexto no es suficiente, decilo y sugerí que el corredor abra un tema nuevo.
- Cita las fuentes de forma natural: "En el foro se discutió que..." o "Varios corredores comentaron..."
- Sé conciso pero completo. Máximo 300 palabras salvo que sea necesario más.
- Si hay posturas contradictorias en el foro, mencionálas.`;

  const userMsg = `Consulta del corredor: "${consulta}"

CONTEXTO DEL FORO GFI® (temas y respuestas encontradas):

--- TEMAS ---
${contextoTopics || "(ninguno)"}

--- RESPUESTAS ---
${contextoReplies || "(ninguna)"}

Sintetizá el conocimiento del foro sobre esta consulta.`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: userMsg }],
    });

    const respuesta = msg.content[0].type === "text" ? msg.content[0].text : "";

    const fuentes = topics.map(t => ({
      tipo: "tema" as const,
      titulo: t.title,
      categoria: (t.forum_categories as any)?.name ?? "General",
      fecha: t.created_at,
    }));

    return NextResponse.json({ respuesta, fuentes });
  } catch (e: any) {
    return NextResponse.json({ error: "Error de IA: " + e.message }, { status: 500 });
  }
}
