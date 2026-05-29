import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const portal    = sp.get("portal");
  const operacion = sp.get("operacion");
  const tipo      = sp.get("tipo");
  const min       = sp.get("min");
  const max       = sp.get("max");
  const moneda    = sp.get("moneda") ?? "USD";
  const dorm      = sp.get("dorm");
  const q         = sp.get("q")?.trim();
  const page      = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const limit     = 24;
  const offset    = (page - 1) * limit;

  let query = sb
    .from("propiedades_externas")
    .select("id,portal,portal_id,url,titulo,operacion,tipo,precio,moneda,dormitorios,banos,ambientes,superficie_cubierta,sup_terreno,expensas,barrio,ciudad,imagenes,synced_at", { count: "exact" })
    .eq("activa", true)
    .order("synced_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (portal)    query = query.eq("portal", portal);
  if (operacion) query = query.eq("operacion", operacion);
  if (tipo)      query = query.eq("tipo", tipo);
  if (dorm)      query = query.gte("dormitorios", parseInt(dorm));
  if (min)       query = query.gte("precio", parseInt(min)).eq("moneda", moneda);
  if (max)       query = query.lte("precio", parseInt(max)).eq("moneda", moneda);
  if (q)         query = query.ilike("titulo", `%${q}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Stats para el resumen (independiente de filtros)
  const { data: stats } = await sb
    .from("propiedades_externas")
    .select("portal")
    .eq("activa", true);

  const porPortal: Record<string, number> = {};
  for (const row of stats ?? []) {
    porPortal[row.portal] = (porPortal[row.portal] ?? 0) + 1;
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    porPortal,
  });
}
