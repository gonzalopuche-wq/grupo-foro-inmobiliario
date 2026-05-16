import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getIp } from "../../../lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!rateLimit(`registro:${getIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados intentos. Esperá un momento e intentá de nuevo." }, { status: 429 });
  }
  const body = await req.json();
  const {
    email, password, tipo, nombre, apellido,
    matricula, padron_vacio,
    dni, celular_oficina, celular_personal, celular_mostrar,
    inmobiliaria, especialidades, corredor_matricula,
  } = body;

  if (!email || !password || !nombre || !apellido) {
    return NextResponse.json({ error: "Completá todos los campos obligatorios." }, { status: 400 });
  }
  if (tipo === "corredor" && !matricula) {
    return NextResponse.json({ error: "La matrícula es obligatoria para corredores." }, { status: 400 });
  }
  if (tipo === "colaborador" && !dni) {
    return NextResponse.json({ error: "El DNI es obligatorio para colaboradores." }, { status: 400 });
  }
  if (tipo === "colaborador" && !corredor_matricula) {
    return NextResponse.json({ error: "La matrícula del corredor es obligatoria para colaboradores." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Para colaboradores: verificar que existe el corredor
  let corredorId: string | null = null;
  if (tipo === "colaborador") {
    const matRaw = corredor_matricula.trim();
    const matNum = parseInt(matRaw.replace(/^0+/, "") || matRaw, 10);
    const { data: corredor } = await sb
      .from("perfiles")
      .select("id")
      .or(`matricula.eq.${matRaw},matricula.eq.${matNum}`)
      .eq("tipo", "corredor")
      .maybeSingle();
    if (!corredor) {
      return NextResponse.json({ error: `No se encontró un corredor con la matrícula ${matRaw}. Verificá el número con tu corredor.` }, { status: 404 });
    }
    corredorId = corredor.id;
  }

  // Crear usuario auth
  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    const msg = authError?.message ?? "Error al crear el usuario.";
    if (msg.includes("already been registered") || msg.includes("already exists")) {
      return NextResponse.json({ error: "Este email ya está registrado." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = authData.user.id;
  const telefonoPublico = celular_mostrar === "oficina"
    ? (celular_oficina || null)
    : (celular_personal || celular_oficina || null);

  // Insertar en perfiles
  const perfilPayload: Record<string, any> = {
    id: userId,
    tipo,
    estado: "pendiente",
    nombre,
    apellido,
    matricula: tipo === "corredor" ? matricula : null,
    padron_vacio: tipo === "corredor" ? (padron_vacio ?? false) : false,
    dni: tipo === "colaborador" ? dni : null,
    celular_oficina: celular_oficina || null,
    celular_personal: celular_personal || null,
    celular_mostrar: celular_mostrar ?? "personal",
    telefono: telefonoPublico,
    inmobiliaria: tipo === "corredor" ? (inmobiliaria || null) : null,
    especialidades: tipo === "colaborador" ? especialidades : null,
  };

  let { error: perfilError } = await sb.from("perfiles").insert(perfilPayload);

  // Si la columna padron_vacio no existe todavía (migración pendiente), reintentar sin ella
  if (perfilError?.message?.includes("padron_vacio")) {
    const { padron_vacio: _pv, ...payloadSinPadron } = perfilPayload;
    const { error: e2 } = await sb.from("perfiles").insert(payloadSinPadron);
    perfilError = e2;
  }

  if (perfilError) {
    await sb.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Error al guardar el perfil." }, { status: 500 });
  }

  // Para colaboradores: insertar en tabla colaboradores
  if (tipo === "colaborador" && corredorId) {
    const { error: colabError } = await sb.from("colaboradores").insert({
      corredor_id: corredorId,
      user_id: userId,
      nombre,
      apellido,
      email,
      dni: dni || null,
      rol: "colaborador",
      estado: "pendiente",
    });
    // Si falla (tabla no existe u otro error), no bloquear el registro
    if (colabError) {
      console.error("colaboradores insert error:", colabError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
