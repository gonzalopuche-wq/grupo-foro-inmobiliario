/**
 * API pública GFI — /api/v1/propiedades
 * Autenticación: X-GFI-Key: <api_key>
 *
 * GET  → lista propiedades del usuario dueño de la key
 * POST → crea o actualiza una propiedad (upsert por "codigo_externo")
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resolverPerfil(req: NextRequest): Promise<{ perfil_id: string } | null> {
  const key = req.headers.get("x-gfi-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!key) return null;

  const { data } = await sb
    .from("gfi_api_suscripciones")
    .select("perfil_id, habilitada")
    .eq("api_key", key)
    .single();

  if (!data || !data.habilitada) return null;
  return { perfil_id: data.perfil_id };
}

export async function GET(req: NextRequest) {
  const perfil = await resolverPerfil(req);
  if (!perfil) {
    return NextResponse.json({ error: "API key inválida o sin acceso habilitado" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const limite = Math.min(parseInt(params.get("limit") ?? "200"), 500);
  const operacion = params.get("operacion");
  const tipo = params.get("tipo");

  let query = sb
    .from("cartera_propiedades")
    .select(
      "id, codigo, titulo, tipo, operacion, precio, moneda, descripcion_privada, " +
      "direccion, zona, ciudad, codigo_postal, latitud, longitud, " +
      "dormitorios, banos, ambientes, superficie_cubierta, superficie_total, sup_terreno, " +
      "estado, fotos, video_url, tour_virtual_url, " +
      "apto_credito, con_cochera, amoblado, acepta_permuta, acepta_mascotas, " +
      "expensas, moneda_expensas, ocultar_precio, " +
      "link_zonaprop, link_argenprop, link_mercadolibre, link_tokko, " +
      "created_at, updated_at"
    )
    .eq("perfil_id", perfil.perfil_id)
    .order("updated_at", { ascending: false })
    .limit(limite);

  if (operacion) query = query.eq("operacion", operacion);
  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    total: data?.length ?? 0,
    propiedades: data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const perfil = await resolverPerfil(req);
  if (!perfil) {
    return NextResponse.json({ error: "API key inválida o sin acceso habilitado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.titulo || !body.tipo || !body.operacion) {
    return NextResponse.json(
      { error: "Campos obligatorios: titulo, tipo, operacion" },
      { status: 400 }
    );
  }

  const codigoExterno = typeof body.codigo === "string" ? body.codigo.trim() : null;

  // Buscar propiedad existente por codigo + perfil para hacer upsert
  let propiedadId: string | null = null;
  if (codigoExterno) {
    const { data: existente } = await sb
      .from("cartera_propiedades")
      .select("id")
      .eq("perfil_id", perfil.perfil_id)
      .eq("codigo", codigoExterno)
      .maybeSingle();
    propiedadId = existente?.id ?? null;
  }

  const camposPermitidos = [
    "codigo", "titulo", "tipo", "operacion", "precio", "moneda",
    "descripcion_privada", "direccion", "zona", "ciudad", "codigo_postal",
    "latitud", "longitud", "dormitorios", "banos", "ambientes",
    "superficie_cubierta", "superficie_total", "sup_terreno", "sup_semicubierta",
    "sup_descubierta", "sup_balcon", "sup_patio_terraza",
    "estado", "fotos", "video_url", "tour_virtual_url", "tour_virtual_url",
    "apto_credito", "con_cochera", "amoblado", "acepta_permuta", "acepta_mascotas",
    "barrio_cerrado", "uso_comercial", "uso_profesional",
    "expensas", "moneda_expensas", "ocultar_precio",
    "anio_construccion", "piso", "numero_unidad", "disposicion", "orientacion",
    "tipo_departamento", "antiguedad", "condicion",
    "amb_balcon", "amb_terraza", "amb_patio", "amb_jardin", "amb_parrilla",
    "amb_living", "amb_comedor", "amb_comedor_diario", "amb_cocina",
    "amb_estudio", "amb_vestidor", "amb_lavadero",
    "com_pileta", "com_gimnasio", "com_sum", "com_salon_fiestas",
    "com_seguridad", "com_internet", "com_aire_acondicionado", "com_calefaccion",
    "com_ascensor", "com_quincho", "com_juegos_infantiles",
  ] as const;

  const payload: Record<string, unknown> = { perfil_id: perfil.perfil_id, updated_at: new Date().toISOString() };
  for (const campo of camposPermitidos) {
    if (campo in body) payload[campo] = body[campo];
  }

  let result: Record<string, unknown>;
  if (propiedadId) {
    const { data, error } = await sb
      .from("cartera_propiedades")
      .update(payload)
      .eq("id", propiedadId)
      .eq("perfil_id", perfil.perfil_id)
      .select("id, codigo, titulo")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = { accion: "actualizada", ...data };
  } else {
    const { data, error } = await sb
      .from("cartera_propiedades")
      .insert(payload)
      .select("id, codigo, titulo")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = { accion: "creada", ...data };
  }

  return NextResponse.json({ ok: true, ...result });
}
