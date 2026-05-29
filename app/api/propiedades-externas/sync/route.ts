import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncMercadoLibre } from "../../../lib/portales/mercadolibre";
import { syncZonaprop } from "../../../lib/portales/zonaprop";
import { syncArgenprop } from "../../../lib/portales/argenprop";
import { syncProperati } from "../../../lib/portales/properati";
import { syncGFIRed, syncGFIPortal } from "../../../lib/portales/gfi";
import { syncKitepropRed } from "../../../lib/portales/kiteprop_red";
import { syncTokkoRed } from "../../../lib/portales/tokko_red";
import { getIp } from "../../../lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PORTALES = [
  "mercadolibre", "zonaprop", "argenprop", "properati",
  "gfi_red", "gfi_portal",
  "kiteprop", "tokko",
] as const;
type Portal = (typeof PORTALES)[number];

async function verificarAdmin(token: string | null) {
  if (!token) return null;
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return null;
  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (!perfil || !["admin", "master"].includes(perfil.tipo)) return null;
  return { user, sb };
}

async function upsertBatch(sb: any, items: any[], portal: string) {
  let importados = 0;
  const BATCH = 50;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map(item => ({
      ...item,
      portal,
      activa: true,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await sb
      .from("propiedades_externas")
      .upsert(batch, { onConflict: "portal,portal_id" });
    if (!error) importados += batch.length;
  }
  return importados;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
  const auth = await verificarAdmin(token);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { portal?: string };
  const portalFiltro = body.portal as Portal | "all" | undefined ?? "all";

  const portalesSync: Portal[] = portalFiltro === "all"
    ? [...PORTALES]
    : PORTALES.filter(p => p === portalFiltro);

  const resultados: Record<string, { importados: number; cruzadas?: number; error?: string }> = {};

  for (const portal of portalesSync) {
    try {
      // ── CRMs con cross-referencia de portales ──────────────────────────────
      if (portal === "kiteprop") {
        const { items, publicaciones } = await syncKitepropRed();
        const importados = await upsertBatch(auth.sb, items, "kiteprop");

        // Upsert publicaciones cruzadas en sus respectivos portales
        let cruzadas = 0;
        for (const pub of publicaciones) {
          const { _portal, _portal_id, _url, ...rest } = pub as any;
          const crossItem = { ...rest, portal_id: _portal_id, url: _url };
          const { error } = await auth.sb.from("propiedades_externas").upsert(
            [{ ...crossItem, portal: _portal, activa: true, synced_at: new Date().toISOString() }],
            { onConflict: "portal,portal_id" }
          );
          if (!error) cruzadas++;
        }

        resultados[portal] = { importados, cruzadas };
        continue;
      }

      if (portal === "tokko") {
        const { items, publicaciones } = await syncTokkoRed();
        const importados = await upsertBatch(auth.sb, items, "tokko");

        let cruzadas = 0;
        for (const pub of publicaciones) {
          const { _portal, _portal_id, _url, ...rest } = pub as any;
          const crossItem = { ...rest, portal_id: _portal_id, url: _url };
          const { error } = await auth.sb.from("propiedades_externas").upsert(
            [{ ...crossItem, portal: _portal, activa: true, synced_at: new Date().toISOString() }],
            { onConflict: "portal,portal_id" }
          );
          if (!error) cruzadas++;
        }

        resultados[portal] = { importados, cruzadas };
        continue;
      }

      // ── Portales directos ──────────────────────────────────────────────────
      let items: any[] = [];
      if (portal === "mercadolibre")    items = await syncMercadoLibre(300);
      else if (portal === "zonaprop")   items = await syncZonaprop(2);
      else if (portal === "argenprop")  items = await syncArgenprop(2);
      else if (portal === "properati")  items = await syncProperati();
      else if (portal === "gfi_red")    items = await syncGFIRed();
      else if (portal === "gfi_portal") items = await syncGFIPortal();

      if (!items.length) {
        resultados[portal] = { importados: 0, error: "Sin resultados del portal" };
        continue;
      }

      resultados[portal] = { importados: await upsertBatch(auth.sb, items, portal) };
    } catch (e: any) {
      resultados[portal] = { importados: 0, error: e?.message ?? "Error desconocido" };
    }
  }

  const total = Object.values(resultados).reduce((s, r) => s + r.importados, 0);

  try {
    await auth.sb.from("logs_actividad").insert({
      user_id: auth.user.id,
      accion: "sync_portales_externos",
      modulo: "propiedades_externas",
      detalle: `Sync ${portalFiltro}: ${total} propiedades importadas. ${JSON.stringify(resultados)}`,
      ip: getIp(req),
    });
  } catch {}

  return NextResponse.json({ ok: true, total, resultados });
}
