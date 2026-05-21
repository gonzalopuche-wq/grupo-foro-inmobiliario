/**
 * Admin: gestión de api_keys por perfil.
 * GET    ?perfil_id=   → lista keys activas e inactivas del usuario
 * POST   crear key     → genera gfi_ + base64url(32), guarda SHA-256
 * DELETE ?key_id=      → revoca key (activa = false)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return null;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  return { id: user.id, tipo: p?.tipo ?? "corredor" };
}

export async function GET(req: NextRequest) {
  const u = await getUser(req);
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const perfilIdParam = req.nextUrl.searchParams.get("perfil_id");
  // Admins pueden ver cualquier perfil; el resto solo el suyo
  const perfilId = ["admin","master"].includes(u.tipo) && perfilIdParam ? perfilIdParam : u.id;

  const { data, error } = await sb
    .from("api_keys")
    .select("id, nombre, prefijo, scopes, activa, ultimo_uso, cant_usos, created_at")
    .eq("perfil_id", perfilId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, keys: data ?? [] });
}

export async function POST(req: NextRequest) {
  const u = await getUser(req);
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json() as { nombre?: string; perfil_id?: string; scopes?: string[] };
  if (!body.nombre?.trim()) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });

  // Admins pueden crear para otros perfiles
  const perfilId = ["admin","master"].includes(u.tipo) && body.perfil_id ? body.perfil_id : u.id;

  // Generar key: "gfi_" + base64url(32 bytes) — mostrar UNA sola vez
  const raw = randomBytes(32);
  const plainKey = "gfi_" + raw.toString("base64url");
  const hash = createHash("sha256").update(plainKey).digest("hex");
  const prefijo = plainKey.slice(0, 12); // "gfi_" + 8 chars

  const { data, error } = await sb
    .from("api_keys")
    .insert({
      perfil_id: perfilId,
      nombre: body.nombre.trim(),
      key_hash: hash,
      prefijo,
      scopes: body.scopes ?? ["propiedades:write"],
      creada_por: u.id,
    })
    .select("id, nombre, prefijo, scopes, activa, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Devolver plainKey UNA SOLA VEZ — no se puede recuperar después
  return NextResponse.json({ ok: true, key: plainKey, keyData: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const u = await getUser(req);
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const keyId = req.nextUrl.searchParams.get("key_id");
  if (!keyId) return NextResponse.json({ error: "key_id requerido" }, { status: 400 });

  // Verificar que la key pertenece al usuario (o que es admin)
  const { data: k } = await sb.from("api_keys").select("perfil_id").eq("id", keyId).maybeSingle();
  if (!k) return NextResponse.json({ error: "Key no encontrada" }, { status: 404 });
  if (!["admin","master"].includes(u.tipo) && k.perfil_id !== u.id) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { error } = await sb.from("api_keys").update({ activa: false }).eq("id", keyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
