import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url requerida" }, { status: 400 });

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

    const data = {
      title: get("title") || titleTag,
      description: get("description"),
      image: get("image"),
      siteName: get("site_name"),
      url,
    };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ url }, { status: 200 });
  }
}
