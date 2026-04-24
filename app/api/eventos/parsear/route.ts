import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { texto } = await req.json();
    if (!texto?.trim()) {
      return NextResponse.json({ error: "Sin texto" }, { status: 400 });
    }

    const prompt = [
      "Analiza este texto de un evento inmobiliario y extrae los datos en JSON.",
      "Texto:",
      texto,
      "",
      "Responde SOLO con JSON valido, sin explicaciones ni backticks, con este formato exacto:",
      JSON.stringify({
        titulo: "titulo del evento",
        descripcion: "descripcion completa incluyendo disertantes y toda info relevante",
        fecha: "YYYY-MM-DD",
        hora: "HH:MM",
        tipo: "cocir",
        plataforma: "zoom",
        lugar: null,
        link_reunion: null,
        link_externo: "link de inscripcion si existe",
        gratuito: true,
        precio_entrada: null,
        capacidad: null,
      }, null, 2),
      "",
      "Reglas:",
      "- tipo: si menciona COCIR usar cocir, CIR usar cir, GFI usar gfi, sino usar externo",
      "- plataforma: Zoom->zoom, Meet->meet, YouTube->youtube, presencial->presencial, sino presencial",
      "- fecha: si no hay anio usar 2026. Meses en español: enero=01 febrero=02 marzo=03 abril=04 mayo=05 junio=06 julio=07 agosto=08 septiembre=09 octubre=10 noviembre=11 diciembre=12",
      "- hora: formato 24hs. 17.30hs -> 17:30, 9hs -> 09:00",
      "- gratuito: false si menciona precio o costo, true si dice gratuito o sin costo o no menciona precio",
      "- link_externo: buscar links de formularios de inscripcion (forms.gle, eventbrite, etc)",
      "- descripcion: incluir disertantes, tematica, info de la organizacion, todo lo relevante",
    ].join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const texto_resp = data.content?.[0]?.text ?? "";
    const clean = texto_resp.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err) {
    console.error("Parser eventos error:", err);
    return NextResponse.json({ error: "No se pudo parsear" }, { status: 500 });
  }
}
