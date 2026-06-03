// Config de contacto y recursos Propia — almacenada en la tabla `indicadores`
// Claves: propia_tel_1, propia_tel_1_label, propia_tel_2, propia_tel_2_label,
//         propia_tel_3, propia_tel_3_label, propia_email,
//         propia_reglamento_url, propia_reglamento_nombre

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CLAVES = [
  "propia_tel_1", "propia_tel_1_label",
  "propia_tel_2", "propia_tel_2_label",
  "propia_tel_3", "propia_tel_3_label",
  "propia_email",
  "propia_reglamento_url", "propia_reglamento_nombre",
];

// ── GET — público, sin auth ───────────────────────────────────────────────────
export async function GET() {
  const { data } = await sb
    .from("indicadores")
    .select("clave, valor")
    .in("clave", CLAVES);

  const config: Record<string, string> = {};
  for (const row of data ?? []) config[row.clave] = row.valor ?? "";
  return NextResponse.json(config);
}

// ── POST — solo admin ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin" && perfil?.tipo !== "master") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const body = await req.json() as Record<string, string>;

  const upserts = Object.entries(body)
    .filter(([k]) => CLAVES.includes(k))
    .map(([clave, valor]) => ({ clave, valor: valor ?? "" }));

  if (upserts.length === 0) return NextResponse.json({ ok: true });

  const { error } = await sb
    .from("indicadores")
    .upsert(upserts, { onConflict: "clave" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
