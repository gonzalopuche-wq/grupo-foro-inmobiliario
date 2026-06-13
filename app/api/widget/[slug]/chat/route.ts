// Chat del widget embebible: responde consultas sobre las propiedades
// publicadas del corredor (por slug), con IA. Público + CORS + rate limit.
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit, getIp } from "../../../../lib/ratelimit";
import { corsJson, corsPreflight } from "../../../../lib/cors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
// Fallback para que el constructor no tire al iniciar si falta la env (igual el
// handler corta con 503 antes de usarlo).
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "missing" });
const MODEL = "claude-haiku-4-5-20251001";

interface Mensaje { role: "user" | "assistant"; content: string; }

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // 20 mensajes por IP cada 10 minutos.
  if (!rateLimit(`widget-chat:${getIp(req)}`, 20, 10 * 60 * 1000)) {
    return corsJson({ error: "Demasiados mensajes. Esperá un momento." }, { status: 429 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return corsJson({ error: "Chat no disponible." }, { status: 503 });
  }

  let body: any;
  try { body = await req.json(); } catch { return corsJson({ error: "Body inválido" }, { status: 400 }); }
  if (!body || typeof body !== "object") return corsJson({ error: "Body inválido" }, { status: 400 });
  const pregunta = (body.pregunta ?? "").toString().slice(0, 1000).trim();
  const historial: Mensaje[] = Array.isArray(body.historial) ? body.historial.slice(-10) : [];
  if (!pregunta) return corsJson({ error: "Falta la pregunta" }, { status: 400 });

  // Resolver corredor por slug (web activa + chatbot activo)
  const { data: cfg } = await supabase
    .from("web_corredor_config")
    .select("perfil_id, activa, chatbot_activo")
    .eq("slug", slug)
    .maybeSingle();
  if (!cfg || !cfg.activa || !cfg.chatbot_activo) {
    return corsJson({ error: "Chat no disponible." }, { status: 404 });
  }

  const { data: perfil } = await supabase
    .from("perfiles").select("nombre, apellido").eq("id", cfg.perfil_id).maybeSingle();
  const nombreCorredor = (perfil ? `${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim() : "") || "el corredor";

  const { data: propiedades } = await supabase
    .from("cartera_propiedades")
    .select("titulo, tipo, operacion, precio, moneda, ciudad, zona, dormitorios, banos, superficie_cubierta, descripcion")
    .eq("perfil_id", cfg.perfil_id)
    .eq("publicada_web", true)
    .eq("estado", "activa")
    .limit(80);

  const propsTexto = propiedades && propiedades.length > 0
    ? propiedades.map((p, i) => {
        const det = [
          p.tipo, p.operacion,
          p.ciudad && p.zona ? `${p.zona}, ${p.ciudad}` : p.ciudad || p.zona || "",
          p.precio ? (p.moneda === "USD" ? `USD ${Number(p.precio).toLocaleString("es-AR")}` : `$ ${Number(p.precio).toLocaleString("es-AR")}`) : null,
          p.dormitorios ? `${p.dormitorios} dorm.` : null,
          p.banos ? `${p.banos} baños` : null,
          p.superficie_cubierta ? `${p.superficie_cubierta}m²` : null,
        ].filter(Boolean).join(" · ");
        const desc = p.descripcion ? ` — ${String(p.descripcion).slice(0, 120)}` : "";
        return `${i + 1}. ${p.titulo} (${det})${desc}`;
      }).join("\n")
    : "No hay propiedades publicadas en este momento.";

  const system = `Sos el asistente virtual de ${nombreCorredor}, corredor inmobiliario matriculado en Rosario, Argentina.
Ayudás a los visitantes a encontrar una propiedad y respondés sus consultas de forma amigable y profesional, siempre en español.

Propiedades publicadas:
${propsTexto}

Reglas:
- Respondé siempre en español, con tono cercano y conciso (máx. 3 párrafos).
- Si el visitante describe lo que busca, sugerile las propiedades más adecuadas de la lista. No inventes propiedades ni datos que no estén.
- Si nada coincide, ofrecé lo más cercano e invitá a dejar sus datos para que ${nombreCorredor} lo contacte.
- Cuando el visitante muestre interés o pida que lo contacten, pedile nombre y un teléfono o email, y avisale que ${nombreCorredor} se va a comunicar.`;

  try {
    const messages: Anthropic.MessageParam[] = [
      ...historial.filter(m => m && (m.role === "user" || m.role === "assistant") && m.content)
        .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
      { role: "user" as const, content: pregunta },
    ];
    const resp = await anthropic.messages.create({ model: MODEL, max_tokens: 512, system, messages });
    const respuesta = resp.content[0]?.type === "text" ? resp.content[0].text : "";
    return corsJson({ ok: true, respuesta });
  } catch {
    return corsJson({ error: "No se pudo responder ahora." }, { status: 502 });
  }
}
