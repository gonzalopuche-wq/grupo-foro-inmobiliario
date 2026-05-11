// IA Matching: dado un contacto, busca propiedades en cartera que coincidan
// O dado una propiedad, busca contactos interesados
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit, getIp } from "../../lib/ratelimit";

export const dynamic = "force-dynamic";

// Strip characters that could manipulate LLM instructions
const sanitize = (s: string | null | undefined, max = 300) =>
  (s ?? "").replace(/[<>`\[\]{}\\]/g, "").slice(0, max).trim();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // 20 matching requests per IP per hour
  if (!rateLimit(`ia-matching:${getIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Límite de solicitudes alcanzado. Intentá en 1 hora." }, { status: 429 });
  }

  try {
    const { perfil_id, contacto_id, propiedad_id } = await req.json();
    if (!perfil_id) return NextResponse.json({ error: "perfil_id requerido" }, { status: 400 });
    if (!contacto_id && !propiedad_id) return NextResponse.json({ error: "contacto_id o propiedad_id requerido" }, { status: 400 });

    let prompt = "";
    let contexto = "";

    if (contacto_id) {
      // Dado un contacto → buscar propiedades en cartera
      const [{ data: contacto }, { data: props }] = await Promise.all([
        sb.from("crm_contactos").select("*").eq("id", contacto_id).single(),
        sb.from("cartera_propiedades").select("id,titulo,tipo,operacion,precio,moneda,ciudad,zona,dormitorios,banos,superficie_cubierta,superficie_total,apto_credito,con_cochera,estado,descripcion").eq("perfil_id", perfil_id).eq("estado", "activa").limit(50),
      ]);

      if (!contacto) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });

      contexto = `CONTACTO:
Nombre: ${sanitize(contacto.nombre)} ${sanitize(contacto.apellido)}
Interés: ${sanitize(contacto.interes) || "no especificado"}
Zona de interés: ${sanitize(contacto.zona_interes) || "cualquier zona"}
Presupuesto: ${contacto.presupuesto_min ? `${sanitize(contacto.moneda) || "USD"} ${Number(contacto.presupuesto_min)}` : "sin mínimo"} - ${contacto.presupuesto_max ? `${sanitize(contacto.moneda) || "USD"} ${Number(contacto.presupuesto_max)}` : "sin máximo"}
Notas: ${sanitize(contacto.notas) || "ninguna"}

PROPIEDADES DISPONIBLES (${props?.length ?? 0}):
${(props ?? []).map((p: any, i: number) =>
  `[${i + 1}] ID:${p.id} | ${sanitize(p.titulo)} | ${sanitize(p.tipo)} | ${sanitize(p.operacion)} | ${sanitize(p.ciudad)}${p.zona ? ` - ${sanitize(p.zona)}` : ""} | ${p.precio ? `${sanitize(p.moneda)} ${Number(p.precio).toLocaleString()}` : "sin precio"} | ${p.dormitorios ?? "?"}dorm ${p.banos ?? "?"}b | ${p.superficie_cubierta ?? "?"}m²`
).join("\n")}`;

      prompt = `${contexto}

Analizá el perfil del contacto y las propiedades disponibles. Identificá las 5 mejores coincidencias ordenadas por relevancia.
Para cada match indicá:
1. El número de propiedad [N]
2. El ID de la propiedad
3. Un porcentaje de compatibilidad (0-100%)
4. Una explicación breve de por qué es una buena coincidencia y qué aspectos no coinciden perfectamente

Respondé SOLO en JSON con este formato exacto, sin texto adicional:
{"matches":[{"id":"uuid","titulo":"...","compatibilidad":85,"razon":"..."},...]}`;

    } else {
      // Dado una propiedad → buscar contactos interesados
      const [{ data: prop }, { data: contactos }] = await Promise.all([
        sb.from("cartera_propiedades").select("*").eq("id", propiedad_id).single(),
        sb.from("crm_contactos").select("id,nombre,apellido,interes,zona_interes,presupuesto_min,presupuesto_max,moneda,notas,etiquetas").eq("perfil_id", perfil_id).limit(100),
      ]);

      if (!prop) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

      contexto = `PROPIEDAD:
${prop.titulo}
${prop.tipo} | ${prop.operacion} | ${prop.ciudad}${prop.zona ? ` - ${prop.zona}` : ""}
Precio: ${prop.precio ? `${prop.moneda} ${prop.precio.toLocaleString()}` : "sin precio"}
${prop.dormitorios}dorm | ${prop.banos}b | ${prop.superficie_cubierta ?? "?"}m²
Características: ${[prop.apto_credito && "apto crédito", prop.con_cochera && "cochera", prop.barrio_cerrado && "barrio cerrado"].filter(Boolean).join(", ") || "ninguna destacada"}

CONTACTOS (${contactos?.length ?? 0}):
${(contactos ?? []).map((c: any, i: number) =>
  `[${i + 1}] ID:${c.id} | ${sanitize(c.nombre)} ${sanitize(c.apellido)} | ${sanitize(c.interes) || "interés no especificado"} | Zona: ${sanitize(c.zona_interes) || "cualquier"} | Presupuesto: ${c.presupuesto_min ?? "?"}-${c.presupuesto_max ?? "?"} ${sanitize(c.moneda) || "USD"}`
).join("\n")}`;

      prompt = `${contexto}

Analizá la propiedad y los contactos. Identificá los 5 contactos más probablemente interesados, ordenados por relevancia.
Para cada match indicá el porcentaje de compatibilidad y el motivo.

Respondé SOLO en JSON con este formato exacto:
{"matches":[{"id":"uuid","nombre":"...","compatibilidad":85,"razon":"..."},...]}`;
    }

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as any).text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "No se pudo analizar la respuesta de IA" }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ok: true, tipo: contacto_id ? "propiedades" : "contactos", ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
