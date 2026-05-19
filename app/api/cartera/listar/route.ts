import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Verificar si es colaborador — en ese caso cargar la cartera del corredor
  const { data: perfil } = await supabaseAdmin
    .from("perfiles").select("tipo").eq("id", user.id).single();

  let perfilId = user.id;
  if (perfil?.tipo === "colaborador") {
    const { data: colab } = await supabaseAdmin
      .from("colaboradores").select("corredor_id").eq("user_id", user.id).single();
    if (colab?.corredor_id) perfilId = colab.corredor_id;
  }

  const { data: props, error } = await supabaseAdmin
    .from("cartera_propiedades")
    .select("*")
    .eq("perfil_id", perfilId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Leads count per propiedad — done server-side with service_role so collaborators see correct counts
  const ids = (props ?? []).map((p: { id: string }) => p.id);
  let leadsCount: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: leadsRaw } = await supabaseAdmin
      .from("web_leads")
      .select("propiedad_id")
      .in("propiedad_id", ids)
      .not("propiedad_id", "is", null);
    (leadsRaw ?? []).forEach((l: { propiedad_id: string }) => {
      leadsCount[l.propiedad_id] = (leadsCount[l.propiedad_id] ?? 0) + 1;
    });
  }

  const propsConLeads = (props ?? []).map((p: { id: string }) => ({
    ...p,
    leads_count: leadsCount[p.id] ?? 0,
  }));

  return NextResponse.json({ ok: true, props: propsConLeads });
}
