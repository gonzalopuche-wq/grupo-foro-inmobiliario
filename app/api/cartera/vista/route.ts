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
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
