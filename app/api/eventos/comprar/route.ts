import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const eventoId = url.searchParams.get("evento_id");

  let q = sb
    .from("evento_compras")
    .select("*, eventos(titulo, fecha, precio_entrada, moneda), perfiles(nombre, apellido, email)")
    .order("created_at", { ascending: false });

  if (eventoId) {
    // Admin ve todas las compras del evento
    const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
    if (p?.tipo !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    q = q.eq("evento_id", eventoId);
  } else {
    q = q.eq("perfil_id", user.id);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ compras: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { evento_id, cantidad = 1, metodo_pago, notas } = body;
  if (!evento_id) return NextResponse.json({ error: "evento_id requerido" }, { status: 400 });

  const { data: evento } = await sb
    .from("eventos")
    .select("id, titulo, gratuito, precio_entrada, moneda, capacidad, estado")
    .eq("id", evento_id)
    .single();

  if (!evento) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  if (evento.estado !== "publicado") return NextResponse.json({ error: "Evento no disponible" }, { status: 400 });

  // Verificar capacidad
  if (evento.capacidad) {
    const { count } = await sb
      .from("evento_compras")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", evento_id)
      .in("estado", ["pendiente", "confirmado"]);
    if ((count ?? 0) >= evento.capacidad) {
      return NextResponse.json({ error: "El evento está completo" }, { status: 400 });
    }
  }

  const precio_total = evento.gratuito ? 0 : (evento.precio_entrada ?? 0) * cantidad;

  const { data, error } = await sb.from("evento_compras").upsert({
    evento_id,
    perfil_id: user.id,
    cantidad,
    precio_total,
    moneda: evento.moneda ?? "ARS",
    metodo_pago: metodo_pago ?? null,
    estado: precio_total === 0 ? "confirmado" : "pendiente",
  }, { onConflict: "evento_id,perfil_id" }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ compra: data });
}

export async function PATCH(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", user.id).single();
  if (p?.tipo !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const body = await req.json();
  const { id, estado, notas_admin } = body;
  if (!id || !estado) return NextResponse.json({ error: "id y estado requeridos" }, { status: 400 });

  const update: Record<string, unknown> = { estado, updated_at: new Date().toISOString() };
  if (notas_admin !== undefined) update.notas_admin = notas_admin;
  if (estado === "confirmado") { update.confirmado_por = user.id; update.confirmado_at = new Date().toISOString(); }

  const { error } = await sb.from("evento_compras").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
