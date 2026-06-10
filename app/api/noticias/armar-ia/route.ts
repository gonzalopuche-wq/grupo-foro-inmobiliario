// Arma una noticia con IA a partir de un LINK (scrapea y resume) o de una IMAGEN
// /recorte (Claude vision). Devuelve { titulo, cuerpo, fuente, imagen_url }.
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 40;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const MODEL = "claude-haiku-4-5-20251001";

const PRIVATE_IP = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1$|fc|fd)/i;
function urlSegura(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && !PRIVATE_IP.test(u.hostname);
  } catch { return false; }
}

const SISTEMA =
  "Sos editor de un portal de noticias inmobiliarias de Argentina (GFI). A partir del material que te paso, redactá una noticia clara y profesional en español rioplatense. " +
  "Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, con esta forma exacta: " +
  '{"titulo": string, "cuerpo": string, "fuente": string}. ' +
  "El título: conciso y atractivo (máx 90 caracteres). El cuerpo: 2 a 4 párrafos, objetivo, sin inventar datos que no estén en el material. " +
  "La fuente: el medio/sitio de origen si se puede inferir, o cadena vacía.";

function extraerJson(txt: string): any | null {
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!rateLimit(`noticias-ia:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas consultas. Esperá un momento." }, { status: 429 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  let body: { url?: string; imagen?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  try {
    // ── Caso LINK ──────────────────────────────────────────────────────────
    if (body.url) {
      if (!urlSegura(body.url)) return NextResponse.json({ error: "URL no permitida" }, { status: 403 });
      let html = "";
      try {
        const res = await fetch(body.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; GFIBot/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        html = await res.text();
      } catch {
        return NextResponse.json({ error: "No se pudo leer el link." }, { status: 502 });
      }

      const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1]
        ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ?? "";
      const sitio = (() => { try { return new URL(body.url).hostname.replace("www.", ""); } catch { return ""; } })();

      // Texto visible (sin scripts/estilos/tags), acotado
      const texto = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 9000);

      const msg = await anthropic.messages.create({
        model: MODEL, max_tokens: 1100,
        system: SISTEMA,
        messages: [{ role: "user", content: `Sitio: ${sitio}\n\nContenido del artículo:\n${texto}` }],
      });
      const out = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const json = extraerJson(out);
      if (!json) return NextResponse.json({ error: "La IA no devolvió un resultado válido." }, { status: 502 });

      return NextResponse.json({
        titulo: json.titulo ?? "", cuerpo: json.cuerpo ?? "",
        fuente: json.fuente || sitio, imagen_url: ogImage || "",
      });
    }

    // ── Caso IMAGEN / RECORTE ──────────────────────────────────────────────
    if (body.imagen) {
      const m = body.imagen.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!m) return NextResponse.json({ error: "Imagen inválida" }, { status: 400 });
      const mediaType = m[1];
      const base64 = m[2];

      const msg = await anthropic.messages.create({
        model: MODEL, max_tokens: 1100,
        system: SISTEMA,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as any, data: base64 } },
            { type: "text", text: "Esta imagen es un recorte/captura de una noticia. Redactá la noticia a partir de lo que se ve (texto, título, datos)." },
          ],
        }],
      });
      const out = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const json = extraerJson(out);
      if (!json) return NextResponse.json({ error: "La IA no pudo leer la imagen." }, { status: 502 });

      // Subir el recorte a storage para usarlo como imagen de la noticia
      let imagen_url = "";
      try {
        const ext = mediaType.includes("png") ? "png" : mediaType.includes("webp") ? "webp" : "jpg";
        const path = `noticias/${user.id}-${Date.now()}.${ext}`;
        const buf = Buffer.from(base64, "base64");
        const { error: upErr } = await sb.storage.from("fotos_cartera").upload(path, buf, { contentType: mediaType, upsert: false });
        if (!upErr) imagen_url = sb.storage.from("fotos_cartera").getPublicUrl(path).data.publicUrl;
      } catch { /* si falla el upload, devolvemos la noticia sin imagen */ }

      return NextResponse.json({
        titulo: json.titulo ?? "", cuerpo: json.cuerpo ?? "",
        fuente: json.fuente ?? "", imagen_url,
      });
    }

    return NextResponse.json({ error: "Mandá un link o una imagen." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}
