// API: Fetcha RSS de fuentes inmobiliarias argentinas, puntúa con Claude y guarda en noticias_ai_feed
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RSS_FEEDS: { name: string; url: string }[] = [
  { name: "Reporte Inmobiliario", url: "https://www.reporteinmobiliario.com/feed/" },
  { name: "Infobae Economía",     url: "https://www.infobae.com/economia/rss/" },
  { name: "Infobae Propiedades",  url: "https://www.infobae.com/propiedades/rss/" },
  { name: "La Nación Propiedades",url: "https://www.lanacion.com.ar/propiedades/rss/" },
  { name: "La Nación Economía",   url: "https://www.lanacion.com.ar/economia/rss/" },
  { name: "Clarín Economía",      url: "https://www.clarin.com/economia/rss.html" },
  { name: "Clarín Inmuebles",     url: "https://www.clarin.com/inmuebles/rss.html" },
  { name: "Ámbito Financiero",    url: "https://www.ambito.com/rss/pages/finanzas.xml" },
  { name: "Ámbito Inmobiliario",  url: "https://www.ambito.com/rss/pages/economia.xml" },
  { name: "El Cronista",          url: "https://www.cronista.com/files/rss/feed.xml" },
  { name: "iProfesional",         url: "https://www.iprofesional.com/feed/RSS" },
  { name: "CUCICBA Noticias",     url: "https://www.cucicba.com.ar/feed/" },
  { name: "La Capital",           url: "https://www.lacapital.com.ar/rss/portada.rss" },
  { name: "Rosario3",             url: "https://www.rosario3.com/feed/" },
  { name: "Conclusión",           url: "https://www.conclusion.com.ar/feed/" },
  { name: "El Litoral",           url: "https://www.ellitoral.com/rss/portada.xml" },
];

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  enclosure?: string;
  source: string;
}

function parseXml(xml: string, sourceName: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
      return (m?.[1] ?? m?.[2] ?? "").trim();
    };
    const imgMatch = block.match(/enclosure[^>]+url="([^"]+)"/i) || block.match(/media:content[^>]+url="([^"]+)"/i) || block.match(/<img[^>]+src="([^"]+)"/i);

    const title = get("title");
    const link = get("link") || (block.match(/<link>([^<]*)<\/link>/i)?.[1] ?? "").trim();
    if (!title || !link) continue;

    items.push({
      title,
      link,
      description: get("description").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
      pubDate: get("pubDate"),
      enclosure: imgMatch?.[1] ?? undefined,
      source: sourceName,
    });
  }
  return items;
}

async function fetchRss(feed: { name: string; url: string }): Promise<RssItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GFI-NewsBot/1.0)", "Accept": "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseXml(xml, feed.name);
  } catch {
    return [];
  }
}

async function scoreWithClaude(items: RssItem[]): Promise<Array<{ index: number; score: number; categoria: string; resumen: string }>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const lista = items.map((it, i) =>
    `${i}. "${it.title}" — ${it.description.slice(0, 200)}`
  ).join("\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1800,
    messages: [{
      role: "user",
      content: `Sos un curador de noticias para un CRM inmobiliario argentino orientado a corredores inmobiliarios, propietarios e inquilinos. Analizá estas noticias y respondé con un JSON array.

CRITERIOS DE RELEVANCIA (score 0-100):
- 90-100: Leyes de alquiler, normativas CUCICBA/COCIR, tasas hipotecarias, índices de ajuste (ICL, IPC), precios del mercado inmobiliario argentino
- 70-89: Economía argentina que afecta al sector (dólar, inflación, créditos UVA), noticias de barrios/zonas específicas
- 50-69: Tendencias construcción, emprendimientos, datos del sector
- 20-49: Economía general argentina, noticias tangencialmente relacionadas
- 0-19: Política sin relación inmobiliaria, deportes, farándula, internacionales sin impacto local

CATEGORÍAS: "alquiler" | "venta" | "credito_hipotecario" | "normativa" | "mercado" | "construccion" | "economia" | "otro"

Para cada noticia devolvé: {"index": N, "score": 0-100, "categoria": "...", "resumen": "1 oración en español que explique por qué es relevante para el sector inmobiliario, o 'Sin relevancia directa' si score < 30"}

NOTICIAS:
${lista}

Respondé SOLO con el JSON array, sin markdown, sin explicaciones.`,
    }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text.trim();
  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
    return JSON.parse(cleaned);
  } catch {
    return items.map((_, i) => ({ index: i, score: 0, categoria: "otro", resumen: "" }));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isAdmin(sb: any, token: string): Promise<boolean> {
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return false;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  return ["admin", "master", "admin_contenido"].includes((p as any)?.tipo ?? "");
}

export async function POST(req: NextRequest) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verificar auth (cron no necesita token, viene con header secret)
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret === process.env.CRON_SECRET;
  if (!isCron) {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token || !(await isAdmin(sb, token))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  // 1. Traer todas las URLs ya guardadas para deduplicar
  const { data: existentes } = await sb.from("noticias_ai_feed").select("url");
  const urlsExistentes = new Set((existentes ?? []).map((r: { url: string }) => r.url));

  // 2. Fetchear todos los feeds en paralelo
  const feedResults = await Promise.all(RSS_FEEDS.map(fetchRss));
  const allItems: RssItem[] = feedResults.flat();

  // 3. Filtrar duplicados y limitar
  const nuevos = allItems.filter(it => it.link && !urlsExistentes.has(it.link));
  const recientes = nuevos.slice(0, 60); // máximo 60 por corrida

  if (recientes.length === 0) {
    return NextResponse.json({ ok: true, insertados: 0, mensaje: "Sin noticias nuevas" });
  }

  // 4. Scoring con Claude (en lotes de 20)
  const scored: Array<{ index: number; score: number; categoria: string; resumen: string }> = [];
  for (let i = 0; i < recientes.length; i += 20) {
    const lote = recientes.slice(i, i + 20);
    try {
      const res = await scoreWithClaude(lote);
      scored.push(...res.map(r => ({ ...r, index: r.index + i })));
    } catch {
      lote.forEach((_, j) => scored.push({ index: i + j, score: 0, categoria: "otro", resumen: "" }));
    }
  }

  // 5. Guardar en BD solo los que tienen score >= 30
  const scoreMap = Object.fromEntries(scored.map(s => [s.index, s]));
  const paraInsertar = recientes
    .map((item, i) => ({ item, scoring: scoreMap[i] }))
    .filter(({ scoring }) => (scoring?.score ?? 0) >= 30)
    .map(({ item, scoring }) => ({
      titulo: item.title.slice(0, 500),
      resumen: scoring?.resumen ?? null,
      url: item.link,
      imagen_url: item.enclosure ?? null,
      fuente: item.source,
      fecha_fuente: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      categoria: scoring?.categoria ?? "otro",
      score: scoring?.score ?? 0,
      estado: "pendiente",
    }));

  let insertados = 0;
  if (paraInsertar.length > 0) {
    const { error } = await sb.from("noticias_ai_feed").insert(paraInsertar);
    if (!error) insertados = paraInsertar.length;
  }

  return NextResponse.json({ ok: true, insertados, total_analizadas: recientes.length });
}

// GET: traer el feed para mostrar en el panel
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (!(await isAdmin(sb, token))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const estado = req.nextUrl.searchParams.get("estado") ?? "pendiente";
  const { data, error } = await sb
    .from("noticias_ai_feed")
    .select("*")
    .eq("estado", estado)
    .order("score", { ascending: false })
    .order("fetched_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
