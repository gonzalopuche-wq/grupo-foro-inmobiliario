import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function esAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return false;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", data.user.id).single();
  return ["admin", "master"].includes(p?.tipo ?? "");
}

// Perfil canónico que guarda la config compartida de redes sociales.
// Se elige de forma determinística (admin/master más antiguo) para que
// guardado y lectura apunten SIEMPRE a la misma fila. Se escribe con service
// role para no chocar con la RLS de perfiles (perfiles_update_own).
async function getCanonicalProfile() {
  const { data } = await sb
    .from("perfiles")
    .select("id, configuracion")
    .in("tipo", ["admin", "master"])
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  return data;
}

export async function GET(req: NextRequest) {
  if (!(await esAdmin(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const prof = await getCanonicalProfile();
  return NextResponse.json({ redes_sociales: prof?.configuracion?.redes_sociales ?? {} });
}

export async function POST(req: NextRequest) {
  if (!(await esAdmin(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { redes_sociales } = (await req.json()) as { redes_sociales?: Record<string, string> };
  if (!redes_sociales || typeof redes_sociales !== "object" || Array.isArray(redes_sociales)) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const prof = await getCanonicalProfile();
  if (!prof) {
    return NextResponse.json({ error: "No se encontró un perfil admin" }, { status: 404 });
  }
  const { error } = await sb
    .from("perfiles")
    .update({ configuracion: { ...((prof.configuracion as Record<string, unknown>) ?? {}), redes_sociales } })
    .eq("id", prof.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
