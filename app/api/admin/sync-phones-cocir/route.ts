import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return false;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  return p?.tipo === "admin" || p?.tipo === "master";
}

// POST → sincroniza teléfonos (y opcionalmente email/inmobiliaria) desde cocir_padron → perfiles
// Body: { campos?: string[] } → default: ["telefono"]
// Solo actualiza perfiles donde el campo de destino está vacío (null/empty), salvo ?forzar=true
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const forzar = req.nextUrl.searchParams.get("forzar") === "true";
  const body = await req.json().catch(() => ({}));
  const campos: string[] = (body.campos ?? ["telefono"]).filter((c: string) =>
    ["telefono", "celular", "email", "inmobiliaria"].includes(c)
  );

  if (campos.length === 0) {
    return NextResponse.json({ error: "Especificá al menos un campo válido: telefono, email, inmobiliaria." }, { status: 400 });
  }

  // Cargar todos los perfiles con matrícula
  const { data: perfiles, error: ep } = await sb
    .from("perfiles")
    .select(`id, matricula, telefono, celular_oficina, email, inmobiliaria`)
    .not("matricula", "is", null);

  if (ep) return NextResponse.json({ error: ep.message }, { status: 500 });
  if (!perfiles || perfiles.length === 0) {
    return NextResponse.json({ actualizados: 0, omitidos: 0, errores: 0, detalle: "No hay perfiles con matrícula." });
  }

  // Cargar todo el padron
  let padron: any[] = [];
  let desde = 0;
  while (true) {
    const { data, error } = await sb
      .from("cocir_padron")
      .select("matricula, telefono, celular, email, inmobiliaria")
      .range(desde, desde + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    padron = padron.concat(data);
    if (data.length < 1000) break;
    desde += 1000;
  }

  // Indexar padron por matrícula normalizada
  const padronIdx = new Map<string, any>();
  for (const r of padron) {
    if (r.matricula != null) {
      const key = String(r.matricula).trim().replace(/^0+/, "") || String(r.matricula).trim();
      padronIdx.set(key, r);
    }
  }

  let actualizados = 0;
  let omitidos = 0;
  let errores = 0;
  const detalleActualizados: { id: string; matricula: string; cambios: Record<string, string> }[] = [];

  for (const perfil of perfiles) {
    const mat = String(perfil.matricula).trim();
    const matNorm = mat.replace(/^0+/, "") || mat;
    const cocir = padronIdx.get(matNorm) ?? padronIdx.get(mat) ?? null;

    if (!cocir) { omitidos++; continue; }

    const update: Record<string, string | null> = {};
    const cambios: Record<string, string> = {};

    for (const campo of campos) {
      // celular en cocir_padron → celular_oficina en perfiles
      const campoPerfil = campo === "celular" ? "celular_oficina" : campo;
      const valorCocir: string | null = cocir[campo] ?? null;
      const valorPerfil: string | null = (perfil as any)[campoPerfil] ?? null;
      if (!valorCocir) continue;
      if (!forzar && valorPerfil) continue;
      if (valorCocir === valorPerfil) continue;
      update[campoPerfil] = valorCocir;
      cambios[campo] = valorCocir;
    }

    if (Object.keys(update).length === 0) { omitidos++; continue; }

    const { error } = await sb.from("perfiles").update(update).eq("id", perfil.id);
    if (error) { errores++; continue; }

    actualizados++;
    detalleActualizados.push({ id: perfil.id, matricula: mat, cambios });
  }

  return NextResponse.json({
    actualizados,
    omitidos,
    errores,
    total_perfiles: perfiles.length,
    total_padron: padron.length,
    detalle: detalleActualizados.slice(0, 50),
  });
}
