import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(jwt);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action") ?? "propiedades";

  const { data: configRow } = await sb
    .from("crm_integraciones_config")
    .select("config")
    .eq("perfil_id", user.id)
    .eq("tipo", "kiteprop")
    .single();

  const config = configRow?.config as Record<string, string> | null;
  const apiKey = config?.api_key;
  if (!apiKey) return NextResponse.json({ error: "No hay API key configurada para Kiteprop" }, { status: 400 });

  // Kiteprop base URL — configurable para instancias custom
  const baseUrl = (config?.base_url ?? "https://api.kiteprop.com/api/v1").replace(/\/$/, "");

  try {
    let url = "";
    if (action === "propiedades") {
      url = `${baseUrl}/properties/?api_key=${apiKey}&limit=100&format=json`;
    } else if (action === "contactos") {
      url = `${baseUrl}/contacts/?api_key=${apiKey}&limit=100&format=json`;
    } else {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: { Accept: "application/json", "X-Api-Key": apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Kiteprop API respondió ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
