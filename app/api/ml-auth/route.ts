// Inicia el flujo OAuth de MercadoLibre para el usuario autenticado.
// GET /api/ml-auth → redirige a ML para autorización
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ML_AUTH_URL = "https://auth.mercadolibre.com.ar/authorization";

export async function GET(req: NextRequest) {
  const perfil_id = req.nextUrl.searchParams.get("perfil_id");
  if (!perfil_id) return NextResponse.json({ error: "perfil_id requerido" }, { status: 400 });

  const { data: creds } = await sb
    .from("portal_credenciales")
    .select("ml_app_id")
    .eq("perfil_id", perfil_id)
    .maybeSingle();

  if (!creds?.ml_app_id) {
    return NextResponse.json({ error: "Guardá tu ML App ID antes de conectar." }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/ml-auth/callback`;

  const url = new URL(ML_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.ml_app_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", perfil_id);

  return NextResponse.redirect(url.toString());
}
