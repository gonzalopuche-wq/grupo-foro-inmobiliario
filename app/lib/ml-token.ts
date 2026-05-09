import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

export async function getMLToken(perfil_id: string): Promise<string | null> {
  const { data: creds } = await sb
    .from("portal_credenciales")
    .select("ml_app_id,ml_app_secret,ml_access_token,ml_refresh_token,ml_token_expires_at")
    .eq("perfil_id", perfil_id)
    .maybeSingle();

  if (!creds?.ml_access_token || !creds?.ml_refresh_token) return null;

  // Return existing token if still valid (5-min buffer)
  const expiresAt = creds.ml_token_expires_at ? new Date(creds.ml_token_expires_at) : null;
  if (expiresAt && expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return creds.ml_access_token;
  }

  // Refresh token
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: creds.ml_app_id ?? "",
    client_secret: creds.ml_app_secret ?? "",
    refresh_token: creds.ml_refresh_token,
  });

  const res = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });

  if (!res.ok) return null;

  const json = await res.json();
  const newExpiry = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await sb.from("portal_credenciales").upsert({
    perfil_id,
    ml_access_token: json.access_token,
    ml_refresh_token: json.refresh_token ?? creds.ml_refresh_token,
    ml_token_expires_at: newExpiry,
    updated_at: new Date().toISOString(),
  }, { onConflict: "perfil_id" });

  return json.access_token;
}
