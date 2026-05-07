import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { matricula } = await req.json();
  if (!matricula?.trim()) {
    return NextResponse.json({ error: "Ingresá tu número de matrícula." }, { status: 400 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const raw = matricula.trim();
  const sinCero = raw.replace(/^0+/, "") || raw;
  const num = parseInt(sinCero, 10);
  if (isNaN(num)) return NextResponse.json({ error: "La matrícula debe ser un número." }, { status: 400 });
  // Buscar por número (por si la columna es integer) y también por texto
  const candidatosTexto = Array.from(new Set([raw, sinCero, sinCero.padStart(3, "0"), sinCero.padStart(4, "0"), sinCero.padStart(5, "0")]));
  const [{ data: rowsNum }, { data: rowsTxt }] = await Promise.all([
    sb.from("cocir_padron").select("nombre, apellido, inmobiliaria, estado, matricula").eq("matricula", num),
    sb.from("cocir_padron").select("nombre, apellido, inmobiliaria, estado, matricula").in("matricula", candidatosTexto),
  ]);
  const data = (rowsNum?.[0] ?? rowsTxt?.[0]) ?? null;
  if (!data) return NextResponse.json({ error: "Matrícula no encontrada en el padrón COCIR. Verificá el número ingresado.", _debug: { num, candidatosTexto, rowsNum, rowsTxt } }, { status: 404 });
  const estado = (data.estado || "").toLowerCase();
  if (estado && estado !== "activo" && estado !== "habilitado") return NextResponse.json({ error: `Matrícula con estado: ${data.estado}. Solo se aceptan corredores habilitados.` }, { status: 403 });
  const { data: perfilExistente } = await sb.from("perfiles").select("id").eq("matricula", String(data.matricula)).maybeSingle();
  if (perfilExistente) return NextResponse.json({ error: "Esta matrícula ya tiene una cuenta registrada." }, { status: 409 });
  return NextResponse.json({ ok: true, nombre: data.nombre, apellido: data.apellido, inmobiliaria: data.inmobiliaria ?? "", matricula: data.matricula });
}
