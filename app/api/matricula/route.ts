import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { matricula } = await req.json();
  if (!matricula?.trim()) {
    return NextResponse.json({ error: "Ingresá tu número de matrícula." }, { status: 400 });
  }

  const raw = matricula.trim();
  const sinCero = raw.replace(/^0+/, "") || raw;
  const num = parseInt(sinCero, 10);
  if (isNaN(num)) return NextResponse.json({ error: "La matrícula debe ser un número." }, { status: 400 });

  // Carga todo el padrón y filtra en JS (mismo patrón que padron/route.ts)
  let todos: any[] = [];
  let desde = 0;
  while (true) {
    const { data, error } = await sbAdmin
      .from("cocir_padron")
      .select("nombre, apellido, inmobiliaria, estado, matricula")
      .range(desde, desde + 999);
    if (error) return NextResponse.json({ error: `DB error: ${error.message}` }, { status: 500 });
    if (!data || data.length === 0) break;
    todos = todos.concat(data);
    if (data.length < 1000) break;
    desde += 1000;
  }

  const data = todos.find(r =>
    String(r.matricula) === raw ||
    String(r.matricula) === sinCero ||
    Number(r.matricula) === num
  ) ?? null;

  if (!data) {
    return NextResponse.json({
      error: "Matrícula no encontrada en el padrón COCIR. Verificá el número ingresado.",
      _debug: { raw, sinCero, num, total: todos.length, muestra: todos.slice(0, 3).map(r => r.matricula) }
    }, { status: 404 });
  }

  const estado = String(data.estado || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const estadosValidos = [
  "activo",
  "habilitado",
  "vigente"
];

const esValido = estadosValidos.some(e => estado.includes(e));

if (!esValido) {
  return NextResponse.json({
    error: `Matrícula con estado: ${data.estado}. Solo se aceptan corredores habilitados.`,
  }, { status: 403 });
}

  const { data: perfilExistente } = await sbAdmin.from("perfiles").select("id").eq("matricula", String(data.matricula)).maybeSingle();
  if (perfilExistente) return NextResponse.json({ error: "Esta matrícula ya tiene una cuenta registrada." }, { status: 409 });

  return NextResponse.json({ ok: true, nombre: data.nombre, apellido: data.apellido, inmobiliaria: data.inmobiliaria ?? "", matricula: data.matricula });
}
