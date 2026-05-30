// Llama reparar_constraint_portales() via rpc — solo admin/master
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (!perfil || !["admin", "master"].includes(perfil.tipo)) {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  // Intentar reparar via función PG (migration 120)
  const { data: rpcResult, error: rpcErr } = await sb.rpc("reparar_constraint_portales" as any);

  if (rpcErr) {
    // Función no existe aún — devolver el SQL que hay que ejecutar
    const sqlFix = `ALTER TABLE propiedades_externas DROP CONSTRAINT IF EXISTS propiedades_externas_portal_check;
ALTER TABLE propiedades_externas ADD CONSTRAINT propiedades_externas_portal_check
  CHECK (portal IN (
    'mercadolibre','zonaprop','argenprop','properati',
    'gfi_red','gfi_portal',
    'kiteprop','tokko',
    'propia_red','propia_portal'
  ));`;
    return NextResponse.json({
      ok: false,
      metodo: "manual",
      error: rpcErr.message,
      accion: "Ejecutar el siguiente SQL en Supabase → SQL Editor",
      sql: sqlFix,
    });
  }

  return NextResponse.json({ ok: true, metodo: "automatico", resultado: rpcResult });
}
