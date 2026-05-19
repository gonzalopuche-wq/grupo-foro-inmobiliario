import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HEADERS_HTML = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
  "Referer": "https://cocir.org.ar/",
};

async function authorizado(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const token = auth?.replace("Bearer ", "");
  if (!token) return false;
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return false;
  const { data: p } = await sb.from("perfiles").select("tipo").eq("id", data.user.id).single();
  return p?.tipo === "admin";
}

export async function GET(req: NextRequest) {
  if (!(await authorizado(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const urls = [
    "https://cocir.org.ar/paginas/matriculados",
    "https://www.cocir.org.ar/paginas/matriculados",
    "https://cocir.org.ar/matriculados",
  ];

  const resultados: Record<string, unknown>[] = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: HEADERS_HTML });
      const html = await res.text();
      resultados.push({
        url,
        status: res.status,
        contentType: res.headers.get("content-type"),
        htmlLen: html.length,
        htmlPrimeros1500: html.slice(0, 1500),
      });
      if (res.ok) break;
    } catch (e: unknown) {
      resultados.push({ url, error: String(e) });
    }
  }

  // También probar endpoint DataTables
  const dtUrls = [
    "https://cocir.org.ar/paginas/matriculados?draw=1&start=0&length=50",
    "https://cocir.org.ar/api/matriculados",
    "https://cocir.org.ar/paginas/matriculados/data",
  ];

  const dtResultados: Record<string, unknown>[] = [];
  for (const url of dtUrls) {
    try {
      const res = await fetch(url, {
        headers: { ...HEADERS_HTML, "X-Requested-With": "XMLHttpRequest", "Accept": "application/json, text/javascript, */*; q=0.01" },
      });
      const text = await res.text();
      dtResultados.push({
        url,
        status: res.status,
        contentType: res.headers.get("content-type"),
        respLen: text.length,
        respInicio: text.slice(0, 500),
      });
    } catch (e: unknown) {
      dtResultados.push({ url, error: String(e) });
    }
  }

  return NextResponse.json({ ok: true, html: resultados, datatables: dtResultados });
}
