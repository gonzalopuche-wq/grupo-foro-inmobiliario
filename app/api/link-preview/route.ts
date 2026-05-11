import { NextRequest, NextResponse } from "next/server";

// Block private/internal IP ranges — prevent SSRF
const PRIVATE_IP = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1$|fc|fd)/i;

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (PRIVATE_IP.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url requerida" }, { status: 400 });

  if (!isSafeUrl(url)) {
    return NextResponse.json({ error: "URL no permitida" }, { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GFIBot/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    const get = (prop: string) => {
      const match =
        html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${prop}["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"));
      return match?.[1] ?? null;
    };

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null;

    return NextResponse.json({
      title: get("title") || titleTag,
      description: get("description"),
      image: get("image"),
      siteName: get("site_name"),
      url,
    }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ url }, { status: 200 });
  }
}
