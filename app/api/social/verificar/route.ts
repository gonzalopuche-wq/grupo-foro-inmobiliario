import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 20;

async function verificarAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return false;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", data.user.id).single();
  return ["admin", "master", "admin_contenido"].includes(p?.tipo ?? "");
}

async function getRedesConfig(): Promise<Record<string, string>> {
  const { data } = await sb
    .from("perfiles")
    .select("configuracion")
    .in("tipo", ["admin", "master"])
    .limit(1)
    .single();
  return data?.configuracion?.redes_sociales ?? {};
}

interface RedResult {
  red: string;
  ok: boolean;
  nombre?: string;
  detalle?: string;
  error?: string;
  configurada: boolean;
}

async function checkFacebook(cfg: Record<string, string>): Promise<RedResult> {
  const { facebook_page_id: pageId, facebook_page_token: token } = cfg;
  if (!pageId || !token) return { red: "Facebook", ok: false, configurada: false, error: "Token no configurado" };
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=name,id,fan_count&access_token=${token}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const json = await res.json();
    if (json.error) return { red: "Facebook", ok: false, configurada: true, error: json.error.message };
    return { red: "Facebook", ok: true, configurada: true, nombre: json.name, detalle: `ID: ${json.id} · ${json.fan_count ?? 0} seguidores` };
  } catch (e: any) {
    return { red: "Facebook", ok: false, configurada: true, error: e.message };
  }
}

async function checkInstagram(cfg: Record<string, string>): Promise<RedResult> {
  const { instagram_user_id: igId, facebook_page_token: token } = cfg;
  if (!igId || !token) return { red: "Instagram", ok: false, configurada: false, error: "Token no configurado" };
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${igId}?fields=id,name,username,followers_count&access_token=${token}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const json = await res.json();
    if (json.error) return { red: "Instagram", ok: false, configurada: true, error: json.error.message };
    return { red: "Instagram", ok: true, configurada: true, nombre: `@${json.username ?? json.name}`, detalle: `${json.followers_count ?? 0} seguidores` };
  } catch (e: any) {
    return { red: "Instagram", ok: false, configurada: true, error: e.message };
  }
}

async function checkLinkedIn(cfg: Record<string, string>): Promise<RedResult> {
  const { linkedin_access_token: token, linkedin_org_id: orgId } = cfg;
  if (!token || !orgId) return { red: "LinkedIn", ok: false, configurada: false, error: "Token no configurado" };
  try {
    const res = await fetch(
      `https://api.linkedin.com/v2/organizations/${orgId}?projection=(id,localizedName)`,
      {
        headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" },
        signal: AbortSignal.timeout(8000),
      }
    );
    const json = await res.json();
    if (!res.ok) return { red: "LinkedIn", ok: false, configurada: true, error: json.message ?? `HTTP ${res.status}` };
    const name = json.localizedName ?? json.name?.localized?.es_AR ?? json.name?.localized?.en_US ?? `Org ${orgId}`;
    return { red: "LinkedIn", ok: true, configurada: true, nombre: name, detalle: `Org ID: ${orgId}` };
  } catch (e: any) {
    return { red: "LinkedIn", ok: false, configurada: true, error: e.message };
  }
}

function oauthSign(
  method: string, url: string, params: Record<string, string>,
  consumerKey: string, consumerSecret: string, token: string, tokenSecret: string
): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Math.floor(Date.now() / 1000).toString();
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: ts,
    oauth_token: token,
    oauth_version: "1.0",
  };
  const all = { ...params, ...oauthParams };
  const enc = (s: string) => encodeURIComponent(s);
  const sorted = Object.keys(all).sort().map(k => `${enc(k)}=${enc(all[k])}`).join("&");
  const base = `${method}&${enc(url)}&${enc(sorted)}`;
  const key = `${enc(consumerSecret)}&${enc(tokenSecret)}`;
  const sig = crypto.createHmac("sha1", key).update(base).digest("base64");
  const header = Object.entries({ ...oauthParams, oauth_signature: sig })
    .map(([k, v]) => `${k}="${enc(v)}"`)
    .join(", ");
  return `OAuth ${header}`;
}

async function checkTwitter(cfg: Record<string, string>): Promise<RedResult> {
  const { twitter_api_key: ck, twitter_api_secret: cs, twitter_access_token: at, twitter_access_secret: ats } = cfg;
  if (!ck || !cs || !at || !ats) return { red: "Twitter / X", ok: false, configurada: false, error: "Credenciales no configuradas" };
  try {
    const url = "https://api.twitter.com/2/users/me";
    const authHeader = oauthSign("GET", url, {}, ck, cs, at, ats);
    const res = await fetch(url, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    if (json.errors || json.error) {
      return { red: "Twitter / X", ok: false, configurada: true, error: json.errors?.[0]?.message ?? json.error ?? "Error de autenticación" };
    }
    return { red: "Twitter / X", ok: true, configurada: true, nombre: `@${json.data?.username ?? "cuenta"}`, detalle: `ID: ${json.data?.id}` };
  } catch (e: any) {
    return { red: "Twitter / X", ok: false, configurada: true, error: e.message };
  }
}

async function checkTikTok(cfg: Record<string, string>): Promise<RedResult> {
  const { tiktok_access_token: token } = cfg;
  if (!token) return { red: "TikTok", ok: false, configurada: false, error: "Token no configurado" };
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    if (json.error?.code && json.error.code !== "ok") {
      return { red: "TikTok", ok: false, configurada: true, error: json.error.message ?? "Token inválido" };
    }
    const u = json.data?.user;
    return { red: "TikTok", ok: true, configurada: true, nombre: u?.display_name ?? "cuenta TikTok", detalle: `${u?.follower_count ?? 0} seguidores` };
  } catch (e: any) {
    return { red: "TikTok", ok: false, configurada: true, error: e.message };
  }
}

export async function GET(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const cfg = await getRedesConfig();

  const [fb, ig, li, tw, tt] = await Promise.allSettled([
    checkFacebook(cfg),
    checkInstagram(cfg),
    checkLinkedIn(cfg),
    checkTwitter(cfg),
    checkTikTok(cfg),
  ]);

  const resultados = [fb, ig, li, tw, tt].map(r =>
    r.status === "fulfilled" ? r.value : { red: "?", ok: false, configurada: false, error: "Error interno" }
  );

  return NextResponse.json({ resultados });
}
