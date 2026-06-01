// Cron diario: sincroniza propiedades_externas desde ZonaProp, Argenprop y MercadoLibre
// Se ejecuta a las 4am, 1 hora después del cron de portales API.
// NOTA: ZP y AP pueden retornar 403 desde IPs de datacenter (Cloudflare/Vercel).
// En ese caso el portal se registra como error pero el resto continúa.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncZonaprop } from "../../../lib/portales/zonaprop";
import { syncArgenprop } from "../../../lib/portales/argenprop";
import { syncMercadoLibre } from "../../../lib/portales/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function upsert(items: any[], portal: string): Promise<number> {
  const BATCH = 50;
  const now = new Date().toISOString();
  let ok = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map(item => ({
      ...item,
      portal,
      activa: true,
      synced_at: now,
    }));
    const { error } = await sb
      .from("propiedades_externas")
      .upsert(batch, { onConflict: "portal,portal_id" });
    if (error) throw new Error(`Upsert ${portal}: ${error.message}`);
    ok += batch.length;
  }
  return ok;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const resultados: Record<string, { importados: number; error?: string }> = {};

  // ── ZonaProp ─────────────────────────────────────────────────────────────
  try {
    const items = await syncZonaprop(3);
    resultados.zonaprop = { importados: await upsert(items, "zonaprop") };
  } catch (e: any) {
    resultados.zonaprop = { importados: 0, error: e?.message };
  }

  // ── Argenprop ─────────────────────────────────────────────────────────────
  try {
    const items = await syncArgenprop(3);
    resultados.argenprop = { importados: await upsert(items, "argenprop") };
  } catch (e: any) {
    resultados.argenprop = { importados: 0, error: e?.message };
  }

  // ── MercadoLibre ──────────────────────────────────────────────────────────
  try {
    const items = await syncMercadoLibre(300);
    resultados.mercadolibre = { importados: await upsert(items, "mercadolibre") };
  } catch (e: any) {
    resultados.mercadolibre = { importados: 0, error: e?.message };
  }

  const total = Object.values(resultados).reduce((s, r) => s + r.importados, 0);

  try {
    await sb.from("logs_actividad").insert({
      accion: "cron_sync_portales_scraper",
      modulo: "propiedades_externas",
      detalle: `Scraper sync: ${total} propiedades. ${JSON.stringify(resultados)}`,
    });
  } catch {}

  return NextResponse.json({ ok: true, total, resultados });
}
