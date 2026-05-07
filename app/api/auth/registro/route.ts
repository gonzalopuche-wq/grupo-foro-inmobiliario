// app/api/auth/registro/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, tipo, nombre, apellido, matricula, dni, celular_oficina, celular_personal, celular_mostrar, inmobiliaria, especialidades } = body;
  if (!email || !password || !nombre || !apellido) return NextResponse.json({ error: "Completá todos los campos obligatorios." }, { status: 400 });
  if (tipo === "corredor" && !matricula) return NextResponse.json({ error: "La matrícula es obligatoria para corredores." }, { status: 400 });
  if (tipo === "colaborador" && !dni) return NextResponse.json({ error: "El DNI es obligatorio para colaboradores." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: authData, error: authError } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError || !authData.user) {
    const msg = authError?.message ?? "Error al crear el usuario.";
    if (msg.includes("already been registered") || msg.includes("already exists")) return NextResponse.json({ error: "Este email ya está registrado." }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const userId = authData.user.id;
  const telefonoPublico = celular_mostrar === "oficina" ? (celular_oficina || null) : (celular_personal || celular_oficina || null);
  const { error: perfilError } = await sb.from("perfiles").insert({ id: userId, tipo, estado: "pendiente", nombre, apellido, matricula: tipo === "corredor" ? matricula : null, dni: tipo === "colaborador" ? dni : null, celular_oficina: celular_oficina || null, celular_personal: celular_personal || null, celular_mostrar: celular_mostrar ?? "personal", telefono: telefonoPublico, inmobiliaria: tipo === "corredor" ? (inmobiliaria || null) : null, especialidades: tipo === "colaborador" ? especialidades : null });
  if (perfilError) { await sb.auth.admin.deleteUser(userId); return NextResponse.json({ error: "Error al guardar el perfil." }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
