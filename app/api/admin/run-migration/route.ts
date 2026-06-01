import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
`;

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
`;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Record<string, any> = {};

  // Migration 122 — fix CHECK constraint
  try {
    const { error } = await sb.rpc("exec_sql", { sql: MIGRATION_122 });
    if (error) {
      // Try individual statements via pg query
      const r1 = await sb.rpc("exec_sql", { sql: "ALTER TABLE propiedades_externas DROP CONSTRAINT IF EXISTS propiedades_externas_portal_check;" });
      const r2 = await sb.rpc("exec_sql", { sql: `ALTER TABLE propiedades_externas ADD CONSTRAINT propiedades_externas_portal_check CHECK (portal IN ('mercadolibre','zonaprop','argenprop','properati','gfi_red','gfi_portal','gfi','kiteprop','tokko','propia','propia_red','propia_portal'));` });
      results.migration_122 = { ok: !r1.error && !r2.error, error: r1.error?.message ?? r2.error?.message };
    } else {
      results.migration_122 = { ok: true };
    }
  } catch (e: any) {
    results.migration_122 = { ok: false, error: e?.message };
  }

  // Migration 123 — update view
  try {
    const { error } = await sb.rpc("exec_sql", { sql: MIGRATION_123 });
    results.migration_123 = { ok: !error, error: error?.message };
  } catch (e: any) {
    results.migration_123 = { ok: false, error: e?.message };
  }

  return NextResponse.json({ results });
}
