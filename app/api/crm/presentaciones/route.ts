import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — listar presentaciones del corredor autenticado
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  // Consulta pública por token (sin auth requerida, para la página /p/[token])
  if (token) {
    const { data } = await sb
      .from("crm_presentaciones")
      .select(`*, perfiles(nombre, apellido, foto_url, matricula, telefono, email, instagram, whatsapp_negocio, inmobiliaria)`)
      .eq("token", token)
      .eq("activa", true)
      .single();

    if (!data) return NextResponse.json({ error: "Presentación no encontrada" }, { status: 404 });

    // Incrementar vistas
    await sb.from("crm_presentaciones").update({ vistas: (data.vistas ?? 0) + 1 }).eq("token", token);

    // Cargar propiedades
    const props = (data.propiedades_ids ?? []) as string[];
    let propiedades: any[] = [];
    if (props.length > 0) {
      const { data: ps } = await sb
        .from("cartera_propiedades")
        .select("id, titulo, tipo_operacion, tipo_propiedad, precio, moneda, superficie_total, superficie_cubierta, dormitorios, banos, descripcion, fotos, direccion, barrio, localidad, expensas, garage, amenities")
        .in("id", props);
      propiedades = ps ?? [];
    }

    return NextResponse.json({ presentacion: data, propiedades });
  }

  const { data, error } = await sb
    .from("crm_presentaciones")
    .select("*")
    .eq("perfil_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presentaciones: data ?? [] });
}

// POST — crear presentación
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { titulo, mensaje, propiedades_ids, valid_until } = body;

  if (!titulo?.trim()) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
  if (!Array.isArray(propiedades_ids) || propiedades_ids.length === 0) {
    return NextResponse.json({ error: "Seleccioná al menos una propiedad" }, { status: 400 });
  }
  if (propiedades_ids.length > 15) {
    return NextResponse.json({ error: "Máximo 15 propiedades por presentación" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("crm_presentaciones")
    .insert({ perfil_id: user.id, titulo, mensaje, propiedades_ids, valid_until: valid_until || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presentacion: data });
}

// DELETE — desactivar presentación
export async function DELETE(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { error } = await sb
    .from("crm_presentaciones")
    .update({ activa: false })
    .eq("id", id)
    .eq("perfil_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
