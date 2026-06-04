// API: Panel "Hoy" con IA — 3 acciones prioritarias diarias
// POST /api/crm/hoy-ia — sin body, usa el usuario del Bearer token
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
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!rateLimit(`hoy-ia:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas consultas. Esperá un momento." }, { status: 429 });
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const hace7dias = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const hace14dias = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const inicioSemana = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  })();

  // Carga paralela de datos del usuario
  const [
    { data: contactosCalientes },
    { data: tareasUrgentes },
    { data: negociosRiesgo },
    { data: propiedadesRecientes },
    { data: perfil },
  ] = await Promise.all([
    // Contactos sin interacción en 7+ días, estado activo
    sb.from("crm_contactos")
      .select("id,nombre,apellido,estado,ultima_interaccion,created_at")
      .eq("perfil_id", user.id)
      .eq("estado", "activo")
      .or(`ultima_interaccion.is.null,ultima_interaccion.lte.${hace7dias}`)
      .order("ultima_interaccion", { ascending: true, nullsFirst: true })
      .limit(20),

    // Tareas pendientes que vencen hoy o están vencidas
    sb.from("crm_tareas")
      .select("id,titulo,descripcion,estado,prioridad,fecha_vencimiento,contacto_id")
      .eq("perfil_id", user.id)
      .neq("estado", "completada")
      .lte("fecha_vencimiento", hoy)
      .order("fecha_vencimiento", { ascending: true })
      .limit(10),

    // Negocios en etapa activa sin actualización en 14+ días
    sb.from("crm_negocios")
      .select("id,titulo,etapa,estado,updated_at,contacto_id")
      .eq("perfil_id", user.id)
      .eq("archivado", false)
      .in("etapa", ["reserva", "escritura", "negociacion", "oferta_enviada", "visita_realizada"])
      .lte("updated_at", hace14dias)
      .order("updated_at", { ascending: true })
      .limit(10),

    // Propiedades recientes del corredor esta semana
    sb.from("cartera_propiedades")
      .select("id,titulo,operacion,precio,moneda,estado,created_at")
      .eq("perfil_id", user.id)
      .gte("created_at", inicioSemana)
      .order("created_at", { ascending: false })
      .limit(5),

    // Perfil del corredor
    sb.from("perfiles")
      .select("nombre,apellido,tipo")
      .eq("id", user.id)
      .single(),
  ]);

  const nombreCorredor = perfil ? `${perfil.nombre} ${perfil.apellido}` : "el corredor";
  const hoyFmt = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  const prompt = `Sos un asistente de ventas inmobiliarias especializado en el mercado argentino. Hoy es ${hoyFmt}.

Analizá el estado actual de la cartera del corredor ${nombreCorredor} y generá exactamente 3 acciones prioritarias para el día.

DATOS DE HOY:

CONTACTOS SIN INTERACCIÓN EN 7+ DÍAS (${contactosCalientes?.length ?? 0}):
${contactosCalientes?.map(c => `- ID:${c.id} | ${c.nombre} ${c.apellido} | Última interacción: ${c.ultima_interaccion ? `hace ${Math.floor((Date.now() - new Date(c.ultima_interaccion).getTime()) / 86400000)} días` : "sin contacto registrado"}`).join("\n") || "Ninguno"}

TAREAS VENCIDAS O QUE VENCEN HOY (${tareasUrgentes?.length ?? 0}):
${tareasUrgentes?.map(t => `- ID:${t.id} | "${t.titulo}" | Prioridad: ${t.prioridad} | Vence: ${t.fecha_vencimiento} | Contacto ID: ${t.contacto_id ?? "sin contacto"}`).join("\n") || "Ninguna"}

NEGOCIOS SIN ACTUALIZACIÓN EN 14+ DÍAS (${negociosRiesgo?.length ?? 0}):
${negociosRiesgo?.map(n => `- ID:${n.id} | "${n.titulo ?? "Sin título"}" | Etapa: ${n.etapa} | Sin actualizar hace ${Math.floor((Date.now() - new Date(n.updated_at).getTime()) / 86400000)} días`).join("\n") || "Ninguno"}

PROPIEDADES NUEVAS ESTA SEMANA (${propiedadesRecientes?.length ?? 0}):
${propiedadesRecientes?.map(p => `- ID:${p.id} | "${p.titulo ?? "Sin título"}" | ${p.operacion} | ${p.precio ? `${p.precio.toLocaleString()} ${p.moneda}` : "Sin precio"}`).join("\n") || "Ninguna"}

Generá exactamente 3 acciones prioritarias ordenadas por urgencia. Respondé SOLO con este JSON (sin markdown, sin explicaciones):
{
  "resumen_dia": "Una oración que describe cómo está el día del corredor",
  "mensaje_motivacional": "Frase corta motivacional relacionada al negocio inmobiliario argentino",
  "acciones": [
    {
      "prioridad": 1,
      "tipo": "contactar|tarea|negocio|propiedad|general",
      "titulo": "Acción específica en máximo 50 caracteres",
      "descripcion": "Por qué es importante hacer esto hoy, máximo 150 caracteres",
      "urgencia": "alta|media|baja",
      "contacto_id": "ID del contacto o null",
      "negocio_id": "ID del negocio o null",
      "accion_rapida": "Texto del botón de acción (ej: Llamar ahora, Completar tarea, Actualizar negocio)"
    },
    { "prioridad": 2 },
    { "prioridad": 3 }
  ]
}`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text.trim();

  try {
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
    const resultado = JSON.parse(cleaned);
    return NextResponse.json({ ok: true, ...resultado });
  } catch {
    // Fallback si el JSON falla
    return NextResponse.json({
      ok: true,
      resumen_dia: "Tu día tiene actividad pendiente que requiere atención.",
      mensaje_motivacional: "Cada llamada es una oportunidad de cerrar.",
      acciones: [
        {
          prioridad: 1,
          tipo: "general",
          titulo: "Revisar contactos sin seguimiento",
          descripcion: "Hay contactos activos sin interacción reciente que necesitan atención.",
          urgencia: "alta",
          contacto_id: null,
          negocio_id: null,
          accion_rapida: "Ver contactos",
        },
        {
          prioridad: 2,
          tipo: "tarea",
          titulo: "Completar tareas vencidas",
          descripcion: "Revisá las tareas pendientes para mantener el pipeline ordenado.",
          urgencia: "media",
          contacto_id: null,
          negocio_id: null,
          accion_rapida: "Ver tareas",
        },
        {
          prioridad: 3,
          tipo: "negocio",
          titulo: "Actualizar negocios activos",
          descripcion: "Algunos negocios llevan tiempo sin actualizarse.",
          urgencia: "baja",
          contacto_id: null,
          negocio_id: null,
          accion_rapida: "Ver pipeline",
        },
      ],
    });
  }
}
