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
  const candidatos = Array.from(new Set([raw, sinCero]));
  const { data: rows } = await sb.from("cocir_padron").select("nombre, apellido, inmobiliaria, estado, matricula").in("matricula", candidatos);
  const data = rows?.[0] ?? null;
  if (!data) return NextResponse.json({ error: "Matrícula no encontrada en el padrón COCIR. Verificá el número ingresado." }, { status: 404 });
  const estado = (data.estado || "").toLowerCase();
  if (estado && estado !== "activo" && estado !== "habilitado") return NextResponse.json({ error: `Matrícula con estado: ${data.estado}. Solo se aceptan corredores habilitados.` }, { status: 403 });
  const { data: perfilExistente } = await sb.from("perfiles").select("id").in("matricula", candidatos).maybeSingle();
  if (perfilExistente) return NextResponse.json({ error: "Esta matrícula ya tiene una cuenta registrada." }, { status: 409 });
  return NextResponse.json({ ok: true, nombre: data.nombre, apellido: data.apellido, inmobiliaria: data.inmobiliaria ?? "", matricula: data.matricula });
}
