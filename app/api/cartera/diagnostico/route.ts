import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verificar usuario
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Contar todas las filas del usuario (bypasa RLS)
  const { data: filas, error: errFilas } = await supabaseAdmin
    .from("cartera_propiedades")
    .select("id, titulo, perfil_id, created_at")
    .eq("perfil_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Contar total sin filtro de perfil_id (para ver si hay datos de otros)
  const { count: totalTabla } = await supabaseAdmin
    .from("cartera_propiedades")
    .select("id", { count: "exact", head: true });

  // Verificar si RLS está habilitado en cartera_propiedades
  const { data: rls } = await supabaseAdmin
    .rpc("pg_catalog.has_table_privilege", { table_name: "cartera_propiedades", privilege: "SELECT" })
    .maybeSingle()
    .catch(() => ({ data: null }));

  return NextResponse.json({
    auth_uid: user.id,
    filas_del_usuario: filas ?? [],
    cantidad_usuario: (filas ?? []).length,
    total_en_tabla: totalTabla,
    error_filas: errFilas?.message ?? null,
  });
}
