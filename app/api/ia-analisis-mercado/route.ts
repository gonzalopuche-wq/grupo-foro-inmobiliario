import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { barrioStats, tipoStats, mirStats, comunidadStat, periodo } = await req.json();

  const topBarrios = (barrioStats ?? [])
    .slice(0, 5)
    .map((b: any) => `${b.barrio}: ${b.cant} ops${b.precio_m2_avg > 0 ? `, $${Math.round(b.precio_m2_avg).toLocaleString("es-AR")}/m²` : ""}`)
    .join("; ");

  const topTipos = (tipoStats ?? [])
    .slice(0, 4)
    .map((t: any) => `${t.tipo}: ${t.cant}`)
    .join(", ");

  const mirResumen = (mirStats ?? [])
    .slice(0, 3)
    .map((m: any) => `${m.tipo}: ${m.ofrecidos} ofrecidas / ${m.busquedas} buscadas`)
    .join("; ");

  const prompt = `Sos un analista del mercado inmobiliario de Rosario, Argentina. Analizá los siguientes datos del Observatorio GFI® y escribí un análisis breve de entre 120 y 200 palabras en español.

Período de análisis: ${periodo === "todo" ? "histórico completo" : periodo}
Comunidad: ${comunidadStat?.total_corredores ?? "N/D"} corredores, ${comunidadStat?.total_comparables ?? 0} comparables, ${comunidadStat?.total_mir ?? 0} publicaciones MIR.

Top barrios por operaciones: ${topBarrios || "sin datos"}
Tipos de propiedad más operados: ${topTipos || "sin datos"}
MIR oferta vs demanda: ${mirResumen || "sin datos"}

Incluí: tendencias observadas, qué tipos de propiedades tienen mayor demanda, qué zonas muestran más actividad, y 1-2 recomendaciones prácticas para corredores. Sé concreto y usa terminología inmobiliaria argentina.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as any)?.text ?? "";
    return NextResponse.json({ analisis: text });
  } catch (err) {
    console.error("Error IA análisis mercado:", err);
    return NextResponse.json({ error: "Error al generar el análisis." }, { status: 500 });
  }
}
