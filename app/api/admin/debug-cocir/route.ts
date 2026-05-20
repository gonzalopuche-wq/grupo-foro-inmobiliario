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

function extraerArrayBalanceado(src: string, startIdx: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < Math.min(src.length, startIdx + 800_000); i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === "\\" && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  return null;
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

  let html = "";
  let fetchInfo: Record<string, unknown> = {};

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: HEADERS_HTML });
      html = await res.text();
      fetchInfo = {
        url,
        status: res.status,
        contentType: res.headers.get("content-type"),
        htmlLen: html.length,
      };
      if (res.ok && html.length > 1000) break;
    } catch (e: unknown) {
      fetchInfo = { url, error: String(e) };
    }
  }

  if (!html) {
    return NextResponse.json({ ok: false, error: "No se pudo obtener HTML", fetchInfo });
  }

  const $ = cheerio.load(html);

  // Analizar tablas
  const tablasInfo: Record<string, unknown>[] = [];
  $("table").each((idx, tabla) => {
    if (idx >= 5) return;
    const $t = $(tabla);

    const columnas: string[] = [];
    $t.find("thead tr th, thead tr td").each((_, c) => { columnas.push($(c).text().trim()); });

    const primeras5Filas: Array<{ tipo: string; celdas: string[] }> = [];
    $t.find("tr").each((ri, tr) => {
      if (ri >= 5) return;
      const celdas: string[] = [];
      $(tr).find("td, th").each((_, c) => { celdas.push($(c).text().trim().slice(0, 80)); });
      primeras5Filas.push({ tipo: $(tr).find("th").length > 0 ? "th" : "td", celdas });
    });

    tablasInfo.push({
      idx,
      id: $t.attr("id") ?? null,
      class: $t.attr("class") ?? null,
      trs: $t.find("tr").length,
      tds: $t.find("td").length,
      ths: $t.find("th").length,
      theads: $t.find("thead").length,
      tbodies: $t.find("tbody").length,
      columnas,
      primeras5Filas,
      htmlPrimeros2000: $.html($t).slice(0, 2000),
    });
  });

  // Analizar script tags con datos
  const scriptsConDatos: Array<{ len: number; tieneDataTable: boolean; tieneData: boolean; preview: string; datosExtraidos: unknown }> = [];
  $("script").each((_, s) => {
    const c = $(s).html() ?? "";
    if (c.length < 100) return;

    const tieneDataTable = c.includes("DataTable") || c.includes("dataTable");
    const tieneData = /"data"\s*:\s*\[/.test(c) || /\bdata\s*:\s*\[/.test(c);
    const tieneMatricula = c.toLowerCase().includes("matricul");

    if (!tieneDataTable && !tieneData && !tieneMatricula && c.length < 2000) return;

    let datosExtraidos: unknown = null;
    const idxData = c.search(/"data"\s*:\s*\[|\bdata\s*:\s*\[/);
    if (idxData !== -1) {
      const arrStart = c.indexOf("[", idxData);
      if (arrStart !== -1) {
        const raw = extraerArrayBalanceado(c, arrStart);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              datosExtraidos = { length: arr.length, primeros2: arr.slice(0, 2) };
            }
          } catch (e) {
            datosExtraidos = { parseError: String(e), raw: raw.slice(0, 200) };
          }
        }
      }
    }

    scriptsConDatos.push({
      len: c.length,
      tieneDataTable,
      tieneData,
      preview: c.slice(0, 1500),
      datosExtraidos,
    });
  });

  // HTML alrededor del cuerpo (saltando el head)
  const bodyStart = html.indexOf("<body");
  const htmlBody = bodyStart !== -1 ? html.slice(bodyStart, bodyStart + 6000) : html.slice(1500, 7500);

  // Probar el PHP AJAX endpoint directamente (es la fuente real de datos)
  const AJAX_PHP_URLS = [
    "https://cocir.org.ar/webfiles/cocir/actualizar/matriculados.php",
    "https://www.cocir.org.ar/webfiles/cocir/actualizar/matriculados.php",
  ];
  const HEADERS_AJAX = {
    ...HEADERS_HTML,
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
  };

  type PhpResult = { url: string; method: string; buscar?: string; status?: number; len?: number; tables?: number; trs?: number; tds?: number; preview?: string; error?: string };
  const phpResults: PhpResult[] = [];

  // GET sin params (igual que antes)
  for (const ajaxUrl of AJAX_PHP_URLS.slice(0, 1)) {
    try {
      const res = await fetch(ajaxUrl, { headers: HEADERS_HTML, signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      const $p = cheerio.load(body.includes("<table") ? body : `<table>${body}</table>`);
      phpResults.push({ url: ajaxUrl, method: "GET", status: res.status, len: body.length, tables: $p("table").length, trs: $p("table tr").length, tds: $p("table td").length, preview: body.slice(0, 800) });
    } catch (e: unknown) {
      phpResults.push({ url: ajaxUrl, method: "GET", error: String(e) });
    }
  }

  // POST buscar= (vacío) — podría devolver todos los registros
  for (const ajaxUrl of AJAX_PHP_URLS.slice(0, 1)) {
    try {
      const res = await fetch(ajaxUrl, { method: "POST", headers: HEADERS_AJAX, body: "buscar=", signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      const $p = cheerio.load(body.includes("<table") ? body : `<table>${body}</table>`);
      phpResults.push({ url: ajaxUrl, method: "POST", buscar: "(vacío)", status: res.status, len: body.length, tables: $p("table").length, trs: $p("table tr").length, tds: $p("table td").length, preview: body.slice(0, 800) });
    } catch (e: unknown) {
      phpResults.push({ url: ajaxUrl, method: "POST", buscar: "(vacío)", error: String(e) });
    }
  }

  // POST buscar=A — debería devolver filas con apellido A
  for (const ajaxUrl of AJAX_PHP_URLS.slice(0, 1)) {
    try {
      const res = await fetch(ajaxUrl, { method: "POST", headers: HEADERS_AJAX, body: "buscar=A", signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      const $p = cheerio.load(body.includes("<table") ? body : `<table>${body}</table>`);
      phpResults.push({ url: ajaxUrl, method: "POST", buscar: "A", status: res.status, len: body.length, tables: $p("table").length, trs: $p("table tr").length, tds: $p("table td").length, preview: body.slice(0, 800) });
    } catch (e: unknown) {
      phpResults.push({ url: ajaxUrl, method: "POST", buscar: "A", error: String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    fetchInfo,
    phpAjax: phpResults,
    cheerio: {
      totalTablas: $("table").length,
      totalTrs: $("table tr").length,
      totalTds: $("table td").length,
      totalThs: $("table th").length,
      tablasInfo,
      scriptsConDatos,
    },
    htmlBody,
  });
}
