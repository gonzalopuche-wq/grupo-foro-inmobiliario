import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Runs weekly — syncs phones from cocir_padron → perfiles for profiles that have empty telefono
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: perfiles, error: ep } = await sb
    .from("perfiles")
    .select("id, matricula, telefono")
    .not("matricula", "is", null)
    .or("telefono.is.null,telefono.eq.");

  if (ep) return NextResponse.json({ ok: false, error: ep.message }, { status: 500 });
  if (!perfiles || perfiles.length === 0) {
    return NextResponse.json({ ok: true, actualizados: 0, message: "No hay perfiles sin teléfono" });
  }

  // Load padron in chunks
  let padron: { matricula: string | number; telefono: string | null }[] = [];
  let desde = 0;
  while (true) {
    const { data, error } = await sb
      .from("cocir_padron")
      .select("matricula, telefono")
      .not("telefono", "is", null)
      .neq("telefono", "")
      .range(desde, desde + 999);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    padron = padron.concat(data);
    if (data.length < 1000) break;
    desde += 1000;
  }

  const padronIdx = new Map<string, string>();
  for (const r of padron) {
    if (r.matricula != null && r.telefono) {
      const key = String(r.matricula).trim().replace(/^0+/, "") || String(r.matricula).trim();
      padronIdx.set(key, r.telefono);
    }
  }

  let actualizados = 0;
  let omitidos = 0;

  for (const perfil of perfiles) {
    const mat = String(perfil.matricula).trim();
    const matNorm = mat.replace(/^0+/, "") || mat;
    const tel = padronIdx.get(matNorm) ?? padronIdx.get(mat) ?? null;

    if (!tel) { omitidos++; continue; }

    const { error } = await sb.from("perfiles").update({ telefono: tel }).eq("id", perfil.id);
    if (!error) actualizados++;
  }

  return NextResponse.json({ ok: true, actualizados, omitidos, total_padron: padron.length });
}
