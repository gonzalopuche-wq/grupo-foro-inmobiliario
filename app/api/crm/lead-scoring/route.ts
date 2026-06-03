// API: Lead Scoring automático con IA (0-100)
// POST /api/crm/lead-scoring — analiza un contacto y devuelve un score 0-100
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "../../../lib/ratelimit";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // Auth via Bearer token
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!rateLimit(`lead-scoring:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas consultas. Esperá un momento." }, { status: 429 });
  }

  const { contacto_id } = await req.json() as { contacto_id: string };
  if (!contacto_id) return NextResponse.json({ error: "Falta contacto_id" }, { status: 400 });

  // Cargar datos del contacto, interacciones y negocios en paralelo
  const [
    { data: contacto },
    { data: interacciones },
    { data: negocios },
  ] = await Promise.all([
    sb.from("crm_contactos")
      .select("nombre,apellido,tipo,estado,origen,interes,zona_interes,presupuesto_min,presupuesto_max,moneda,notas,etiquetas,created_at")
      .eq("id", contacto_id)
      .eq("perfil_id", user.id)
      .single(),
    sb.from("crm_interacciones")
      .select("tipo,descripcion,created_at")
      .eq("contacto_id", contacto_id)
      .order("created_at", { ascending: false })
      .limit(10),
    sb.from("crm_negocios")
      .select("estado")
      .eq("contacto_id", contacto_id)
      .eq("perfil_id", user.id),
  ]);

  if (!contacto) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });

  // Contar negocios activos vs cerrados
  const negociosActivos = (negocios ?? []).filter(
    (n) => !["cerrado", "perdido", "ganado"].includes(n.estado ?? "")
  ).length;
  const negociosCerrados = (negocios ?? []).filter(
    (n) => ["cerrado", "ganado"].includes(n.estado ?? "")
  ).length;

  const diasDesdeCreado = Math.round(
    (Date.now() - new Date(contacto.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const ultimaInteraccion = (interacciones ?? [])[0];
  const diasUltimaInteraccion = ultimaInteraccion
    ? Math.round((Date.now() - new Date(ultimaInteraccion.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : diasDesdeCreado;

  const prompt = `Sos un experto en lead scoring inmobiliario para el mercado argentino. Analizá este contacto y asignale un score de 0 a 100 basado en su potencial de conversión.

CONTACTO:
- Nombre: ${contacto.nombre} ${contacto.apellido}
- Tipo: ${contacto.tipo ?? "No especificado"}
- Estado en pipeline: ${contacto.estado ?? "Sin estado"}
- Origen: ${contacto.origen ?? "Desconocido"}
- Interés: ${contacto.interes ?? "No especificado"}
- Zona de interés: ${contacto.zona_interes ?? "No especificado"}
- Presupuesto: ${contacto.presupuesto_min || contacto.presupuesto_max ? `${contacto.presupuesto_min ? contacto.presupuesto_min.toLocaleString() : "?"} - ${contacto.presupuesto_max ? contacto.presupuesto_max.toLocaleString() : "?"} ${contacto.moneda ?? "USD"}` : "No especificado"}
- Etiquetas: ${(contacto.etiquetas ?? []).join(", ") || "Ninguna"}
- Notas: ${contacto.notas ?? "Sin notas"}
- Días desde primer contacto: ${diasDesdeCreado}
- Días desde última interacción: ${diasUltimaInteraccion}

HISTORIAL (últimas ${(interacciones ?? []).length} interacciones):
${(interacciones ?? []).map(i => `- ${i.tipo} hace ${Math.round((Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24))} días${i.descripcion ? `: "${i.descripcion.slice(0, 120)}"` : ""}`).join("\n") || "Sin interacciones registradas"}

NEGOCIOS:
- Negocios activos: ${negociosActivos}
- Negocios cerrados/ganados: ${negociosCerrados}
- Total negocios: ${(negocios ?? []).length}

Criterios para el score (0-100):
- Presupuesto definido → hasta +20 pts
- Zona y tipo de interés claros → hasta +15 pts
- Interacciones recientes y frecuentes → hasta +20 pts
- Negocios activos o ganados → hasta +15 pts
- Estado del pipeline (lead activo, tomar acción) → hasta +15 pts
- Origen de calidad (referido, portales premium) → hasta +10 pts
- Datos de contacto completos → hasta +5 pts
- Restar puntos por: inactividad prolongada, estado congelado/archivado, sin datos

Respondé ÚNICAMENTE con este JSON (sin markdown, sin texto extra):
{
  "score": <número entero 0-100>,
  "nivel": "frío|tibio|caliente|muy_caliente",
  "factores_positivos": ["<razón 1>", "<razón 2>", "<razón 3 máximo>"],
  "factores_negativos": ["<razón 1>", "<razón 2>", "<razón 3 máximo>"],
  "recomendacion": "<1 acción concreta y específica para hacer hoy con este lead>"
}

Reglas para nivel:
- 0-30: frío
- 31-55: tibio
- 56-79: caliente
- 80-100: muy_caliente`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text.trim();

  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
    const resultado = JSON.parse(cleaned);
    return NextResponse.json({ ok: true, resultado });
  } catch {
    return NextResponse.json({
      ok: true,
      resultado: {
        score: 50,
        nivel: "tibio",
        factores_positivos: ["Contacto registrado en el sistema"],
        factores_negativos: ["No se pudieron analizar todos los datos"],
        recomendacion: "Contactar al lead y completar su información para un análisis más preciso.",
      },
    });
  }
}
