import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getIp } from "../../../lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const ip = getIp(req);

  await sb.from("logs_actividad").insert({
    user_id: user.id,
    accion: "login",
    modulo: "auth",
    detalle: `Inicio de sesión. IP: ${ip}`,
    ip,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
