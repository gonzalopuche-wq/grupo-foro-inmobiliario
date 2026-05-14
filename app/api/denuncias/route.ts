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

  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo"); // "mis" | admin sin param

  if (tipo === "mis") {
    const { data, error } = await sb
      .from("denuncias")
      .select("*")
      .eq("denunciante_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ denuncias: data ?? [] });
  }

  // Solo admin puede ver todas
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (p?.tipo !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const estado = url.searchParams.get("estado") ?? "pendiente";
  let q = sb.from("denuncias").select("*, perfiles!denuncias_denunciante_id_fkey(nombre, apellido)");
  if (estado !== "todas") q = q.eq("estado", estado);
  q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ denuncias: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { tipo_contenido, contenido_id, motivo, descripcion } = await req.json();

  if (!tipo_contenido || !contenido_id || !motivo) {
    return NextResponse.json({ error: "tipo_contenido, contenido_id y motivo son requeridos" }, { status: 400 });
  }

  const { error } = await sb.from("denuncias").insert({
    denunciante_id: user.id,
    tipo_contenido,
    contenido_id,
    motivo,
    descripcion: descripcion || null,
    estado: "pendiente",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (p?.tipo !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id, estado, resolucion_notas, accion_tomada } = await req.json();
  if (!id || !estado) return NextResponse.json({ error: "id y estado requeridos" }, { status: 400 });

  const { error } = await sb.from("denuncias").update({
    estado,
    resolucion_notas: resolucion_notas ?? null,
    accion_tomada: accion_tomada ?? null,
    revisado_por: user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
