import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  try {
    let visita_id: string, puntaje: string, interes: string, comentario: string;

    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      ({ visita_id, puntaje, interes, comentario } = body);
    } else {
      const fd = await req.formData();
      visita_id = fd.get("visita_id") as string;
      puntaje   = fd.get("puntaje")   as string;
      interes   = fd.get("interes")   as string;
      comentario = (fd.get("comentario") as string) ?? "";
    }

    if (!visita_id) return NextResponse.json({ error: "visita_id requerido" }, { status: 400 });

    const { data: visita } = await sb
      .from("cartera_visitas")
      .select("id, feedback_at")
      .eq("id", visita_id)
      .single();

    if (!visita) return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
    if (visita.feedback_at) {
      // Already responded — redirect to thank you
      return NextResponse.redirect(`${baseUrl}/feedback/visita/${visita_id}`, 302);
    }

    await sb.from("cartera_visitas").update({
      feedback_puntaje:    puntaje ? Number(puntaje) : null,
      feedback_interes:    interes ?? null,
      feedback_comentario: comentario || null,
      feedback_at:         new Date().toISOString(),
    }).eq("id", visita_id);

    return NextResponse.redirect(`${baseUrl}/feedback/visita/${visita_id}`, 302);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
