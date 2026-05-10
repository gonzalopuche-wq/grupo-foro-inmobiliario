import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const code      = req.nextUrl.searchParams.get("code");
  const perfil_id = req.nextUrl.searchParams.get("state");
  const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const portalesUrl = `${baseUrl}/crm/portales`;

  if (!code || !perfil_id) return NextResponse.redirect(`${portalesUrl}?google_error=missing_params`);

  const redirectUri = `${baseUrl}/api/google-auth/callback`;

  const body = new URLSearchParams({
    code,
    client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri:  redirectUri,
    grant_type:    "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return NextResponse.redirect(`${portalesUrl}?google_error=token_exchange_failed`);

  const json = await res.json();
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await sb.from("portal_credenciales").upsert({
    perfil_id,
    google_access_token:     json.access_token,
    google_refresh_token:    json.refresh_token ?? null,
    google_token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "perfil_id" });

  return NextResponse.redirect(`${portalesUrl}?google_ok=1`);
}
