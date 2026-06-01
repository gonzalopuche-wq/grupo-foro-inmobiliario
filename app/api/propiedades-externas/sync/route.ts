import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncMercadoLibre } from "../../../lib/portales/mercadolibre";
import { syncZonaprop } from "../../../lib/portales/zonaprop";
import { syncArgenprop } from "../../../lib/portales/argenprop";
import { syncProperati } from "../../../lib/portales/properati";
import { syncGFIRed, syncGFIPortal } from "../../../lib/portales/gfi";
import { syncKitepropRed } from "../../../lib/portales/kiteprop_red";
import { syncTokkoRed } from "../../../lib/portales/tokko_red";
import { syncPropiaRed } from "../../../lib/portales/propia_red";
import { getIp } from "../../../lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PORTALES = [
  "gfi_red", "gfi_portal",
  "propia_red", "propia_portal",
  "kiteprop", "tokko",
  "mercadolibre", "zonaprop", "argenprop", "properati",
] as const;
type Portal = (typeof PORTALES)[number];

const PORTAL_TIMEOUT_MS = 90_000;

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function upsertBatch(
  sb: any,
  items: any[],
  portal: string,
): Promise<{ importados: number; upsertError?: string }> {
  let importados = 0;
  const BATCH = 50;
  const safeItems = Array.isArray(items) ? items : [];
  for (let i = 0; i < safeItems.length; i += BATCH) {
    const batch = safeItems.slice(i, i + BATCH).map(item => ({
      ...item,
      portal,
      activa: true,
      synced_at: new Date().toISOString(),
    }));
    let { error } = await sb
      .from("propiedades_externas")
      .upsert(batch, { onConflict: "portal,portal_id" });
    if (error?.message?.includes("violates check constraint")) {
      await sb.rpc("reparar_constraint_portales"); // ignorar error si la función no existe
      const retry = await sb
        .from("propiedades_externas")
        .upsert(batch, { onConflict: "portal,portal_id" });
      error = retry.error;
    }
    if (error) return { importados, upsertError: error.message };
    importados += batch.length;
  }
  return { importados };
}

type PortalResult = { importados: number; cruzadas?: number; error?: string };

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
  const auth = await verificarAdmin(token);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { portal?: string };
  const portalFiltro = body.portal as Portal | "all" | undefined ?? "all";

  const portalesSync: Portal[] = portalFiltro === "all"
    ? [...PORTALES]
    : PORTALES.filter(p => p === portalFiltro);

  // auth es non-null a este punto; usar variable local para type narrowing en closures
  const { user, sb } = auth;

  // Reparar constraint y vista al comienzo (idempotente; no lanza si la fn no existe)
  const { error: _repairErr } = await sb.rpc("reparar_constraint_portales");
  void _repairErr;
  const { error: _vistaErr } = await sb.rpc("reparar_vista_mercado_normalizada");
  void _vistaErr;

  // Promise compartido para Propia (evita doble fetch para propia_red + propia_portal)
  let propiaPromise: Promise<{ mls: any[]; portal: any[] }> | null = null;
  const getPropiaSync = () => {
    if (!propiaPromise) propiaPromise = withTimeout(syncPropiaRed(), PORTAL_TIMEOUT_MS);
    return propiaPromise;
  };

  async function runPortal(portal: Portal): Promise<[Portal, PortalResult]> {
    try {
      if (portal === "kiteprop") {
        const { items, publicaciones } = await withTimeout(syncKitepropRed(), PORTAL_TIMEOUT_MS);
        const { importados, upsertError } = await upsertBatch(sb, items, "kiteprop");
        const mappedKP = publicaciones.map((pub: any) => {
          const { _portal, _portal_id, _url, ...rest } = pub;
          return { ...rest, portal: _portal, portal_id: _portal_id, url: _url, activa: true, synced_at: new Date().toISOString() };
        });
        let cruzadas = 0;
        for (let i = 0; i < mappedKP.length; i += 50) {
          const { error } = await sb
            .from("propiedades_externas")
            .upsert(mappedKP.slice(i, i + 50), { onConflict: "portal,portal_id" });
          if (!error) cruzadas += Math.min(50, mappedKP.length - i);
        }
        return [portal, { importados, cruzadas, ...(upsertError ? { error: upsertError } : {}) }];
      }

      if (portal === "tokko") {
        const { items, publicaciones } = await withTimeout(syncTokkoRed(), PORTAL_TIMEOUT_MS);
        const { importados, upsertError } = await upsertBatch(sb, items, "tokko");
        const mappedTK = publicaciones.map((pub: any) => {
          const { _portal, _portal_id, _url, ...rest } = pub;
          return { ...rest, portal: _portal, portal_id: _portal_id, url: _url, activa: true, synced_at: new Date().toISOString() };
        });
        let cruzadas = 0;
        for (let i = 0; i < mappedTK.length; i += 50) {
          const { error } = await sb
            .from("propiedades_externas")
            .upsert(mappedTK.slice(i, i + 50), { onConflict: "portal,portal_id" });
          if (!error) cruzadas += Math.min(50, mappedTK.length - i);
        }
        return [portal, { importados, cruzadas, ...(upsertError ? { error: upsertError } : {}) }];
      }

      if (portal === "propia_red") {
        const { mls } = await getPropiaSync();
        const { importados, upsertError } = await upsertBatch(sb, mls, "propia_red");
        return [portal, { importados, ...(upsertError ? { error: upsertError } : {}) }];
      }

      if (portal === "propia_portal") {
        const { portal: portalItems } = await getPropiaSync();
        const { importados, upsertError } = await upsertBatch(sb, portalItems, "propia_portal");
        return [portal, { importados, ...(upsertError ? { error: upsertError } : {}) }];
      }

      let items: any[] = [];
      if (portal === "mercadolibre")    items = await withTimeout(syncMercadoLibre(300), PORTAL_TIMEOUT_MS);
      else if (portal === "zonaprop")   items = await withTimeout(syncZonaprop(2), PORTAL_TIMEOUT_MS);
      else if (portal === "argenprop")  items = await withTimeout(syncArgenprop(2), PORTAL_TIMEOUT_MS);
      else if (portal === "properati")  items = await withTimeout(syncProperati(), PORTAL_TIMEOUT_MS);
      else if (portal === "gfi_red")    items = await withTimeout(syncGFIRed(), PORTAL_TIMEOUT_MS);
      else if (portal === "gfi_portal") items = await withTimeout(syncGFIPortal(), PORTAL_TIMEOUT_MS);

      if (!items.length) {
        return [portal, { importados: 0, error: "Portal sin resultados (0 propiedades encontradas)" }];
      }

      const { importados, upsertError } = await upsertBatch(sb, items, portal);
      return [portal, { importados, ...(upsertError ? { error: upsertError } : {}) }];
    } catch (e: any) {
      return [portal, { importados: 0, error: e?.message ?? "Error desconocido" }];
    }
  }

  // Ejecutar todos los portales en paralelo
  const settled = await Promise.allSettled(portalesSync.map(p => runPortal(p)));

  const resultados: Record<string, PortalResult> = {};
  for (const result of settled) {
    if (result.status === "fulfilled") {
      const [portal, data] = result.value;
      resultados[portal] = data;
    } else {
      // No debería ocurrir porque runPortal ya captura excepciones internamente
    }
  }

  const total = Object.values(resultados).reduce((s, r) => s + r.importados, 0);

  try {
    await sb.from("logs_actividad").insert({
      user_id: user.id,
      accion: "sync_portales_externos",
      modulo: "propiedades_externas",
      detalle: `Sync ${portalFiltro}: ${total} propiedades importadas. ${JSON.stringify(resultados)}`,
      ip: getIp(req),
    });
  } catch {}

  return NextResponse.json({ ok: true, total, resultados });
}
