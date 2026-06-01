import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// SQL embebido solo como fallback cuando exec_sql RPC o Management API están disponibles
const MIGRATION_122_STEP1 = `ALTER TABLE propiedades_externas DROP CONSTRAINT IF EXISTS propiedades_externas_portal_check;`;
const MIGRATION_122_STEP2 = `ALTER TABLE propiedades_externas ADD CONSTRAINT propiedades_externas_portal_check CHECK (portal IN ('mercadolibre','zonaprop','argenprop','properati','gfi_red','gfi_portal','gfi','kiteprop','tokko','propia','propia_red','propia_portal'));`;

const MIGRATION_123 = `
DROP VIEW IF EXISTS v_propiedades_mercado;
CREATE VIEW v_propiedades_mercado AS
SELECT id::text AS id, 'gfi' AS fuente, 'gfi' AS red, titulo,
  LOWER(operacion) AS operacion, LOWER(tipo) AS tipo,
  precio, moneda, zona AS barrio, ciudad, 'Santa Fe'::text AS provincia,
  direccion, latitud AS lat, longitud AS lng,
  dormitorios, banos, NULL::integer AS ambientes,
  superficie_cubierta, NULL::numeric AS sup_terreno, NULL::numeric AS expensas,
  (CASE WHEN fotos IS NOT NULL AND array_length(fotos, 1) > 0 THEN fotos[1] ELSE NULL END) AS foto_principal,
  descripcion, '/crm/cartera/ficha/' || id::text AS url,
  perfil_id::text AS propietario_id, estado, updated_at
FROM cartera_propiedades WHERE estado IN ('activa', 'reservada')
UNION ALL
SELECT id::text AS id, portal AS fuente, portal AS red, titulo,
  operacion, tipo, precio, moneda, barrio, ciudad, provincia, direccion, lat, lng,
  dormitorios, banos, ambientes, superficie_cubierta,
  NULL::numeric AS sup_terreno, NULL::numeric AS expensas,
  (CASE WHEN imagenes IS NOT NULL AND jsonb_array_length(imagenes) > 0 THEN imagenes ->> 0 ELSE NULL END) AS foto_principal,
  descripcion, url, NULL::text AS propietario_id, 'activa' AS estado, synced_at AS updated_at
FROM propiedades_externas WHERE activa = true;
GRANT SELECT ON v_propiedades_mercado TO authenticated;
`.trim();

async function execViaManagementApi(sql: string, ref: string, accessToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.message ?? `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

async function execViaRpc(sql: string, supabaseUrl: string, serviceRoleKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.message ?? body?.hint ?? `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

  const sb = createClient(supabaseUrl, serviceRoleKey);
  const results: Record<string, any> = {};

  // ── Migration 122: fix CHECK constraint ────────────────────────────────────
  // Intento 1: llamar reparar_constraint_portales() — existe desde migration 120
  // Esta función ya cubre todos los portales que usa el sync (kiteprop, tokko, propia_red/portal, etc.)
  const { data: rpcData, error: rpcError } = await sb.rpc("reparar_constraint_portales");
  if (!rpcError) {
    // Función existe — también intentar añadir 'gfi' y 'propia' (migration 122 completa)
    // vía Management API o exec_sql si están disponibles
    let extra122: { ok: boolean; error?: string } = { ok: true };
    if (accessToken) {
      const r1 = await execViaManagementApi(MIGRATION_122_STEP1, ref, accessToken);
      const r2 = r1.ok ? await execViaManagementApi(MIGRATION_122_STEP2, ref, accessToken) : r1;
      extra122 = r2;
    }
    results.migration_122 = {
      ok: true,
      method: "reparar_constraint_portales_rpc" + (extra122.ok && accessToken ? "+management_api_v2" : ""),
      note: rpcData ?? "constraint reparado — portales activos cubiertos",
    };
  } else {
    // Intento 2: Management API
    if (accessToken) {
      const r1 = await execViaManagementApi(MIGRATION_122_STEP1, ref, accessToken);
      const r2 = r1.ok ? await execViaManagementApi(MIGRATION_122_STEP2, ref, accessToken) : r1;
      results.migration_122 = { ok: r2.ok, method: "management_api", error: r2.error };
    } else {
      // Intento 3: exec_sql RPC (requiere función custom)
      const r1 = await execViaRpc(MIGRATION_122_STEP1, supabaseUrl, serviceRoleKey);
      const r2 = r1.ok ? await execViaRpc(MIGRATION_122_STEP2, supabaseUrl, serviceRoleKey) : r1;
      results.migration_122 = { ok: r2.ok, method: "exec_sql_rpc", error: r2.error };
    }
  }

  // ── Migration 123: recrear vista con LOWER(operacion/tipo) ─────────────────
  // Intento 1: reparar_vista_mercado_normalizada() — existe desde migration 124 si fue aplicada
  const { error: rpcView } = await sb.rpc("reparar_vista_mercado_normalizada");
  if (!rpcView) {
    results.migration_123 = { ok: true, method: "reparar_vista_mercado_normalizada_rpc" };
  } else if (accessToken) {
    const r = await execViaManagementApi(MIGRATION_123, ref, accessToken);
    results.migration_123 = { ok: r.ok, method: "management_api", error: r.error };
  } else {
    const r = await execViaRpc(MIGRATION_123, supabaseUrl, serviceRoleKey);
    results.migration_123 = { ok: r.ok, method: "exec_sql_rpc", error: r.error };
  }

  const allOk = results.migration_122.ok && results.migration_123.ok;

  if (!allOk) {
    results._hint = [
      "Para aplicar manualmente en Supabase SQL Editor:",
      "1. supabase/migrations/122_fix_portales_constraint_completo.sql",
      "2. supabase/migrations/123_v_propiedades_mercado_normalizar.sql",
      "Para acceso automático: configurar SUPABASE_ACCESS_TOKEN (Personal Access Token de supabase.com/dashboard/account/tokens) en Vercel.",
    ].join(" | ");
  }

  return NextResponse.json({ ok: allOk, results });
}
