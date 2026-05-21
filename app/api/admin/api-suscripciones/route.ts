/**
 * Admin: gestión de suscripciones de API por usuario
 * GET  → lista todas las suscripciones + datos del perfil
 * POST → habilitar/deshabilitar + crear si no existe
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verificarAdmin(req: NextRequest): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return null;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (!p || !["admin", "master"].includes(p.tipo)) return null;
  return user.id;
}

export async function GET(req: NextRequest) {
  const adminId = await verificarAdmin(req);
  if (!adminId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Traer todos los perfiles con su suscripción (LEFT JOIN vía supabase)
  const { data: perfiles, error: errPerfiles } = await sb
    .from("perfiles")
    .select("id, nombre, apellido, email, tipo, matricula, inmobiliaria")
    .in("tipo", ["corredor", "admin", "master", "colaborador"])
    .order("apellido");

  if (errPerfiles) return NextResponse.json({ error: errPerfiles.message }, { status: 500 });

  const ids = (perfiles ?? []).map((p: { id: string }) => p.id);
  const { data: suscripciones } = await sb
    .from("gfi_api_suscripciones")
    .select("perfil_id, api_key, habilitada, habilitada_at, precio_mensual, notas")
    .in("perfil_id", ids);

  const susMap = new Map((suscripciones ?? []).map((s: { perfil_id: string }) => [s.perfil_id, s]));

  const resultado = (perfiles ?? []).map((p: { id: string; nombre: string; apellido: string; email: string; tipo: string; matricula: string | null; inmobiliaria: string | null }) => ({
    ...p,
    suscripcion: susMap.get(p.id) ?? null,
  }));

  return NextResponse.json({ ok: true, perfiles: resultado });
}

export async function POST(req: NextRequest) {
  const adminId = await verificarAdmin(req);
  if (!adminId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json() as {
    perfil_id: string;
    habilitada: boolean;
    notas?: string;
    precio_mensual?: number;
    regenerar_key?: boolean;
  };

  if (!body.perfil_id) return NextResponse.json({ error: "perfil_id requerido" }, { status: 400 });

  // Verificar si ya existe
  const { data: existente } = await sb
    .from("gfi_api_suscripciones")
    .select("id, api_key")
    .eq("perfil_id", body.perfil_id)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    perfil_id: body.perfil_id,
    habilitada: body.habilitada,
    updated_at: new Date().toISOString(),
  };
  if (body.habilitada && !existente?.id) {
    payload.habilitada_at = new Date().toISOString();
  } else if (body.habilitada && existente?.id) {
    payload.habilitada_at = new Date().toISOString();
  }
  if (body.notas !== undefined) payload.notas = body.notas;
  if (body.precio_mensual !== undefined) payload.precio_mensual = body.precio_mensual;

  let data: Record<string, unknown> | null;
  let error: { message: string } | null;

  if (existente?.id) {
    if (body.regenerar_key) {
      // Generar nueva key via función de DB no disponible directamente;
      // usamos update con valor generado del lado server
      const newKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
      payload.api_key = newKey;
    }
    ({ data, error } = await sb
      .from("gfi_api_suscripciones")
      .update(payload)
      .eq("id", existente.id)
      .select("perfil_id, api_key, habilitada, habilitada_at, precio_mensual")
      .single());
  } else {
    ({ data, error } = await sb
      .from("gfi_api_suscripciones")
      .insert(payload)
      .select("perfil_id, api_key, habilitada, habilitada_at, precio_mensual")
      .single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, suscripcion: data });
}
