import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — listar ofertas/búsquedas (autenticado)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo"); // oferta | busqueda | null (todos)
  const soloActivas = searchParams.get("activas") !== "false";

  let q = sb
    .from("bolsa_trabajo_ofertas")
    .select(`*, perfiles(nombre, apellido, foto_url, matricula)`)
    .order("destacado", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (tipo) q = q.eq("tipo", tipo);
  if (soloActivas) q = q.eq("activo", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ofertas: data ?? [] });
}

// POST — publicar oferta/búsqueda (corredor autenticado)
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { id, tipo, titulo, descripcion, zona, tipo_contrato, remuneracion, requisitos, contacto_email, contacto_tel, activo } = body;

  if (!tipo || !titulo || !descripcion) {
    return NextResponse.json({ error: "tipo, titulo y descripcion son requeridos" }, { status: 400 });
  }

  if (id) {
    // Verificar ownership
    const { data: existing } = await sb.from("bolsa_trabajo_ofertas").select("perfil_id").eq("id", id).single();
    const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
    if (existing?.perfil_id !== user.id && perfil?.tipo !== "admin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    const { data, error } = await sb
      .from("bolsa_trabajo_ofertas")
      .update({ tipo, titulo, descripcion, zona, tipo_contrato, remuneracion, requisitos, contacto_email, contacto_tel, activo, updated_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ oferta: data });
  }

  const { data, error } = await sb
    .from("bolsa_trabajo_ofertas")
    .insert({ perfil_id: user.id, tipo, titulo, descripcion, zona, tipo_contrato, remuneracion, requisitos, contacto_email, contacto_tel })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ oferta: data });
}

// DELETE — desactivar propia oferta
export async function DELETE(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { data: existing } = await sb.from("bolsa_trabajo_ofertas").select("perfil_id").eq("id", id).single();
  const { data: perfil } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (existing?.perfil_id !== user.id && perfil?.tipo !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { error } = await sb.from("bolsa_trabajo_ofertas").update({ activo: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
