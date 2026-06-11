// Analiza un plano municipal, ficha o PDF de una propiedad y devuelve los campos
// para precargar el formulario de la cartera. Imagen (vision) o PDF (document).
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/ratelimit";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const MODEL = "claude-haiku-4-5-20251001";

// Claves que devuelve la IA (coinciden con el form de la cartera para precargarlo).
const CLAVES = [
  "titulo", "tipo", "operacion", "direccion", "ciudad", "zona", "codigo_postal",
  "sector", "manzana", "superficie_cubierta", "superficie_total", "sup_terreno",
  "metros_frente", "metros_fondo", "dormitorios", "banos", "toilettes", "ambientes",
  "estacionamientos", "piso", "numero_unidad", "anio_construccion",
  "descripcion", "descripcion_privada",
];
const BOOLEANS = ["con_cochera", "barrio_cerrado", "amoblado", "energia_solar", "apto_credito"];

const SISTEMA =
  "Sos un asistente que extrae datos de inmuebles a partir de un plano municipal, una ficha " +
  "o un PDF de una propiedad en Argentina. Respondé ÚNICAMENTE con un JSON válido, sin texto " +
  "adicional. Usá string vacío \"\" si un dato no aparece; no inventes. " +
  `Claves de texto: ${CLAVES.join(", ")}. ` +
  `Claves booleanas (true/false): ${BOOLEANS.join(", ")}. ` +
  "Reglas: 'tipo' debe ser uno de Casa, Departamento, PH, Local, Terreno, Oficina, Galpón, Cochera, Campo. " +
  "'operacion' = Venta o Alquiler solo si se infiere claramente, sino \"\". " +
  "Las superficies en m² (solo el número). La nomenclatura catastral, partida o cuenta municipal " +
  "ponelas en 'descripcion_privada'. En 'descripcion' armá un resumen breve de la propiedad.";

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
  if (!rateLimit(`analizar-plano:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas consultas. Esperá un momento." }, { status: 429 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  let body: { archivo?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }
  const m = (body.archivo ?? "").match(/^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/);
  if (!m) return NextResponse.json({ error: "Archivo inválido (mandá una imagen o PDF)" }, { status: 400 });
  const mime = m[1];
  const base64 = m[2];

  const bloqueArchivo = mime === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mime as any, data: base64 } };

  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 1200,
      system: SISTEMA,
      messages: [{
        role: "user",
        content: [
          bloqueArchivo as any,
          { type: "text", text: "Extraé los datos de esta propiedad y devolvé el JSON." },
        ],
      }],
    });
    const out = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const json = extraerJson(out);
    if (!json) return NextResponse.json({ error: "La IA no pudo leer el documento." }, { status: 502 });

    // Filtrar solo claves conocidas (evita meter basura en el form)
    const datos: Record<string, any> = {};
    for (const k of CLAVES) {
      const v = json[k];
      if (v !== null && v !== undefined && String(v).trim()) datos[k] = String(v).trim();
    }
    for (const k of BOOLEANS) if (json[k] === true || json[k] === "true") datos[k] = true;

    return NextResponse.json({ ok: true, datos });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}
