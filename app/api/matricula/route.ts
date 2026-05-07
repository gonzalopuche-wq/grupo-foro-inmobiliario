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

  // Fetch directo a Supabase REST API (evita cliente JS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const [r1, r2] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/cocir_padron?matricula=eq.${num}&select=nombre,apellido,inmobiliaria,estado,matricula&limit=1`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/cocir_padron?matricula=eq.${encodeURIComponent(raw)}&select=nombre,apellido,inmobiliaria,estado,matricula&limit=1`, { headers }),
  ]);
  const [rowsNum, rowsTxt] = await Promise.all([r1.json(), r2.json()]);
  const data = rowsNum?.[0] ?? rowsTxt?.[0] ?? null;

  if (!data) {
    const rSample = await fetch(`${supabaseUrl}/rest/v1/cocir_padron?select=matricula&limit=3`, { headers });
    const sample = await rSample.json();
    return NextResponse.json({ error: "Matrícula no encontrada.", _debug: { raw, num, rowsNum, rowsTxt, sample } }, { status: 404 });
  }

  const estado = (data.estado || "").toLowerCase();
  if (estado && estado !== "activo" && estado !== "habilitado") {
    return NextResponse.json({ error: `Matrícula con estado: ${data.estado}. Solo se aceptan corredores habilitados.` }, { status: 403 });
  }

  const { data: perfilExistente } = await sbAdmin.from("perfiles").select("id").eq("matricula", String(data.matricula)).maybeSingle();
  if (perfilExistente) return NextResponse.json({ error: "Esta matrícula ya tiene una cuenta registrada." }, { status: 409 });

  return NextResponse.json({ ok: true, nombre: data.nombre, apellido: data.apellido, inmobiliaria: data.inmobiliaria ?? "", matricula: data.matricula });
}
