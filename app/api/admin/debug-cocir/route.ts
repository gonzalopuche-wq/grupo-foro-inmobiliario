import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

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
const HEADERS_AJAX = {
  ...HEADERS_HTML,
  "Content-Type": "application/x-www-form-urlencoded",
  "X-Requested-With": "XMLHttpRequest",
  "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
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

async function probeUrl(url: string, method: string, body?: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? HEADERS_AJAX : HEADERS_HTML,
      ...(body !== undefined ? { body } : {}),
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    const $p = cheerio.load(text.includes("<table") ? text : `<table>${text}</table>`);
    return {
      url, method, status: res.status, len: text.length,
      contentType: res.headers.get("content-type"),
      tables: $p("table").length,
      trs: $p("table tr").length,
      tds: $p("table td").length,
      fullBody: text,
    };
  } catch (e: unknown) {
    return { url, method, error: String(e) };
  }
}

export async function GET(req: NextRequest) {
  if (!(await authorizado(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Obtener página principal ──
  let html = "";
  let fetchInfo: Record<string, unknown> = {};
  for (const url of ["https://cocir.org.ar/paginas/matriculados", "https://www.cocir.org.ar/paginas/matriculados"]) {
    try {
      const res = await fetch(url, { headers: HEADERS_HTML, signal: AbortSignal.timeout(15000) });
      html = await res.text();
      fetchInfo = { url, status: res.status, contentType: res.headers.get("content-type"), htmlLen: html.length };
      if (res.ok && html.length > 1000) break;
    } catch (e: unknown) {
      fetchInfo = { url, error: String(e) };
    }
  }

  const $ = cheerio.load(html);

  // ── 2. Extraer TODOS los scripts buscando URLs AJAX ──
  const ajaxUrls: string[] = [];
  const scriptsSospechosos: Array<{ len: number; preview: string; ajaxUrlsEncontrados: string[] }> = [];

  $("script").each((_, s) => {
    const c = $(s).html() ?? "";
    if (c.length < 50) return;

    // Extraer todas las URLs mencionadas en el script
    const urlsEnScript: string[] = [];
    const urlRegex = /(?:url\s*:\s*["'`]([^"'`]+)["'`]|url\s*:\s*(["'`][^"'`]+["'`])|\bfetch\s*\(\s*["'`]([^"'`]+)["'`])/g;
    let m;
    while ((m = urlRegex.exec(c)) !== null) {
      const found = m[1] || m[3];
      if (found) { urlsEnScript.push(found); ajaxUrls.push(found); }
    }

    const esSospechoso = c.toLowerCase().includes("matricul") || c.includes("BuscarMatriculados") || urlsEnScript.length > 0;
    if (esSospechoso) {
      scriptsSospechosos.push({ len: c.length, preview: c, ajaxUrlsEncontrados: urlsEnScript });
    }
  });

  // ── 3. Buscar el div #listado en el HTML ──
  const listadoIdx = html.indexOf("listado");
  const htmlListado = listadoIdx > -1 ? html.slice(Math.max(0, listadoIdx - 200), listadoIdx + 2000) : "(no encontrado)";

  // ── 4. Sección media de la página (chars 30000-50000) donde suele estar el contenido ──
  const htmlMedio = html.slice(30000, 45000);

  // ── 5. PHP directo — respuesta COMPLETA (no truncada) ──
  const phpBase = "https://cocir.org.ar/webfiles/cocir/actualizar/matriculados.php";
  const [phpGet, phpPostVacio, phpPostA] = await Promise.all([
    probeUrl(phpBase, "GET"),
    probeUrl(phpBase, "POST", "buscar="),
    probeUrl(phpBase, "POST", "buscar=A"),
  ]);

  // ── 6. Probar URLs alternativas del CMS COCIR ──
  const urlsAlternativas = [
    "https://cocir.org.ar/?m=matriculados&buscar=A",
    "https://cocir.org.ar/?p=matriculados&buscar=A",
    "https://cocir.org.ar/webfiles/cocir/actualizar/listar_matriculados.php",
    "https://cocir.org.ar/webfiles/cocir/actualizar/buscar_matriculados.php",
    "https://cocir.org.ar/paginas/matriculados?buscar=A",
  ];
  const altResults = await Promise.all(
    urlsAlternativas.map(u => probeUrl(u, "GET").then(r => ({ ...r, fullBody: String(r.fullBody ?? "").slice(0, 1000) })))
  );

  return NextResponse.json({
    ok: true,
    fetchInfo,
    ajaxUrlsEncontradas: [...new Set(ajaxUrls)],
    scriptsSospechosos: scriptsSospechosos.map(s => ({ ...s, preview: s.preview })),
    htmlListado,
    htmlMedio,
    phpGet: { ...phpGet, fullBody: String(phpGet.fullBody ?? "") },
    phpPostVacio: { ...phpPostVacio, fullBody: String(phpPostVacio.fullBody ?? "") },
    phpPostA: { ...phpPostA, fullBody: String(phpPostA.fullBody ?? "") },
    urlsAlternativas: altResults,
  });
}
