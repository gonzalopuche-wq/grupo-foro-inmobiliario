import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Extrae el project ref de la URL de Supabase (https://xxx.supabase.co → xxx)
function getProjectRef(url: string): string {
  return url.replace("https://", "").split(".")[0];
}

async function runSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const ref = getProjectRef(url);

  // Intento 1: Management API (requiere service_role como bearer)
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) return { ok: true };
    const txt = await res.text();
    // Si falla por auth (401/403), intentamos otro método
    if (res.status !== 401 && res.status !== 403) {
      return { ok: false, error: `mgmt_api: ${res.status} ${txt}` };
    }
  } catch (e: any) {
    // continuar al siguiente intento
  }

  // Intento 2: RPC exec_sql (si existe en la base)
  const { error: rpcErr } = await sb.rpc("exec_sql", { query: sql });
  if (!rpcErr) return { ok: true };

  // Intento 3: RPC run_sql (alias común)
  const { error: rpcErr2 } = await sb.rpc("run_sql", { sql });
  if (!rpcErr2) return { ok: true };

  return { ok: false, error: `exec_sql: ${rpcErr?.message} | run_sql: ${rpcErr2?.message}` };
}

export async function GET() {
  const log: Record<string, string> = {};

  // Paso 1: Crear tabla colaboradores
  const r1 = await runSQL(`
    CREATE TABLE IF NOT EXISTS colaboradores (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      corredor_id uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      nombre text NOT NULL,
      apellido text NOT NULL,
      email text NOT NULL,
      telefono text,
      dni text,
      rol text NOT NULL DEFAULT 'colaborador',
      estado text NOT NULL DEFAULT 'pendiente',
      notas text,
      activado_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  log.crear_tabla_colaboradores = r1.ok ? "✓" : r1.error!;

  // Paso 2: Agregar user_id si falta
  const r2 = await runSQL(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name='colaboradores' AND column_name='user_id')
      THEN ALTER TABLE colaboradores ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
      END IF;
    END $$
  `);
  log.add_col_user_id = r2.ok ? "✓" : r2.error!;

  // Paso 3: Agregar padron_vacio a perfiles
  const r3 = await runSQL(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name='perfiles' AND column_name='padron_vacio')
      THEN ALTER TABLE perfiles ADD COLUMN padron_vacio boolean DEFAULT false;
      END IF;
    END $$
  `);
  log.add_col_padron_vacio = r3.ok ? "✓" : r3.error!;

  // Verificar qué existe ahora
  const { data: tablas } = await sb
    .from("information_schema.tables" as any)
    .select("table_name")
    .eq("table_schema", "public")
    .in("table_name", ["colaboradores", "perfiles"]);
  log.tablas_verificadas = JSON.stringify(tablas?.map((t: any) => t.table_name));

  const allOk = r1.ok && r2.ok && r3.ok;
  return NextResponse.json({ ok: allOk, log });
}
