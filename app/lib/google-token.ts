import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function getGoogleToken(perfil_id: string): Promise<string | null> {
  const { data: creds } = await sb
    .from("portal_credenciales")
    .select("google_access_token,google_refresh_token,google_token_expires_at")
    .eq("perfil_id", perfil_id)
    .maybeSingle();

  if (!creds?.google_access_token || !creds?.google_refresh_token) return null;

  const expiresAt = creds.google_token_expires_at ? new Date(creds.google_token_expires_at) : null;
  if (expiresAt && expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return creds.google_access_token;
  }

  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: creds.google_refresh_token,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;

  const json = await res.json();
  const newExpiry = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await sb.from("portal_credenciales").upsert({
    perfil_id,
    google_access_token: json.access_token,
    google_token_expires_at: newExpiry,
    updated_at: new Date().toISOString(),
  }, { onConflict: "perfil_id" });

  return json.access_token;
}
