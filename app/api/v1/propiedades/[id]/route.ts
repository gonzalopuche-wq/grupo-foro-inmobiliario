/**
 * PUT  /api/v1/propiedades/:id  → actualiza por id GFI
 * DELETE /api/v1/propiedades/:id → soft-delete (estado='retirada')
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function autenticar(req: NextRequest): Promise<{ perfilId: string; keyId: string; scopes: string[] } | { error: string; status: number }> {
  const rawKey = req.headers.get("x-gfi-key");
  if (!rawKey) return { error: "X-GFI-Key requerida", status: 401 };
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const { data } = await sb.from("api_keys").select("id, perfil_id, scopes, activa").eq("key_hash", hash).maybeSingle();
  if (!data || !(data as { activa: boolean }).activa) return { error: "X-GFI-Key inválida o revocada", status: 401 };
  return { perfilId: (data as { perfil_id: string }).perfil_id, keyId: (data as { id: string }).id, scopes: (data as { scopes: string[] }).scopes };
}

async function logear(params: {
  keyId: string; perfilId: string; metodo: string; ruta: string;
  status: number; req: Record<string, unknown>; res: Record<string, unknown>; ip: string; ms: number;
}) {
  await Promise.all([
    sb.from("api_logs").insert({
      api_key_id: params.keyId, perfil_id: params.perfilId,
      metodo: params.metodo, ruta: params.ruta, http_status: params.status,
      body_req: params.req, body_res: params.res, ip: params.ip, duracion_ms: params.ms,
    }),
    sb.rpc("incrementar_uso_api_key", { p_key_id: params.keyId }),
  ]);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t0 = Date.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { id: propId } = await params;

  const auth = await autenticar(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { perfilId, keyId, scopes } = auth;

  if (!scopes.includes("propiedades:write")) {
    return NextResponse.json({ error: "key sin scope propiedades:write" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  // Verificar que la propiedad pertenece al dueño de la key
  const { data: existente } = await sb
    .from("cartera_propiedades")
    .select("id")
    .eq("id", propId)
    .eq("perfil_id", perfilId)
    .maybeSingle();

  if (!existente) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const MAP: Record<string, string> = {
    titulo: "titulo", tipo: "tipo", operacion: "operacion", direccion: "direccion",
    precio: "precio", moneda: "moneda", ambientes: "ambientes",
    dormitorios: "dormitorios", banos: "banos",
    superficie_total: "superficie_total", superficie_cubierta: "superficie_cubierta",
    descripcion: "descripcion_privada", fotos: "fotos", estado: "estado",
    zona: "zona", barrio: "zona", ciudad: "ciudad",
  };
  for (const [src, dst] of Object.entries(MAP)) {
    if (src in body) payload[dst] = body[src];
  }
  if ("lat" in body) payload.latitud = body.lat;
  if ("lng" in body) payload.longitud = body.lng;

  const { error } = await sb
    .from("cartera_propiedades")
    .update(payload)
    .eq("id", propId)
    .eq("perfil_id", perfilId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const resBody = { id: propId, url: `${baseUrl}/propiedad/${propId}` };

  await logear({ keyId, perfilId, metodo: "PUT", ruta: `/api/v1/propiedades/${propId}`, status: 200, req: body, res: resBody, ip, ms: Date.now() - t0 });
  return NextResponse.json(resBody);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t0 = Date.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { id: propId } = await params;

  const auth = await autenticar(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { perfilId, keyId, scopes } = auth;

  if (!scopes.includes("propiedades:write")) {
    return NextResponse.json({ error: "key sin scope propiedades:write" }, { status: 403 });
  }

  const { data: existente } = await sb
    .from("cartera_propiedades")
    .select("id")
    .eq("id", propId)
    .eq("perfil_id", perfilId)
    .maybeSingle();

  if (!existente) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

  const { error } = await sb
    .from("cartera_propiedades")
    .update({ estado: "retirada", updated_at: new Date().toISOString() })
    .eq("id", propId)
    .eq("perfil_id", perfilId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logear({ keyId, perfilId, metodo: "DELETE", ruta: `/api/v1/propiedades/${propId}`, status: 204, req: {}, res: {}, ip, ms: Date.now() - t0 });
  return new NextResponse(null, { status: 204 });
}
