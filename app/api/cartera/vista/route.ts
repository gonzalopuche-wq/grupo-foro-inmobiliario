import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getIp } from "../../../lib/ratelimit";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/cartera/vista — register one public page view for a property
// Rate-limited: 1 view per IP per property per hour to avoid inflation
export async function POST(req: NextRequest) {
  try {
    const { propiedad_id } = await req.json();
    if (!propiedad_id) return NextResponse.json({ ok: false }, { status: 400 });

    const key = `vista:${getIp(req)}:${propiedad_id}`;
    if (!rateLimit(key, 1, 60 * 60 * 1000)) {
      return NextResponse.json({ ok: false, reason: "already_counted" });
    }

    await sb.rpc("incrementar_vistas", { prop_id: propiedad_id });

    // Check for view milestones and notify the corredor
    const MILESTONES = [10, 50, 100, 500];
    const { data: prop } = await sb
      .from("cartera_propiedades")
      .select("vistas, titulo, perfil_id")
      .eq("id", propiedad_id)
      .single();
    if (prop && MILESTONES.includes(prop.vistas)) {
      await sb.from("notificaciones").insert({
        user_id: prop.perfil_id,
        titulo: `🎯 ${prop.vistas} vistas en tu propiedad`,
        mensaje: `"${prop.titulo ?? "Tu propiedad"}" alcanzó ${prop.vistas} visitas en tu sitio web.`,
        tipo: "cartera",
        url: "/crm/estadisticas",
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
