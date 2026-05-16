import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const eventoTool: Anthropic.Tool = {
  name: "evento_parseado",
  description: "Datos estructurados del evento inmobiliario extraídos del texto",
  input_schema: {
    type: "object" as const,
    properties: {
      titulo:         { type: "string" },
      descripcion:    { type: "string", description: "Descripción completa incluyendo disertantes y toda info relevante" },
      fecha:          { type: "string", description: "Formato YYYY-MM-DD" },
      hora:           { type: "string", description: "Formato HH:MM en 24hs" },
      tipo:           { type: "string", enum: ["cocir","cir","gfi","externo"] },
      plataforma:     { type: "string", enum: ["zoom","meet","youtube","presencial"] },
      lugar:          { type: ["string","null"] },
      link_reunion:   { type: ["string","null"] },
      link_externo:   { type: ["string","null"], description: "Link de inscripción si existe" },
      gratuito:       { type: "boolean" },
      precio_entrada: { type: ["number","null"] },
      capacidad:      { type: ["number","null"] },
    },
    required: ["titulo","descripcion","fecha","hora","tipo","plataforma","gratuito"],
  },
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { texto } = await req.json();
    if (!texto?.trim()) {
      return NextResponse.json({ error: "Sin texto" }, { status: 400 });
    }

    const messages = [
      {
        role: "user" as const,
        content: `Analiza este texto de un evento inmobiliario y extraé los datos estructurados.

Reglas:
- tipo: si menciona COCIR → cocir, CIR → cir, GFI → gfi, sino → externo
- plataforma: Zoom→zoom, Meet→meet, YouTube→youtube, presencial→presencial, sino→presencial
- fecha: si no hay año usar 2026. Meses: enero=01 feb=02 mar=03 abr=04 may=05 jun=06 jul=07 ago=08 sep=09 oct=10 nov=11 dic=12
- hora: formato 24hs. 17.30hs→17:30, 9hs→09:00
- gratuito: false si menciona precio, true si dice gratuito o no menciona precio
- link_externo: buscar links de inscripción (forms.gle, eventbrite, etc.)
- descripcion: incluir disertantes, temática, info de la organización

TEXTO:
${texto}`,
      },
    ];

    const safeMessages = messages
      .map(m => ({ role: m.role, content: (m.content || "").trim() }))
      .filter(m => m.content.length > 0);

    if (safeMessages.length === 0) {
      return NextResponse.json({ error: "Sin texto para procesar" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      tools: [eventoTool],
      tool_choice: { type: "tool", name: "evento_parseado" },
      messages: safeMessages,
    });

    const toolUse = response.content.find(b => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "No se pudo parsear" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: toolUse.input });
  } catch (err) {
    console.error("Parser eventos error:", err);
    return NextResponse.json({ error: "No se pudo parsear" }, { status: 500 });
  }
}
