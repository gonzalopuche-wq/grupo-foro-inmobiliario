// Cron diario: sincroniza propiedades_externas desde GFI, Kiteprop, Tokko y Propia
// No sincroniza scrapers (ML, Zonaprop, Argenprop) por riesgo de bloqueo
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncGFIRed, syncGFIPortal } from "../../../lib/portales/gfi";
import { syncKitepropRed } from "../../../lib/portales/kiteprop_red";
import { syncTokkoRed } from "../../../lib/portales/tokko_red";
import { syncPropiaRed } from "../../../lib/portales/propia_red";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function upsert(items: any[], portal: string) {
  let ok = 0;
  const BATCH = 50;
  const now = new Date().toISOString();
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
    if (!error) ok += batch.length;
  }
  return ok;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const resultados: Record<string, { importados: number; error?: string }> = {};

  // ── GFI Red y Portal (lectura local, siempre disponible) ────────────────
  try {
    const [red, portal] = await Promise.all([syncGFIRed(), syncGFIPortal()]);
    resultados.gfi_red    = { importados: await upsert(red,    "gfi_red") };
    resultados.gfi_portal = { importados: await upsert(portal, "gfi_portal") };
  } catch (e: any) {
    resultados.gfi_red    = { importados: 0, error: e?.message };
    resultados.gfi_portal = { importados: 0, error: e?.message };
  }

  // ── Propia (MLS + Portal en un solo fetch) ──────────────────────────────
  try {
    const { mls, portal } = await syncPropiaRed();
    resultados.propia_red    = { importados: await upsert(mls,    "propia_red") };
    resultados.propia_portal = { importados: await upsert(portal, "propia_portal") };
  } catch (e: any) {
    resultados.propia_red    = { importados: 0, error: e?.message };
    resultados.propia_portal = { importados: 0, error: e?.message };
  }

  // ── Kiteprop ─────────────────────────────────────────────────────────────
  try {
    const { items, publicaciones } = await syncKitepropRed();
    resultados.kiteprop = { importados: await upsert(items, "kiteprop") };
    // Cross-referencias (publicaciones en portales externos)
    const mapped = publicaciones.map((pub: any) => {
      const { _portal, _portal_id, _url, ...rest } = pub;
      return { ...rest, portal: _portal, portal_id: _portal_id, url: _url, activa: true, synced_at: new Date().toISOString() };
    });
    for (let i = 0; i < mapped.length; i += 50) {
      await sb.from("propiedades_externas").upsert(mapped.slice(i, i + 50), { onConflict: "portal,portal_id" });
    }
  } catch (e: any) {
    resultados.kiteprop = { importados: 0, error: e?.message };
  }

  // ── Tokko ────────────────────────────────────────────────────────────────
  try {
    const { items, publicaciones } = await syncTokkoRed();
    resultados.tokko = { importados: await upsert(items, "tokko") };
    const mapped = publicaciones.map((pub: any) => {
      const { _portal, _portal_id, _url, ...rest } = pub;
      return { ...rest, portal: _portal, portal_id: _portal_id, url: _url, activa: true, synced_at: new Date().toISOString() };
    });
    for (let i = 0; i < mapped.length; i += 50) {
      await sb.from("propiedades_externas").upsert(mapped.slice(i, i + 50), { onConflict: "portal,portal_id" });
    }
  } catch (e: any) {
    resultados.tokko = { importados: 0, error: e?.message };
  }

  const total = Object.values(resultados).reduce((s, r) => s + r.importados, 0);

  try {
    await sb.from("logs_actividad").insert({
      accion: "cron_sync_propiedades_externas",
      modulo: "propiedades_externas",
      detalle: `Cron sync: ${total} propiedades. ${JSON.stringify(resultados)}`,
    });
  } catch {}

  return NextResponse.json({ ok: true, total, resultados });
}
