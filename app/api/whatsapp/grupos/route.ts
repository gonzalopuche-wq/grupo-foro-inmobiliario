import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — listar grupos (cualquier corredor autenticado)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const soloActivos = searchParams.get("activos") !== "false";

  let query = sb.from("whatsapp_grupos").select("*").order("nombre");
  if (soloActivos) query = query.eq("activo", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Estadísticas de mensajes por grupo (últimos 30 días)
  const { data: stats } = await sb
    .from("whatsapp_mensajes")
    .select("grupo_gfi, procesado")
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

  const statsMap: Record<string, { total: number; procesados: number }> = {};
  for (const m of stats ?? []) {
    if (!statsMap[m.grupo_gfi]) statsMap[m.grupo_gfi] = { total: 0, procesados: 0 };
    statsMap[m.grupo_gfi].total++;
    if (m.procesado) statsMap[m.grupo_gfi].procesados++;
  }

  const grupos = (data ?? []).map((g) => ({
    ...g,
    mensajes_30d: statsMap[g.grupo_gfi]?.total ?? 0,
    procesados_30d: statsMap[g.grupo_gfi]?.procesados ?? 0,
  }));

  return NextResponse.json({ grupos });
}

// POST — crear/actualizar grupo (solo admin)
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const body = await req.json();
  const { id, nombre, grupo_gfi, descripcion, wa_link, miembros, activo } = body;

  if (!nombre || !grupo_gfi) {
    return NextResponse.json({ error: "nombre y grupo_gfi son requeridos" }, { status: 400 });
  }

  if (id) {
    // Update
    const { data, error } = await sb
      .from("whatsapp_grupos")
      .update({ nombre, grupo_gfi, descripcion, wa_link, miembros, activo })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ grupo: data });
  } else {
    // Insert
    const { data, error } = await sb
      .from("whatsapp_grupos")
      .insert({ nombre, grupo_gfi, descripcion, wa_link, miembros: miembros ?? 0, activo: activo ?? true })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ grupo: data });
  }
}

// DELETE — desactivar grupo (solo admin)
export async function DELETE(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { error } = await sb.from("whatsapp_grupos").update({ activo: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
