import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await sbAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sbAdmin.from("perfiles").select("tipo").eq("id", user.id).maybeSingle();
  if (!["admin", "master"].includes(perfil?.tipo ?? "")) {
    return NextResponse.json({ error: "Acceso restringido a administradores" }, { status: 403 });
  }

  const body = await req.json();
  const { titulo, bodyText, url, tipo, perfil_id } = body;
  if (!titulo || !bodyText) return NextResponse.json({ error: "Faltan título y body" }, { status: 400 });

  // Call push/send from the server using CRON_SECRET (never exposed to the browser)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";
  const res = await fetch(`${baseUrl}/api/push/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.CRON_SECRET ?? "",
    },
    body: JSON.stringify({ titulo, body: bodyText, url, tipo, perfil_id }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
