import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 30;

async function verificarAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return false;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", data.user.id).single();
  return ["admin", "master"].includes(p?.tipo ?? "");
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

// ── Facebook ─────────────────────────────────────────────────────────────────
async function postFacebook(cfg: Record<string, string>, texto: string, link: string) {
  const { facebook_page_id: pageId, facebook_page_token: token } = cfg;
  if (!pageId || !token) return { red: "facebook", ok: false, error: "Sin configurar" };
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: texto, link, access_token: token }),
    });
    const json = await res.json();
    if (json.error) return { red: "facebook", ok: false, error: json.error.message };
    return { red: "facebook", ok: true, post_id: json.id };
  } catch (e: any) {
    return { red: "facebook", ok: false, error: e.message };
  }
}

// ── Instagram ────────────────────────────────────────────────────────────────
async function postInstagram(cfg: Record<string, string>, caption: string, imagenUrl: string | null) {
  const { instagram_user_id: igId, facebook_page_token: token } = cfg;
  if (!igId || !token) return { red: "instagram", ok: false, error: "Sin configurar" };
  if (!imagenUrl) return { red: "instagram", ok: false, error: "Sin imagen — Instagram requiere imagen" };
  try {
    const r1 = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imagenUrl, caption, access_token: token }),
    });
    const j1 = await r1.json();
    if (j1.error) return { red: "instagram", ok: false, error: j1.error.message };
    const r2 = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: j1.id, access_token: token }),
    });
    const j2 = await r2.json();
    if (j2.error) return { red: "instagram", ok: false, error: j2.error.message };
    return { red: "instagram", ok: true, post_id: j2.id };
  } catch (e: any) {
    return { red: "instagram", ok: false, error: e.message };
  }
}

// ── LinkedIn ─────────────────────────────────────────────────────────────────
async function postLinkedIn(cfg: Record<string, string>, titulo: string, texto: string, link: string) {
  const { linkedin_access_token: token, linkedin_org_id: orgId } = cfg;
  if (!token || !orgId) return { red: "linkedin", ok: false, error: "Sin configurar" };
  try {
    const body = {
      author: `urn:li:organization:${orgId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: texto },
          shareMediaCategory: "ARTICLE",
          media: [{ status: "READY", originalUrl: link, title: { text: titulo } }],
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return { red: "linkedin", ok: false, error: json.message ?? "Error LinkedIn" };
    return { red: "linkedin", ok: true, post_id: res.headers.get("x-restli-id") ?? "" };
  } catch (e: any) {
    return { red: "linkedin", ok: false, error: e.message };
  }
}

// ── Twitter / X — OAuth 1.0a ─────────────────────────────────────────────────
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

async function postTwitter(cfg: Record<string, string>, texto: string) {
  const { twitter_api_key: ck, twitter_api_secret: cs, twitter_access_token: at, twitter_access_secret: ats } = cfg;
  if (!ck || !cs || !at || !ats) return { red: "twitter", ok: false, error: "Sin configurar" };
  try {
    const url = "https://api.twitter.com/2/tweets";
    const authHeader = oauthSign("POST", url, {}, ck, cs, at, ats);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ text: texto }),
    });
    const json = await res.json();
    if (json.errors || json.error) return { red: "twitter", ok: false, error: json.errors?.[0]?.message ?? json.error };
    return { red: "twitter", ok: true, post_id: json.data?.id };
  } catch (e: any) {
    return { red: "twitter", ok: false, error: e.message };
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!await verificarAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { tipo, id, titulo, descripcion, imagen_url, link } = await req.json() as {
    tipo: "evento" | "noticia" | "curso";
    id: string;
    titulo: string;
    descripcion: string;
    imagen_url: string | null;
    link: string;
  };

  const cfg = await getRedesConfig();

  const textoCorto = `${titulo}\n\n${descripcion.slice(0, 200)}${descripcion.length > 200 ? "..." : ""}\n\n${link}`;
  const captionIG = `${titulo}\n\n${descripcion.slice(0, 2000)}`;

  const resultados = await Promise.allSettled([
    postFacebook(cfg, textoCorto, link),
    postInstagram(cfg, captionIG, imagen_url),
    postLinkedIn(cfg, titulo, textoCorto, link),
    postTwitter(cfg, `${titulo}\n${link}`),
  ]);

  const results = resultados.map(r => r.status === "fulfilled" ? r.value : { red: "?", ok: false, error: "Error interno" });

  // Loguear en DB (no crítico — no rompe si la tabla no existe)
  try {
    await sb.from("social_posts").insert(
      results.map(r => ({
        red: r.red,
        contenido_tipo: tipo,
        contenido_id: id,
        estado: r.ok ? "success" : "error",
        post_id: (r as any).post_id ?? null,
        error_msg: r.ok ? null : r.error,
      }))
    );
  } catch { /* tabla puede no existir aún */ }

  return NextResponse.json({ results });
}
