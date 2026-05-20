import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Base URL de la API de Propia MLS — actualizar cuando lleguen los docs oficiales
const PROPIA_BASE = process.env.PROPIA_API_BASE ?? "https://api.red.propia.com.ar/v1";

async function autenticar(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return null;
  const { data: { user } } = await sb.auth.getUser(jwt);
  return user ?? null;
}

async function obtenerCredenciales(userId: string): Promise<{ apiKey: string | null; usuario: string | null }> {
  const { data } = await sb
    .from("portal_credenciales")
    .select("propia_api_key, propia_usuario")
    .eq("perfil_id", userId)
    .maybeSingle();
  return {
    apiKey: (data as Record<string, string | null> | null)?.propia_api_key ?? process.env.PROPIA_API_KEY ?? null,
    usuario: (data as Record<string, string | null> | null)?.propia_usuario ?? null,
  };
}

function propiaHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-Api-Key": apiKey,
  };
}

// GET /api/crm/propia?action=buscar&tipo=...&operacion=...&zona=...&pagina=1
// GET /api/crm/propia?action=detalle&id=...
// GET /api/crm/propia?action=mis-publicaciones
export async function GET(req: NextRequest) {
  const user = await autenticar(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { apiKey, usuario } = await obtenerCredenciales(user.id);
  if (!apiKey) {
    return NextResponse.json(
      { error: "No hay API key de Propia configurada. Configurala en CRM → Portales → Propia MLS.", sinCredenciales: true },
      { status: 400 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const action = sp.get("action") ?? "buscar";

  try {
    if (action === "buscar") {
      const params = new URLSearchParams({ page: sp.get("pagina") ?? "1", per_page: "24" });
      if (sp.get("tipo"))        params.set("property_type", sp.get("tipo")!);
      if (sp.get("operacion"))   params.set("operation_type", sp.get("operacion")!);
      if (sp.get("zona"))        params.set("zone", sp.get("zona")!);
      if (sp.get("precio_min"))  params.set("price_min", sp.get("precio_min")!);
      if (sp.get("precio_max"))  params.set("price_max", sp.get("precio_max")!);
      if (sp.get("dormitorios")) params.set("bedrooms", sp.get("dormitorios")!);
      if (sp.get("q"))           params.set("q", sp.get("q")!);

      const res = await fetch(`${PROPIA_BASE}/properties?${params}`, {
        headers: propiaHeaders(apiKey),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const txt = await res.text();
        return NextResponse.json({ error: `Propia API HTTP ${res.status}: ${txt.slice(0, 300)}` }, { status: 502 });
      }
      const data = await res.json();
      return NextResponse.json({ ok: true, ...data });
    }

    if (action === "detalle") {
      const id = sp.get("id");
      if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
      const res = await fetch(`${PROPIA_BASE}/properties/${id}`, {
        headers: propiaHeaders(apiKey),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
      return NextResponse.json({ ok: true, data: await res.json() });
    }

    if (action === "mis-publicaciones") {
      const params = new URLSearchParams({ page: sp.get("pagina") ?? "1", per_page: "24" });
      if (usuario) params.set("user", usuario);
      const res = await fetch(`${PROPIA_BASE}/my-properties?${params}`, {
        headers: propiaHeaders(apiKey),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
      const data = await res.json();
      return NextResponse.json({ ok: true, ...data });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
