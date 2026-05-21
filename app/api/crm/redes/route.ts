import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGE_SIZE = 20;

async function getUser(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return null;
  const { data: { user } } = await sb.auth.getUser(jwt);
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const red = sp.get("red") ?? "todas";
  const q = (sp.get("q") ?? "").trim();
  const pagina = Math.max(1, parseInt(sp.get("pagina") ?? "1", 10));
  const from = (pagina - 1) * PAGE_SIZE;

  try {
    // ── Propiedades importadas (KiteProp, Tokko, todas) ────────────────────
    if (red === "todas" || red === "kiteprop" || red === "tokko") {
      let query = sb
        .from("cartera_propiedades")
        .select(
          "id,titulo,precio,moneda,operacion,zona,ciudad,dormitorios,superficie_cubierta,estado,url_portal_origen,created_at",
          { count: "exact" }
        )
        .not("url_portal_origen", "is", null);

      if (red === "kiteprop") query = query.ilike("url_portal_origen", "kiteprop:%");
      else if (red === "tokko") query = query.ilike("url_portal_origen", "tokko:%");

      if (q) query = query.or(`titulo.ilike.%${q}%,zona.ilike.%${q}%,ciudad.ilike.%${q}%`);

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        ok: true, tipo: "propiedades",
        data: data ?? [], total: count ?? 0,
        pagina, paginas: Math.ceil((count ?? 0) / PAGE_SIZE),
      });
    }

    // ── COCIR: matriculados ────────────────────────────────────────────────
    if (red === "cocir") {
      let query = sb
        .from("cocir_padron")
        .select(
          "id,matricula,apellido,nombre,inmobiliaria,localidad,telefono,email,estado,actualizado_at",
          { count: "exact" }
        );

      if (q) query = query.or(`apellido.ilike.%${q}%,nombre.ilike.%${q}%,inmobiliaria.ilike.%${q}%,localidad.ilike.%${q}%,matricula.ilike.%${q}%`);

      const { data, count, error } = await query
        .order("apellido", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        ok: true, tipo: "matriculados",
        data: data ?? [], total: count ?? 0,
        pagina, paginas: Math.ceil((count ?? 0) / PAGE_SIZE),
      });
    }

    // ── Empresas aliadas: GFI corredores ──────────────────────────────────
    if (red === "aliadas") {
      let query = sb
        .from("perfiles")
        .select(
          "id,nombre,apellido,matricula,inmobiliaria,telefono,email,zona_trabajo,tipo,estado,foto_url,created_at",
          { count: "exact" }
        )
        .eq("tipo", "corredor")
        .not("estado", "in", '("pendiente","rechazado")');

      if (q) query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,inmobiliaria.ilike.%${q}%,zona_trabajo.ilike.%${q}%`);

      const { data, count, error } = await query
        .order("apellido", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        ok: true, tipo: "corredores",
        data: data ?? [], total: count ?? 0,
        pagina, paginas: Math.ceil((count ?? 0) / PAGE_SIZE),
      });
    }

    return NextResponse.json({ error: "Red inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
