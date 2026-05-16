import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Runs daily — syncs Tokko for all profiles that have an active API key
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Find all profiles with a Tokko API key configured
  const { data: creds, error } = await sb
    .from("portal_credenciales")
    .select("perfil_id")
    .not("tokko_key", "is", null)
    .neq("tokko_key", "");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!creds || creds.length === 0) return NextResponse.json({ ok: true, synced: 0, message: "No hay perfiles con Tokko configurado" });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foroinmobiliario.com.ar";
  const results: { perfil_id: string; importadas: number; actualizadas: number; saltadas: number; error?: string }[] = [];

  for (const { perfil_id } of creds) {
    try {
      // solo_nuevas=false → also updates price/status of existing synced properties
      const res = await fetch(`${baseUrl}/api/cartera/import-tokko?perfil_id=${perfil_id}&solo_nuevas=false`, {
        headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
      });
      const json = await res.json();
      results.push({ perfil_id, importadas: json.importadas ?? 0, actualizadas: json.actualizadas ?? 0, saltadas: json.saltadas ?? 0, error: json.error ?? undefined });
    } catch (e: any) {
      results.push({ perfil_id, importadas: 0, actualizadas: 0, saltadas: 0, error: e.message });
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results });
}
