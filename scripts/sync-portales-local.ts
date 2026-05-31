/**
 * sync-portales-local.ts v2
 *
 * Corre desde tu PC (IP residencial) y guarda en Supabase.
 * Usa Playwright (browser real) para Zonaprop y Argenprop → bypasea Cloudflare.
 * Usa la API pública de ML directamente.
 *
 * INSTALACIÓN (una sola vez):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * USO:
 *   npx tsx scripts/sync-portales-local.ts
 *
 * Para correr automáticamente (Windows Task Scheduler o crontab en Mac/Linux):
 *   Mac/Linux: crontab -e → 0 3 * * * cd /ruta && npx tsx scripts/sync-portales-local.ts >> /tmp/sync.log 2>&1
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

// ── MercadoLibre (API pública) ────────────────────────────────────────────────

async function getMLToken(): Promise<string | null> {
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) return null;
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/oauth/token?grant_type=client_credentials&client_id=${ML_CLIENT_ID}&client_secret=${ML_CLIENT_SECRET}`,
      { method: "POST" }
    );
    if (!res.ok) {
      const body = await res.text();
      console.warn(`  ⚠️ ML token HTTP ${res.status}: ${body.slice(0, 150)}`);
      return null;
    }
    const d = await res.json();
    return d.access_token ?? null;
  } catch (e: any) {
    console.warn("  ⚠️ ML token error:", e.message);
    return null;
  }
}

function normalizeML(item: any): any {
  const attrs = item.attributes ?? [];
  const ga = (id: string) => attrs.find((a: any) => a.id === id)?.value_name ?? null;
  return {
    portal_id: String(item.id),
    url: item.permalink ?? "",
    titulo: item.title ?? "",
    operacion: (ga("OPERATION") ?? "").toLowerCase().includes("alquiler") ? "alquiler" : "venta",
    tipo: (ga("PROPERTY_TYPE") ?? "otro").toLowerCase(),
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
    datos_raw: {},
  };
}

async function syncML(): Promise<any[]> {
  const ROSARIO_LAT = "-33.0394_-32.8717";
  const ROSARIO_LON = "-60.7961_-60.6122";

  const strategies = [
    // Sin token primero (endpoint público ML)
    { url: `https://api.mercadolibre.com/sites/MLA/search?category=MLA1459&city=TUxBQUMxMjg3NTU&limit=50`, needsToken: false },
    { url: `https://api.mercadolibre.com/sites/MLA/search?category=MLA1459&item_location=lat:${ROSARIO_LAT},lon:${ROSARIO_LON}&limit=50`, needsToken: false },
    // Con token como fallback
    { url: `https://api.mercadolibre.com/sites/MLA/search?category=MLA1459&city=TUxBQUMxMjg3NTU&limit=50`, needsToken: true },
    { url: `https://api.mercadolibre.com/sites/MLA/search?category=MLA1459&item_location=lat:${ROSARIO_LAT},lon:${ROSARIO_LON}&limit=50`, needsToken: true },
  ];

  let token: string | null = null;

  for (const { url: baseUrl, needsToken } of strategies) {
    if (needsToken && !token) {
      token = await getMLToken();
      if (token) console.log("  🔑 Usando token ML");
      else { console.warn("  ⚠️ No se pudo obtener token ML"); continue; }
    }

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
    };
    if (needsToken && token) headers["Authorization"] = `Bearer ${token}`;

    const strategyLabel = (needsToken ? "[+token] " : "[sin auth] ") + baseUrl.split("?")[1]?.slice(0, 50);
    const all: any[] = [];
    let offset = 0;
    let blocked = false;

    while (all.length < 500) {
      const res = await fetch(`${baseUrl}&offset=${offset}`, { headers });
      if (!res.ok) {
        const body = await res.text();
        console.warn(`  ⚠️ ML HTTP ${res.status} para ${strategyLabel}`);
        if (res.status === 403) console.warn(`  🔍 Respuesta ML: ${body.slice(0, 200)}`);
        blocked = true;
        break;
      }
      const data = await res.json();
      const items = data.results ?? [];
      if (!items.length) break;
      all.push(...items.map((item: any) => normalizeML(item)));
      offset += 50;
      if (offset >= Math.min(data.paging?.total ?? 0, 500)) break;
    }

    if (!blocked && all.length > 0) {
      console.log(`  ✅ ML: ${all.length} propiedades (${strategyLabel})`);
      return all;
    }
  }
  return [];
}

// ── Playwright helper ─────────────────────────────────────────────────────────

let _playwright: any = null;

async function getPlaywright(): Promise<any | null> {
  if (_playwright) return _playwright;
  try {
    _playwright = await import("playwright");
    return _playwright;
  } catch {
    return null;
  }
}

async function scrapeNextData(page: any, url: string): Promise<any | null> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Esperar a que cargue el contenido (puede haber Cloudflare challenge)
    await page.waitForFunction(
      () => !!document.getElementById("__NEXT_DATA__"),
      { timeout: 20000 }
    ).catch(() => null);
    return await page.evaluate(() => {
      const el = document.getElementById("__NEXT_DATA__");
      if (!el?.textContent) return null;
      try { return JSON.parse(el.textContent); } catch { return null; }
    });
  } catch {
    return null;
  }
}

// ── Zonaprop ──────────────────────────────────────────────────────────────────

function extractZonapropPostings(nd: any, operacion: string, tipo: string): any[] {
  const pp = nd?.props?.pageProps;
  const postings = pp?.initialData?.postings ?? pp?.listingData?.postings ?? pp?.postings ?? [];
  const result: any[] = [];
  for (const item of postings) {
    const posting = item.postingData ?? item;
    const priceData = posting.priceOperationTypes?.[0] ?? {};
    const loc = posting.postingLocation ?? posting.location ?? {};
    const geo = loc.postingGeolocation ?? {};
    const imgs = (posting.postingGallery ?? posting.photos ?? [])
      .map((p: any) => p.url ?? p.image ?? p).filter((u: any) => typeof u === "string" && u.startsWith("http"));
    result.push({
      portal_id: String(item.postingId ?? item.id),
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
    });
  }
  return result;
}

async function syncZonaprop(): Promise<any[]> {
  const pw = await getPlaywright();
  if (!pw) {
    console.warn("  ⚠️ Playwright no instalado. Corré: npm install playwright && npx playwright install chromium");
    return [];
  }

  const SLUGS = ["departamentos", "casas", "ph"];
  const OPS = [{ slug: "venta", op: "venta" }, { slug: "alquiler", op: "alquiler" }];

  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "es-AR",
  });
  const all: any[] = [];

  try {
    const page = await context.newPage();
    for (const tipo of SLUGS) {
      for (const { slug, op } of OPS) {
        for (let pg = 1; pg <= 3; pg++) {
          const suffix = pg > 1 ? `-pagina-${pg}` : "";
          const url = `https://www.zonaprop.com.ar/${tipo}-${slug}-rosario${suffix}.html`;
          const nd = await scrapeNextData(page, url);
          if (!nd) { console.warn(`  ⚠️ ZP sin datos: ${tipo}-${slug} p${pg}`); break; }
          const items = extractZonapropPostings(nd, op, tipo);
          if (!items.length) break;
          all.push(...items);
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

function extractArgenpropItems(nd: any, operacion: string, tipo: string): any[] {
  const pp = nd?.props?.pageProps;
  const items = pp?.initialData?.listingResults ?? pp?.listingResults ?? pp?.listings ?? [];
  return items.map((item: any) => {
    const imgs = (item.photos ?? item.images ?? [])
      .map((p: any) => p.image ?? p.url ?? p).filter((u: any) => typeof u === "string" && u.startsWith("http"));
    return {
      portal_id: String(item.id ?? item.postingId),
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
    console.warn("  ⚠️ Playwright no instalado. Corré: npm install playwright && npx playwright install chromium");
    return [];
  }

  const TIPOS = ["departamentos", "casas", "ph"];
  const OPS = [{ slug: "venta", op: "venta" }, { slug: "alquiler", op: "alquiler" }];

  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "es-AR",
  });
  const all: any[] = [];

  try {
    const page = await context.newPage();
    for (const tipo of TIPOS) {
      for (const { slug, op } of OPS) {
        for (let pg = 1; pg <= 3; pg++) {
          const pageSuffix = pg > 1 ? `-pagina-${pg}` : "";
          const url = `https://www.argenprop.com/${tipo}/${slug}/rosario${pageSuffix}`;
          const nd = await scrapeNextData(page, url);
          if (!nd) { console.warn(`  ⚠️ AP sin datos: ${tipo}-${slug} p${pg}`); break; }
          const items = extractArgenpropItems(nd, op, tipo);
          if (!items.length) break;
          all.push(...items);
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
    process.stdout.write(`Sincronizando ${nombre}... \n`);
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
