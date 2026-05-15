import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TOKKO_BASE = "https://www.tokkobroker.com/api/v1";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action") ?? "propiedades";

  const { data: configRow } = await supabase
    .from("crm_integraciones_config")
    .select("config")
    .eq("perfil_id", user.id)
    .eq("tipo", "tokko")
    .single();

  const apiKey = (configRow?.config as Record<string, string> | null)?.api_key;
  if (!apiKey) return NextResponse.json({ error: "No hay API key configurada para Tokko Broker" }, { status: 400 });

  try {
    let url = "";
    if (action === "propiedades") {
      url = `${TOKKO_BASE}/property/?key=${apiKey}&limit=100&offset=0&format=json`;
    } else if (action === "contactos") {
      url = `${TOKKO_BASE}/contact/?key=${apiKey}&limit=100&format=json`;
    } else {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Tokko API respondió ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
