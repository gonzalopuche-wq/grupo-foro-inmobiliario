import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RedesConfig {
  facebook_page_id?: string;
  facebook_page_token?: string;
  instagram_user_id?: string;
  twitter_api_key?: string;
  twitter_api_secret?: string;
  twitter_access_token?: string;
  twitter_access_secret?: string;
  tiktok_access_token?: string;
}

async function postFacebook(config: RedesConfig, text: string, imageUrl?: string | null) {
  if (!config.facebook_page_id || !config.facebook_page_token) return { ok: false, error: "Sin configuración Facebook" };
  try {
    const body: any = { message: text, access_token: config.facebook_page_token };
    if (imageUrl) body.link = imageUrl;
    const res = await fetch(`https://graph.facebook.com/v21.0/${config.facebook_page_id}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) return { ok: false, error: data.error.message };
    return { ok: true, id: data.id };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

async function postInstagram(config: RedesConfig, text: string, imageUrl?: string | null) {
  if (!config.instagram_user_id || !config.facebook_page_token) return { ok: false, error: "Sin configuración Instagram" };
  if (!imageUrl) return { ok: false, error: "Instagram requiere imagen" };
  try {
    // Step 1: Create media container
    const createRes = await fetch(
      `https://graph.facebook.com/v21.0/${config.instagram_user_id}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, caption: text, access_token: config.facebook_page_token }),
      }
    );
    const createData = await createRes.json();
    if (createData.error) return { ok: false, error: createData.error.message };
    // Step 2: Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${config.instagram_user_id}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: createData.id, access_token: config.facebook_page_token }),
      }
    );
    const publishData = await publishRes.json();
    if (publishData.error) return { ok: false, error: publishData.error.message };
    return { ok: true, id: publishData.id };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

async function postTwitter(config: RedesConfig, text: string) {
  if (!config.twitter_api_key || !config.twitter_api_secret || !config.twitter_access_token || !config.twitter_access_secret) {
    return { ok: false, error: "Sin configuración Twitter/X" };
  }
  try {
    // OAuth 1.0a signature for Twitter v2
    const oauth = buildOAuth1Header(
      "POST",
      "https://api.twitter.com/2/tweets",
      config.twitter_api_key,
      config.twitter_api_secret,
      config.twitter_access_token,
      config.twitter_access_secret,
    );
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: oauth },
      body: JSON.stringify({ text: text.slice(0, 280) }),
    });
    const data = await res.json();
    if (data.errors || data.error) return { ok: false, error: JSON.stringify(data.errors ?? data.error) };
    return { ok: true, id: data.data?.id };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

async function postTikTok(config: RedesConfig, text: string) {
  if (!config.tiktok_access_token) return { ok: false, error: "Sin configuración TikTok" };
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/post/publish/text/init/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        Authorization: `Bearer ${config.tiktok_access_token}`,
      },
      body: JSON.stringify({
        post_info: { title: text.slice(0, 150), privacy_level: "PUBLIC_TO_EVERYONE", disable_comment: false },
        source_info: { source: "PULL_FROM_URL", video_url: "" },
      }),
    });
    const data = await res.json();
    if (data.error?.code && data.error.code !== "ok") return { ok: false, error: data.error.message ?? "Error TikTok" };
    return { ok: true };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

// Minimal OAuth 1.0a implementation for Twitter
function buildOAuth1Header(method: string, url: string, apiKey: string, apiSecret: string, accessToken: string, accessSecret: string): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2);
  const params: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: ts,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };
  const sortedParams = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
  // Use crypto for HMAC-SHA1
  const crypto = require("crypto");
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  params.oauth_signature = signature;
  const authHeader = "OAuth " + Object.keys(params).map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`).join(", ");
  return authHeader;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const { data: perfil } = await supabaseAdmin.from("perfiles").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "admin") return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

  const { evento } = await req.json();

  // Load social config from admin profile
  const { data: adminProfile } = await supabaseAdmin
    .from("perfiles")
    .select("configuracion")
    .eq("tipo", "admin")
    .limit(1)
    .single();

  const config: RedesConfig = adminProfile?.configuracion?.redes_sociales ?? {};

  // Build post text
  const fecha = new Date(evento.fecha).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const lugarTxt = evento.lugar ? `\n📍 ${evento.lugar}` : "";
  const precioTxt = evento.gratuito ? "\n✅ Gratuito" : evento.precio_entrada ? `\n💰 $${evento.precio_entrada}` : "";
  const linkTxt = evento.link_externo ? `\n🔗 ${evento.link_externo}` : "";
  const text = `📅 ${evento.titulo}\n\n${evento.descripcion ? evento.descripcion.slice(0, 200) + (evento.descripcion.length > 200 ? "..." : "") : ""}\n\n🗓️ ${fecha}${lugarTxt}${precioTxt}${linkTxt}\n\n#GFI #GrupoForoInmobiliario #Inmobiliaria #Evento`;

  const imageUrl = evento.imagen_url ?? null;

  const [fb, ig, tw, tt] = await Promise.allSettled([
    postFacebook(config, text, imageUrl),
    postInstagram(config, text, imageUrl),
    postTwitter(config, text),
    postTikTok(config, text),
  ]);

  const resultados = {
    facebook: fb.status === "fulfilled" ? fb.value : { ok: false, error: "Error inesperado" },
    instagram: ig.status === "fulfilled" ? ig.value : { ok: false, error: "Error inesperado" },
    twitter: tw.status === "fulfilled" ? tw.value : { ok: false, error: "Error inesperado" },
    tiktok: tt.status === "fulfilled" ? tt.value : { ok: false, error: "Error inesperado" },
  };

  return NextResponse.json({ ok: true, resultados });
}
