import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verificar sesión
  const { data: { user }, error: authErr } = await sb.auth.getUser(auth);
  if (authErr || !user) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const operacion  = p.get("operacion");
  const tipo       = p.get("tipo");
  const barrio     = p.get("barrio");
  const ciudad     = p.get("ciudad");
  const precioMin  = p.get("precioMin") ? Number(p.get("precioMin")) : null;
  const precioMax  = p.get("precioMax") ? Number(p.get("precioMax")) : null;
  const moneda     = p.get("moneda");
  const dormitorios = p.get("dormitorios") ? Number(p.get("dormitorios")) : null;
  const fuentes    = p.get("fuentes")?.split(",").filter(Boolean) ?? [];
  const limit      = Math.min(Number(p.get("limit") ?? 50), 200);
  const offset     = Number(p.get("offset") ?? 0);

  let query = sb
    .from("v_propiedades_mercado")
    .select("id,fuente,red,titulo,operacion,tipo,precio,moneda,barrio,ciudad,provincia,dormitorios,banos,superficie_cubierta,foto_principal,url,propietario_id,estado", { count: "exact" });

  // ilike es case-insensitive: coincide "Venta" (cartera GFI) y "venta" (externos)
  if (operacion)    query = query.ilike("operacion", operacion.toLowerCase());
  if (tipo)         query = query.ilike("tipo", `%${tipo}%`);
  if (barrio)       query = query.ilike("barrio", `%${barrio}%`);
  if (ciudad)       query = query.ilike("ciudad", `%${ciudad}%`);
  if (precioMin)    query = query.gte("precio", precioMin);
  if (precioMax)    query = query.lte("precio", precioMax);
  if (moneda && (precioMin || precioMax)) query = query.eq("moneda", moneda);
  if (dormitorios)  query = query.eq("dormitorios", dormitorios);
  if (fuentes.length > 0) query = query.in("fuente", fuentes);

  const { data, count, error } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ total: count ?? 0, offset, limit, propiedades: data ?? [] });
}
