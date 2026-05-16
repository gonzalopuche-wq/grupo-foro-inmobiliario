import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function authUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sbAdmin.auth.getUser(token);
  return user ?? null;
}

// GET → devuelve los datos COCIR del usuario autenticado según su matrícula
export async function GET(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: perfil } = await sbAdmin
    .from("perfiles")
    .select("matricula, telefono, email, inmobiliaria")
    .eq("id", user.id)
    .single();

  if (!perfil?.matricula) {
    return NextResponse.json({ error: "Tu perfil no tiene matrícula registrada." }, { status: 400 });
  }

  const mat = perfil.matricula.trim();
  const num = parseInt(mat.replace(/^0+/, "") || mat, 10);

  // Buscar en padron por coincidencia exacta o numérica
  const { data: registros } = await sbAdmin
    .from("cocir_padron")
    .select("matricula, nombre, apellido, telefono, email, inmobiliaria, direccion, localidad, estado")
    .or(`matricula.eq.${mat},matricula.eq.${isNaN(num) ? mat : num}`)
    .limit(5);

  const cocir = (registros ?? []).find(r =>
    String(r.matricula) === mat ||
    Number(r.matricula) === num
  ) ?? null;

  if (!cocir) {
    return NextResponse.json({ error: "Matrícula no encontrada en el padrón COCIR." }, { status: 404 });
  }

  return NextResponse.json({
    cocir: {
      telefono: cocir.telefono ?? null,
      email: cocir.email ?? null,
      inmobiliaria: cocir.inmobiliaria ?? null,
      direccion: cocir.direccion ?? null,
      localidad: cocir.localidad ?? null,
      estado: cocir.estado ?? null,
    },
    perfil: {
      telefono: perfil.telefono ?? null,
      email: perfil.email ?? null,
      inmobiliaria: perfil.inmobiliaria ?? null,
    },
  });
}

// POST → aplica los datos COCIR al perfil del usuario autenticado
export async function POST(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const campos: Record<string, string | null> = {};

  if (body.telefono !== undefined) campos.telefono = body.telefono;
  if (body.email !== undefined) campos.email = body.email;
  if (body.inmobiliaria !== undefined) campos.inmobiliaria = body.inmobiliaria;

  if (Object.keys(campos).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar." }, { status: 400 });
  }

  const { error } = await sbAdmin.from("perfiles").update(campos).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, actualizados: Object.keys(campos) });
}
