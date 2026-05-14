import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [{ data: cursos }, { data: inscripciones }] = await Promise.all([
    sb.from("cursos").select("*").order("destacado", { ascending: false }).order("created_at", { ascending: false }),
    sb.from("curso_inscripciones").select("curso_id, estado, progreso").eq("perfil_id", user.id),
  ]);

  const { count: totalCursos } = await sb.from("curso_inscripciones").select("curso_id", { count: "exact", head: true });

  const insMap: Record<string, { estado: string; progreso: number }> = {};
  inscripciones?.forEach(i => { insMap[i.curso_id] = { estado: i.estado, progreso: i.progreso }; });

  return NextResponse.json({
    cursos: (cursos ?? []).map(c => ({ ...c, mi_inscripcion: insMap[c.id] ?? null })),
  });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "inscribir") {
    const { curso_id } = body;
    if (!curso_id) return NextResponse.json({ error: "curso_id requerido" }, { status: 400 });
    const { data, error } = await sb.from("curso_inscripciones").upsert({
      curso_id, perfil_id: user.id, estado: "inscripto", progreso: 0,
    }, { onConflict: "curso_id,perfil_id" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inscripcion: data });
  }

  if (action === "desinscribir") {
    const { curso_id } = body;
    await sb.from("curso_inscripciones").delete().eq("curso_id", curso_id).eq("perfil_id", user.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "progreso") {
    const { curso_id, progreso } = body;
    const nuevoEstado = progreso >= 100 ? "completado" : "inscripto";
    await sb.from("curso_inscripciones")
      .update({ progreso, estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq("curso_id", curso_id).eq("perfil_id", user.id);
    return NextResponse.json({ ok: true });
  }

  // Admin: crear curso
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (p?.tipo !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { titulo, descripcion, instructor, categoria, nivel, duracion_horas, modalidad, link_acceso,
    imagen_url, precio, moneda, gratuito, max_inscriptos, fecha_inicio, fecha_fin, destacado } = body;

  if (!titulo) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });

  const { data, error } = await sb.from("cursos").insert({
    titulo, descripcion, instructor, categoria: categoria ?? "general", nivel: nivel ?? "basico",
    duracion_horas: duracion_horas ? parseFloat(duracion_horas) : null,
    modalidad: modalidad ?? "online", link_acceso, imagen_url,
    precio: precio ? parseFloat(precio) : 0,
    moneda: moneda ?? "ARS", gratuito: gratuito ?? true,
    max_inscriptos: max_inscriptos ? parseInt(max_inscriptos) : null,
    fecha_inicio: fecha_inicio || null, fecha_fin: fecha_fin || null,
    destacado: destacado ?? false, created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ curso: data });
}

export async function DELETE(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (p?.tipo !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id } = await req.json();
  await sb.from("cursos").update({ activo: false }).eq("id", id);
  return NextResponse.json({ ok: true });
}
