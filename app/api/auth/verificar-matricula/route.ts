// app/api/auth/verificar-matricula/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { matricula } = await req.json();
  if (!matricula?.trim()) {
    return NextResponse.json({ error: "Ingresá tu número de matrícula." }, { status: 400 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb.from("cocir_padron").select("nombre, apellido, inmobiliaria, estado").eq("matricula", matricula.trim()).single();
  if (error || !data) return NextResponse.json({ error: "Matrícula no encontrada en el padrón COCIR. Verificá el número ingresado." }, { status: 404 });
  const estado = (data.estado || "").toLowerCase();
  if (estado && estado !== "activo" && estado !== "habilitado") return NextResponse.json({ error: `Matrícula encontrada pero con estado: ${data.estado}. Solo se aceptan corredores habilitados.` }, { status: 403 });
  const { data: perfilExistente } = await sb.from("perfiles").select("id").eq("matricula", matricula.trim()).maybeSingle();
  if (perfilExistente) return NextResponse.json({ error: "Esta matrícula ya tiene una cuenta registrada. Si es tuya, ingresá con tu email." }, { status: 409 });
  return NextResponse.json({ ok: true, nombre: data.nombre, apellido: data.apellido, inmobiliaria: data.inmobiliaria ?? "" });
}
