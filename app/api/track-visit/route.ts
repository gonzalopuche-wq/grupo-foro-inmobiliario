import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SKIP_PREFIXES = ["/admin", "/api"];

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ ok: false });

  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ ok: false });

  let ruta: string;
  try {
    ({ ruta } = await req.json());
  } catch {
    return NextResponse.json({ ok: false });
  }

  if (!ruta || SKIP_PREFIXES.some(p => ruta.startsWith(p))) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const dispositivo = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";

  await sb.from("logs_actividad").insert({
    user_id: user.id,
    accion: "page_view",
    modulo: ruta,
    detalle: dispositivo,
  });

  return NextResponse.json({ ok: true });
}
