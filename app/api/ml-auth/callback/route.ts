// Callback OAuth de MercadoLibre: intercambia code por tokens y los guarda.
// GET /api/ml-auth/callback?code=...&state=perfil_id
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const perfil_id = req.nextUrl.searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const portalesUrl = `${baseUrl}/crm/portales`;

  if (!code || !perfil_id) {
    return NextResponse.redirect(`${portalesUrl}?ml_error=missing_params`);
  }

  const { data: creds } = await sb
    .from("portal_credenciales")
    .select("ml_app_id,ml_app_secret")
    .eq("perfil_id", perfil_id)
    .maybeSingle();

  if (!creds?.ml_app_id || !creds?.ml_app_secret) {
    return NextResponse.redirect(`${portalesUrl}?ml_error=missing_app_credentials`);
  }

  const redirectUri = `${baseUrl}/api/ml-auth/callback`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: creds.ml_app_id,
    client_secret: creds.ml_app_secret,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("ML token exchange error:", err);
    return NextResponse.redirect(`${portalesUrl}?ml_error=token_exchange_failed`);
  }

  const json = await res.json();
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await sb.from("portal_credenciales").upsert({
    perfil_id,
    ml_access_token: json.access_token,
    ml_refresh_token: json.refresh_token,
    ml_token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "perfil_id" });

  return NextResponse.redirect(`${portalesUrl}?ml_ok=1`);
}
