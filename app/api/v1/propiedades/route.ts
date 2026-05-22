/**
 * POST /api/v1/propiedades
 * Endpoint público para UrbixPro → GFI.
 * Autenticación: X-GFI-Key (SHA-256 hash comparado contra api_keys).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ApiKeyRow {
  id: string;
  perfil_id: string;
  scopes: string[];
  activa: boolean;
}

async function autenticar(req: NextRequest): Promise<{ perfilId: string; keyId: string; scopes: string[] } | { error: string; status: number }> {
  const rawKey = req.headers.get("x-gfi-key");
  if (!rawKey) return { error: "X-GFI-Key requerida", status: 401 };

  const hash = createHash("sha256").update(rawKey).digest("hex");

  const { data } = await sb
    .from("api_keys")
    .select("id, perfil_id, scopes, activa")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!data) return { error: "X-GFI-Key inválida o revocada", status: 401 };
  if (!data.activa) return { error: "X-GFI-Key inválida o revocada", status: 401 };

  return { perfilId: (data as ApiKeyRow).perfil_id, keyId: (data as ApiKeyRow).id, scopes: (data as ApiKeyRow).scopes };
}

async function logear(params: {
  keyId: string; perfilId: string; metodo: string; ruta: string;
  status: number; req: Record<string, unknown>; res: Record<string, unknown>;
  ip: string; ms: number;
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

const CAMPOS_REQUERIDOS = ["tipo", "operacion", "direccion", "precio", "moneda"] as const;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const auth = await autenticar(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { perfilId, keyId, scopes } = auth;

  if (!scopes.includes("propiedades:write")) {
    return NextResponse.json({ error: "key sin scope propiedades:write" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  for (const campo of CAMPOS_REQUERIDOS) {
    if (body[campo] === undefined || body[campo] === null || body[campo] === "") {
      const res = { error: "campo requerido faltante", campo };
      return NextResponse.json(res, { status: 400 });
    }
  }

  // Validar inmobiliariaId si viene (debe coincidir con el dueño de la key)
  if (body.inmobiliariaId && body.inmobiliariaId !== perfilId) {
    return NextResponse.json({ error: "inmobiliariaId no coincide con la key" }, { status: 403 });
  }

  const externalId = typeof body.externalId === "string" ? body.externalId : null;

  const payload: Record<string, unknown> = {
    perfil_id: perfilId,
    titulo:              body.titulo ?? body.direccion ?? null,
    tipo:                body.tipo,
    operacion:           body.operacion,
    direccion:           body.direccion,
    precio:              body.precio,
    moneda:              body.moneda,
    ambientes:           body.ambientes ?? null,
    dormitorios:         body.dormitorios ?? null,
    banos:               body.banos ?? null,
    superficie_total:    body.superficie_total ?? null,
    superficie_cubierta: body.superficie_cubierta ?? null,
    descripcion_privada: body.descripcion ?? null,
    fotos:               body.fotos ?? [],
    estado:              body.estado ?? "activa",
    zona:                body.zona ?? body.barrio ?? body.neighborhood ?? null,
    ciudad:              body.ciudad ?? body.city ?? null,
    latitud:             body.lat ?? null,
    longitud:            body.lng ?? null,
    origen:              "urbix",
    updated_at:          new Date().toISOString(),
  };
  if (externalId) payload.external_id = externalId;

  // Buscar existente por external_id + perfil_id
  let existenteId: string | null = null;
  if (externalId) {
    const { data: ex } = await sb
      .from("cartera_propiedades")
      .select("id")
      .eq("perfil_id", perfilId)
      .eq("external_id", externalId)
      .maybeSingle();
    existenteId = ex?.id ?? null;
  }

  let propId: string;
  if (existenteId) {
    const { error } = await sb
      .from("cartera_propiedades")
      .update(payload)
      .eq("id", existenteId)
      .eq("perfil_id", perfilId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    propId = existenteId;
  } else {
    const { data, error } = await sb
      .from("cartera_propiedades")
      .insert(payload)
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    propId = data.id;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const resBody = { id: propId, url: `${baseUrl}/propiedad/${propId}` };

  await logear({
    keyId, perfilId, metodo: "POST", ruta: "/api/v1/propiedades",
    status: 200, req: body, res: resBody, ip, ms: Date.now() - t0,
  });

  return NextResponse.json(resBody, { status: existenteId ? 200 : 201 });
}

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { perfilId } = auth;
  const params = req.nextUrl.searchParams;
  const limite = Math.min(parseInt(params.get("limit") ?? "200"), 500);

  const { data, error } = await sb
    .from("cartera_propiedades")
    .select("id, external_id, titulo, tipo, operacion, direccion, precio, moneda, ambientes, dormitorios, banos, superficie_total, superficie_cubierta, estado, origen, kiteprop_id, kiteprop_sync_at, updated_at")
    .eq("perfil_id", perfilId)
    .order("updated_at", { ascending: false })
    .limit(limite);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, total: data?.length ?? 0, propiedades: data ?? [] });
}
