import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MIGRATION_122 = `
ALTER TABLE propiedades_externas DROP CONSTRAINT IF EXISTS propiedades_externas_portal_check;
ALTER TABLE propiedades_externas ADD CONSTRAINT propiedades_externas_portal_check
  CHECK (portal IN (
    'mercadolibre', 'zonaprop', 'argenprop', 'properati',
    'gfi_red', 'gfi_portal', 'gfi',
    'kiteprop',
    'tokko',
    'propia', 'propia_red', 'propia_portal'
  ));
`.trim();

const MIGRATION_122_STEP1 = `ALTER TABLE propiedades_externas DROP CONSTRAINT IF EXISTS propiedades_externas_portal_check;`;
const MIGRATION_122_STEP2 = `ALTER TABLE propiedades_externas ADD CONSTRAINT propiedades_externas_portal_check CHECK (portal IN ('mercadolibre','zonaprop','argenprop','properati','gfi_red','gfi_portal','gfi','kiteprop','tokko','propia','propia_red','propia_portal'));`;

const MIGRATION_123 = `
DROP VIEW IF EXISTS v_propiedades_mercado;

CREATE VIEW v_propiedades_mercado AS
SELECT
  id::text AS id, 'gfi' AS fuente, 'gfi' AS red, titulo,
  LOWER(operacion) AS operacion, LOWER(tipo) AS tipo,
  precio, moneda, zona AS barrio, ciudad, 'Santa Fe'::text AS provincia,
  direccion, latitud AS lat, longitud AS lng,
  dormitorios, banos, NULL::integer AS ambientes,
  superficie_cubierta, NULL::numeric AS sup_terreno, NULL::numeric AS expensas,
  (CASE WHEN fotos IS NOT NULL AND array_length(fotos, 1) > 0 THEN fotos[1] ELSE NULL END) AS foto_principal,
  descripcion, '/crm/cartera/ficha/' || id::text AS url,
  perfil_id::text AS propietario_id, estado, updated_at
FROM cartera_propiedades
WHERE estado IN ('activa', 'reservada')
UNION ALL
SELECT
  id::text AS id, portal AS fuente, portal AS red, titulo,
  operacion, tipo, precio, moneda, barrio, ciudad, provincia,
  direccion, lat, lng, dormitorios, banos, ambientes,
  superficie_cubierta, NULL::numeric AS sup_terreno, NULL::numeric AS expensas,
  (CASE WHEN imagenes IS NOT NULL AND jsonb_array_length(imagenes) > 0 THEN imagenes ->> 0 ELSE NULL END) AS foto_principal,
  descripcion, url, NULL::text AS propietario_id, 'activa' AS estado, synced_at AS updated_at
FROM propiedades_externas
WHERE activa = true;

GRANT SELECT ON v_propiedades_mercado TO authenticated;
`.trim();

async function execViaManagementApi(sql: string, ref: string, accessToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
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

async function runSql(sql: string, ref: string, supabaseUrl: string, serviceRoleKey: string, accessToken: string | undefined): Promise<{ ok: boolean; method?: string; error?: string }> {
  // Try Management API first (most reliable for DDL)
  if (accessToken) {
    const r = await execViaManagementApi(sql, ref, accessToken);
    if (r.ok) return { ok: true, method: "management_api" };
  }

  // Fall back to exec_sql RPC (requires the function to exist in the DB)
  const r = await execViaRpc(sql, supabaseUrl, serviceRoleKey);
  if (r.ok) return { ok: true, method: "exec_sql_rpc" };
  return { ok: false, error: r.error };
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN; // optional — Supabase Management API PAT
  const ref = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

  const results: Record<string, any> = {};

  // Migration 122 — fix CHECK constraint (two statements needed)
  const r122a = await runSql(MIGRATION_122_STEP1, ref, supabaseUrl, serviceRoleKey, accessToken);
  if (r122a.ok) {
    const r122b = await runSql(MIGRATION_122_STEP2, ref, supabaseUrl, serviceRoleKey, accessToken);
    results.migration_122 = { ok: r122b.ok, method: r122b.method, error: r122b.error };
  } else {
    // Try as single block (some RPC implementations handle multi-statement)
    const rFull = await runSql(MIGRATION_122, ref, supabaseUrl, serviceRoleKey, accessToken);
    results.migration_122 = { ok: rFull.ok, method: rFull.method, error: rFull.error };
  }

  // Migration 123 — recreate view with LOWER(operacion/tipo)
  const r123 = await runSql(MIGRATION_123, ref, supabaseUrl, serviceRoleKey, accessToken);
  results.migration_123 = { ok: r123.ok, method: r123.method, error: r123.error };

  const allOk = results.migration_122.ok && results.migration_123.ok;

  if (!allOk) {
    results._hint = "Para aplicar manualmente: copiar el contenido de supabase/migrations/122_* y 123_* en el SQL Editor de Supabase Dashboard. O configurar SUPABASE_ACCESS_TOKEN (Personal Access Token de supabase.com/dashboard/account/tokens) en las variables de entorno de Vercel.";
  }

  return NextResponse.json({ ok: allOk, results });
}
