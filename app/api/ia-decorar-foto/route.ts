// IA Decoración de fotos — amobla habitaciones vacías o cambia el estilo
// Requiere: REPLICATE_API_TOKEN en variables de entorno de Vercel
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ESTILOS: Record<string, string> = {
  moderno: "modern minimalist interior design, clean lines, neutral colors, contemporary furniture",
  clasico: "classic elegant interior, warm tones, traditional furniture, sophisticated decor",
  nordico: "scandinavian nordic interior, white walls, natural wood, cozy hygge style",
  industrial: "industrial loft interior, exposed brick, metal fixtures, urban style",
  premium: "luxury premium interior design, high-end furniture, marble, gold accents",
  vacio: "empty clean room, white walls, no furniture, ready to show",
};

export async function POST(req: NextRequest) {
  try {
    const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const { data: { user } } = await sb.auth.getUser(authToken);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { foto_url, estilo = "moderno" } = await req.json();

    if (!foto_url) return NextResponse.json({ error: "foto_url requerida" }, { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json({
        error: "REPLICATE_API_TOKEN no configurada. Agregala en las variables de entorno de Vercel para usar decoración IA.",
        pendiente: true,
      }, { status: 400 });
    }

    const estiloPrompt = ESTILOS[estilo] ?? ESTILOS.moderno;
    const prompt = `${estiloPrompt}, professional real estate photography, bright natural light, photorealistic, 8k quality`;

    // Create prediction with Stable Diffusion img2img via Replicate
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        input: {
          prompt,
          image: foto_url,
          prompt_strength: 0.6,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          negative_prompt: "blurry, ugly, deformed, watermark, text, bad quality, people, person",
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return NextResponse.json({ error: `Replicate error: ${err}` }, { status: 500 });
    }

    const prediction = await createRes.json();

    // Poll for result (up to 55s)
    const id = prediction.id;
    let output = null;
    let tries = 0;

    while (tries < 55) {
      await new Promise(r => setTimeout(r, 1000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { "Authorization": `Token ${token}` },
      });
      const data = await pollRes.json();
      if (data.status === "succeeded") { output = data.output; break; }
      if (data.status === "failed") return NextResponse.json({ error: `Replicate failed: ${data.error}` }, { status: 500 });
      tries++;
    }

    if (!output) return NextResponse.json({ error: "Timeout esperando resultado de IA" }, { status: 500 });

    const resultUrl = Array.isArray(output) ? output[0] : output;
    return NextResponse.json({ ok: true, url: resultUrl, estilo });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
