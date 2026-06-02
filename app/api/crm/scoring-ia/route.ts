// API: Análisis inteligente de lead con Claude
// POST /api/crm/scoring-ia — analiza un contacto y devuelve estrategia de abordaje
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "../../../lib/ratelimit";

export const dynamic = "force-dynamic";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!rateLimit(`scoring-ia:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas consultas. Esperá un momento." }, { status: 429 });
  }

  const { contacto_id } = await req.json() as { contacto_id: string };
  if (!contacto_id) return NextResponse.json({ error: "Falta contacto_id" }, { status: 400 });

  // Cargar datos del contacto con su historial
  const [
    { data: contacto },
    { data: interacciones },
    { data: negocios },
    { data: tareas },
  ] = await Promise.all([
    sb.from("crm_contactos")
      .select("nombre,apellido,telefono,email,tipo,estado,presupuesto_min,presupuesto_max,moneda,zona_interes,notas,created_at,updated_at")
      .eq("id", contacto_id).eq("perfil_id", user.id).single(),
    sb.from("crm_interacciones")
      .select("tipo,notas,created_at")
      .eq("contacto_id", contacto_id).eq("perfil_id", user.id)
      .order("created_at", { ascending: false }).limit(10),
    sb.from("crm_negocios")
      .select("titulo,etapa,valor_operacion,created_at")
      .eq("contacto_id", contacto_id).eq("perfil_id", user.id)
      .limit(5),
    sb.from("crm_tareas")
      .select("titulo,estado,fecha_vencimiento")
      .eq("contacto_id", contacto_id).eq("perfil_id", user.id)
      .eq("estado", "pendiente").limit(5),
  ]);

  if (!contacto) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });

  const diasDesdeCreado = Math.round((Date.now() - new Date(contacto.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const diasDesdeActualizado = Math.round((Date.now() - new Date(contacto.updated_at).getTime()) / (1000 * 60 * 60 * 24));

  const ultimaInteraccion = interacciones?.[0];
  const diasUltimaInteraccion = ultimaInteraccion
    ? Math.round((Date.now() - new Date(ultimaInteraccion.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : diasDesdeActualizado;

  const prompt = `Sos un coach de ventas inmobiliarias para el mercado argentino. Analizá este lead y dame un plan de acción concreto.

LEAD:
- Nombre: ${contacto.nombre} ${contacto.apellido}
- Tipo: ${contacto.tipo ?? "No especificado"}
- Estado en pipeline: ${contacto.estado ?? "Sin estado"}
- Interés: ${contacto.zona_interes ?? "No especificado"}
- Presupuesto: ${contacto.presupuesto_min ? `$${contacto.presupuesto_min?.toLocaleString()} - $${contacto.presupuesto_max?.toLocaleString()} ${contacto.moneda}` : "No especificado"}
- Notas: ${contacto.notas ?? "Sin notas"}
- Días desde el primer contacto: ${diasDesdeCreado}
- Días desde última actualización: ${diasDesdeActualizado}

HISTORIAL DE INTERACCIONES (últimas ${interacciones?.length ?? 0}):
${interacciones?.map(i => `- ${i.tipo} hace ${Math.round((Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24))} días${i.notas ? `: "${i.notas.slice(0, 100)}"` : ""}`).join("\n") || "Sin interacciones registradas"}

NEGOCIOS ACTIVOS: ${negocios?.length ?? 0}
${negocios?.map(n => `- ${n.titulo ?? "Sin título"} en etapa "${n.etapa}"${n.valor_operacion ? ` · $${n.valor_operacion.toLocaleString()}` : ""}`).join("\n") || "Ninguno"}

TAREAS PENDIENTES: ${tareas?.length ?? 0}
${tareas?.map(t => `- ${t.titulo}${t.fecha_vencimiento ? ` (vence: ${t.fecha_vencimiento})` : ""}`).join("\n") || "Ninguna"}

Respondé con este JSON exacto (sin markdown):
{
  "temperatura": "caliente|tibio|frio",
  "prioridad": "alta|media|baja",
  "resumen": "2 oraciones sobre el estado actual de este lead",
  "proximo_paso": "Acción concreta y específica para hacer HOY con este lead",
  "estrategia": "Plan de seguimiento para los próximos 7 días (3-4 puntos)",
  "riesgo": "Principal riesgo de perder este lead",
  "oportunidad": "Principal oportunidad con este lead"
}`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text.trim();
  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
    const analisis = JSON.parse(cleaned);
    return NextResponse.json({ ok: true, analisis, diasUltimaInteraccion });
  } catch {
    return NextResponse.json({ ok: true, analisis: { resumen: text, temperatura: "tibio", prioridad: "media", proximo_paso: "Contactar al lead", estrategia: text, riesgo: "", oportunidad: "" }, diasUltimaInteraccion });
  }
}
