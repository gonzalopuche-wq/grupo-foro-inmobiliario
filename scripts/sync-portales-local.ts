/**
 * sync-portales-local.ts v4
 *
 * Usa Playwright para interceptar las llamadas XHR de Zonaprop/Argenprop.
 * Zonaprop y Argenprop cargan listings via API client-side (no SSR).
 *
 * INSTALACIÓN (una sola vez):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * USO:
 *   npx tsx scripts/sync-portales-local.ts
 *
 * Nota: se va a abrir una ventana de Chrome — es normal, podés minimizarla.
 */

import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";

// ── Cargar .env.local ─────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
    console.log("✅ .env.local cargado");
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}

async function upsertBatch(items: any[], portal: string): Promise<{ importados: number; error?: string }> {
  if (!items.length) return { importados: 0 };
  let importados = 0;
  const BATCH = 50;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map(item => ({
      ...item,
      portal,
      activa: true,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await sb.from("propiedades_externas").upsert(batch, { onConflict: "portal,portal_id" });
    if (error) return { importados, error: error.message };
    importados += batch.length;
  }
  return { importados };
}

// ── MercadoLibre ──────────────────────────────────────────────────────────────

async function getMLToken(): Promise<string | null> {
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) return null;
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/oauth/token?grant_type=client_credentials&client_id=${ML_CLIENT_ID}&client_secret=${ML_CLIENT_SECRET}`,
      { method: "POST" }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return d.access_token ?? null;
  } catch { return null; }
}

function normalizeML(item: any): any {
  const attrs = item.attributes ?? [];
  const ga = (id: string) => attrs.find((a: any) => a.id === id)?.value_name ?? null;
  if (!ga("PROPERTY_TYPE") && !ga("OPERATION")) return null;
  return {
    portal_id: String(item.id),
    url: item.permalink ?? "",
    titulo: item.title ?? "",
    operacion: (ga("OPERATION") ?? "").toLowerCase().includes("alquiler") ? "alquiler" : "venta",
    tipo: (ga("PROPERTY_TYPE") ?? "otro").toLowerCase() || "otro",
    precio: parseNum(item.price),
    moneda: item.currency_id === "ARS" ? "ARS" : "USD",
    dormitorios: parseNum(ga("BEDROOMS")),
    banos: parseNum(ga("BATHROOMS")),
    ambientes: parseNum(ga("ROOMS")),
    superficie_cubierta: parseNum(ga("COVERED_AREA")?.replace(/[^\d.]/g, "")),
    sup_terreno: parseNum(ga("TOTAL_AREA")?.replace(/[^\d.]/g, "")),
    expensas: null,
    barrio: item.location?.neighborhood?.name ?? null,
    ciudad: item.location?.city?.name ?? "Rosario",
    provincia: item.location?.state?.name ?? "Santa Fe",
    direccion: item.location?.address_line ?? null,
    lat: parseNum(item.location?.latitude),
    lng: parseNum(item.location?.longitude),
    imagenes: (item.pictures ?? []).map((p: any) => p.secure_url ?? p.url ?? "").filter(Boolean),
    descripcion: null,
    datos_raw: { category_id: item.category_id },
  };
}

async function syncML(): Promise<any[]> {
  // ML bloquea category=MLA1459 sin permisos especiales de app.
  // Intentamos text search sin categoría.
  const token = await getMLToken();
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const queries = ["departamento venta rosario", "casa venta rosario", "departamento alquiler rosario"];
  const all: any[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    const base = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(q)}&limit=50`;
    const res = await fetch(`${base}&offset=0`, { headers });
    if (!res.ok) {
      console.warn(`  ⚠️ ML bloqueado (HTTP ${res.status}) — saltear ML, usar Zonaprop/Argenprop`);
      return [];
    }
    const data = await res.json();
    for (const item of data.results ?? []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const norm = normalizeML(item);
      if (norm) all.push(norm);
    }
  }
  return all;
}

// ── Playwright ────────────────────────────────────────────────────────────────

async function getPlaywright(): Promise<any | null> {
  try { return await import("playwright"); } catch { return null; }
}

async function createBrowser(pw: any) {
  const browser = await pw.chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--disable-infobars"],
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "es-AR",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "Accept-Language": "es-AR,es;q=0.9" },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });
  return { browser, context };
}

function hasListingData(json: any): boolean {
  return !!(
    (Array.isArray(json.postings) && json.postings.length > 0) ||
    (Array.isArray(json.initialData?.postings) && json.initialData.postings.length > 0) ||
    (Array.isArray(json.listingData?.postings) && json.listingData.postings.length > 0) ||
    (Array.isArray(json.data?.postings) && json.data.postings.length > 0) ||
    (Array.isArray(json.listings) && json.listings.length > 0) ||
    (Array.isArray(json.listingResults) && json.listingResults.length > 0) ||
    (Array.isArray(json.data?.listings) && json.data.listings.length > 0) ||
    (Array.isArray(json.results) && json.results.length > 0 && json.results[0]?.postingId)
  );
}

// Navega a una URL, espera a que el challenge de Cloudflare pase,
// intercepta TODAS las respuestas JSON y devuelve la que tenga listings.
async function scrapeListingsFromPage(page: any, url: string): Promise<any | null> {
  const captured: any[] = [];

  const onResponse = async (response: any) => {
    const status = response.status();
    if (status < 200 || status >= 300) return;
    try {
      const text = await response.text();
      // Aceptar cualquier texto que empiece con { o [ (no filtrar por content-type)
      if (!text || (text[0] !== "{" && text[0] !== "[")) return;
      const json = JSON.parse(text);
      if (hasListingData(json)) captured.push(json);
    } catch { /* ignorar */ }
  };

  page.on("response", onResponse);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch { /* timeout ok */ }

  // Polling: esperar a que el challenge de CF pase y la página real cargue (max 35s)
  for (let i = 0; i < 35; i++) {
    const title = await page.title().catch(() => "");
    const cfPasado = title.length > 10 &&
      !title.toLowerCase().includes("just a moment") &&
      !title.toLowerCase().includes("cloudflare") &&
      !title.toLowerCase().includes("attention required");
    if (cfPasado) break;
    await page.waitForTimeout(1000);
  }

  // Esperar a que los XHR de listings completen
  await page.waitForTimeout(4000);

  page.off("response", onResponse);

  const title = await page.title().catch(() => "");
  if (captured.length > 0) {
    process.stdout.write(`    📡 XHR capturado (${title.slice(0, 50)})\n`);
    return captured[0];
  }

  // Fallback: __NEXT_DATA__
  const nd = await page.evaluate(() => {
    const el = document.getElementById("__NEXT_DATA__");
    if (!el?.textContent) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  }).catch(() => null);

  if (!nd) {
    process.stdout.write(`    ⚠️ Sin datos (título: "${title.slice(0, 60)}")\n`);
  }
  return nd;
}

// ── Zonaprop ──────────────────────────────────────────────────────────────────

function extractZonapropPostings(data: any, operacion: string, tipo: string): any[] {
  // Soporta múltiples formatos de respuesta (SSR via __NEXT_DATA__ o XHR)
  const postings: any[] =
    data?.postings ??
    data?.initialData?.postings ??
    data?.listingData?.postings ??
    data?.props?.pageProps?.initialData?.postings ??
    data?.props?.pageProps?.postings ??
    [];

  return postings.map((item: any) => {
    const posting = item.postingData ?? item;
    const priceData = posting.priceOperationTypes?.[0] ?? {};
    const loc = posting.postingLocation ?? posting.location ?? {};
    const geo = loc.postingGeolocation ?? {};
    const imgs = (posting.postingGallery ?? posting.photos ?? [])
      .map((p: any) => p.url ?? p.image ?? p)
      .filter((u: any) => typeof u === "string" && u.startsWith("http"));
    return {
      portal_id: String(item.postingId ?? item.id ?? Math.random()),
      url: `https://www.zonaprop.com.ar${posting.url ?? ""}`,
      titulo: posting.title ?? "",
      operacion,
      tipo,
      precio: parseNum(priceData.price ?? posting.price),
      moneda: (priceData.currency ?? "USD") === "ARS" ? "ARS" : "USD",
      dormitorios: parseNum(posting.mainFeatures?.BEDROOMS?.value),
      banos: parseNum(posting.mainFeatures?.BATHROOMS?.value),
      ambientes: parseNum(posting.mainFeatures?.ROOMS?.value),
      superficie_cubierta: parseNum(posting.mainFeatures?.COVERED_AREA?.value),
      sup_terreno: parseNum(posting.mainFeatures?.TOTAL_AREA?.value),
      expensas: parseNum(priceData.expenses),
      barrio: loc.subdivision?.name ?? null,
      ciudad: loc.city?.name ?? "Rosario",
      provincia: "Santa Fe",
      direccion: posting.address ?? null,
      lat: parseNum(geo.latitude),
      lng: parseNum(geo.longitude),
      imagenes: imgs,
      descripcion: posting.description ?? null,
      datos_raw: {},
    };
  });
}

async function syncZonaprop(): Promise<any[]> {
  const pw = await getPlaywright();
  if (!pw) {
    console.warn("  ⚠️ Playwright no instalado: npm install playwright && npx playwright install chromium");
    return [];
  }

  console.log("  ℹ️ Abriendo Chrome para Zonaprop (ventana visible, podés minimizarla)");
  const { browser, context } = await createBrowser(pw);
  const all: any[] = [];

  const SLUGS = [
    { tipo: "departamentos", path: "departamentos" },
    { tipo: "casas", path: "casas" },
    { tipo: "ph", path: "ph" },
    { tipo: "locales", path: "locales-comerciales" },
    { tipo: "terrenos", path: "terrenos" },
  ];
  const OPS = [{ slug: "venta", op: "venta" }, { slug: "alquiler", op: "alquiler" }];

  try {
    const page = await context.newPage();
    for (const { tipo, path: tipoPath } of SLUGS) {
      for (const { slug, op } of OPS) {
        for (let pg = 1; pg <= 3; pg++) {
          const suffix = pg > 1 ? `-pagina-${pg}` : "";
          const url = `https://www.zonaprop.com.ar/${tipoPath}-${slug}-rosario${suffix}.html`;
          const data = await scrapeListingsFromPage(page, url);
          if (!data) {
            console.warn(`  ⚠️ ZP sin datos: ${tipo}-${op} p${pg}`);
            break;
          }
          const items = extractZonapropPostings(data, op, tipo);
          if (!items.length) {
            console.warn(`  ⚠️ ZP 0 items extraídos: ${tipo}-${op} p${pg} (keys: ${Object.keys(data).slice(0, 6).join(",")})`);
            break;
          }
          all.push(...items);
          process.stdout.write(`  ↳ ZP ${tipo}-${op} p${pg}: ${items.length} props\n`);
          if (items.length < 20) break;
        }
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }

  return all;
}

// ── Argenprop ─────────────────────────────────────────────────────────────────

function extractArgenpropItems(data: any, operacion: string, tipo: string): any[] {
  const items: any[] =
    data?.listingResults ??
    data?.initialData?.listingResults ??
    data?.props?.pageProps?.initialData?.listingResults ??
    data?.props?.pageProps?.listingResults ??
    data?.listings ??
    [];

  return items.map((item: any) => {
    const imgs = (item.photos ?? item.images ?? [])
      .map((p: any) => p.image ?? p.url ?? p)
      .filter((u: any) => typeof u === "string" && u.startsWith("http"));
    return {
      portal_id: String(item.id ?? item.postingId ?? Math.random()),
      url: item.url ? `https://www.argenprop.com${item.url}` : "",
      titulo: item.title ?? item.headline ?? "",
      operacion,
      tipo,
      precio: parseNum(typeof item.price === "object" ? item.price?.amount : item.price),
      moneda: (item.currency === "ARS" || item.currency === "$") ? "ARS" : "USD",
      dormitorios: parseNum(item.bedrooms ?? item.rooms),
      banos: parseNum(item.bathrooms),
      ambientes: parseNum(item.ambiences ?? item.environments),
      superficie_cubierta: parseNum(item.coveredSurface ?? item.coveredArea),
      sup_terreno: parseNum(item.totalSurface ?? item.totalArea),
      expensas: parseNum(item.expenses),
      barrio: item.neighborhood ?? null,
      ciudad: item.city ?? "Rosario",
      provincia: "Santa Fe",
      direccion: item.address ?? null,
      lat: parseNum(item.lat),
      lng: parseNum(item.lng),
      imagenes: imgs,
      descripcion: item.description ?? null,
      datos_raw: {},
    };
  });
}

async function syncArgenprop(): Promise<any[]> {
  const pw = await getPlaywright();
  if (!pw) {
    console.warn("  ⚠️ Playwright no instalado: npm install playwright && npx playwright install chromium");
    return [];
  }

  console.log("  ℹ️ Abriendo Chrome para Argenprop (ventana visible, podés minimizarla)");
  const { browser, context } = await createBrowser(pw);
  const all: any[] = [];

  const TIPOS = [
    { tipo: "departamentos", path: "departamentos" },
    { tipo: "casas", path: "casas" },
    { tipo: "ph", path: "ph" },
    { tipo: "locales", path: "locales-comerciales" },
    { tipo: "terrenos", path: "terrenos" },
  ];
  const OPS = [{ slug: "venta", op: "venta" }, { slug: "alquiler", op: "alquiler" }];

  try {
    const page = await context.newPage();
    for (const { tipo, path: tipoPath } of TIPOS) {
      for (const { slug, op } of OPS) {
        for (let pg = 1; pg <= 3; pg++) {
          const pageSuffix = pg > 1 ? `-pagina-${pg}` : "";
          const url = `https://www.argenprop.com/${tipoPath}/${slug}/rosario${pageSuffix}`;
          const data = await scrapeListingsFromPage(page, url);
          if (!data) {
            console.warn(`  ⚠️ AP sin datos: ${tipo}-${op} p${pg}`);
            break;
          }
          const items = extractArgenpropItems(data, op, tipo);
          if (!items.length) {
            console.warn(`  ⚠️ AP 0 items: ${tipo}-${op} p${pg} (keys: ${Object.keys(data).slice(0, 6).join(",")})`);
            break;
          }
          all.push(...items);
          process.stdout.write(`  ↳ AP ${tipo}-${op} p${pg}: ${items.length} props\n`);
          if (items.length < 20) break;
        }
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }

  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const portales: Array<{ nombre: string; fn: () => Promise<any[]>; portal: string }> = [
  { nombre: "MercadoLibre", fn: syncML, portal: "mercadolibre" },
  { nombre: "Zonaprop", fn: syncZonaprop, portal: "zonaprop" },
  { nombre: "Argenprop", fn: syncArgenprop, portal: "argenprop" },
];

async function main() {
  console.log(`\n🔄 Sync portales externos — ${new Date().toLocaleString("es-AR")}\n`);

  const resultados: Record<string, any> = {};

  for (const { nombre, fn, portal } of portales) {
    console.log(`\nSincronizando ${nombre}...`);
    try {
      const items = await fn();
      if (!items.length) {
        console.log(`⚠️  0 propiedades en ${nombre}`);
        resultados[portal] = { importados: 0, error: "0 propiedades encontradas" };
        continue;
      }
      const { importados, error } = await upsertBatch(items, portal);
      if (error) {
        console.log(`❌ Error al guardar ${nombre}: ${error}`);
        resultados[portal] = { importados, error };
      } else {
        console.log(`✅ ${nombre}: ${importados} propiedades importadas`);
        resultados[portal] = { importados };
      }
    } catch (e: any) {
      console.log(`❌ ${nombre}: ${e.message}`);
      resultados[portal] = { importados: 0, error: e.message };
    }
  }

  console.log("\n═══ RESUMEN ═══");
  let total = 0;
  for (const [portal, r] of Object.entries(resultados)) {
    console.log(`  ${portal}: ${r.importados} importadas${r.error ? ` (⚠️ ${r.error})` : ""}`);
    total += r.importados;
  }
  console.log(`\n  TOTAL: ${total} propiedades`);
  console.log(`  Fin: ${new Date().toLocaleString("es-AR")}\n`);
}

main().catch(e => { console.error("Error fatal:", e); process.exit(1); });
