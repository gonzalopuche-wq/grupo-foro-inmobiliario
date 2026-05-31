/**
 * sync-portales-local.ts v3
 *
 * Corre desde tu PC (IP residencial) y guarda en Supabase.
 * Usa Playwright con Chrome visible (headless: false) para Zonaprop y Argenprop.
 * Chrome visible bypasea Cloudflare correctamente.
 *
 * INSTALACIÓN (una sola vez):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * USO:
 *   npx tsx scripts/sync-portales-local.ts
 *
 * Nota: se va a abrir una ventana de Chrome — es normal, la podés minimizar.
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

// ── MercadoLibre (búsqueda por texto — no requiere permisos especiales) ────────

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
  } catch {
    return null;
  }
}

function normalizeML(item: any): any {
  const attrs = item.attributes ?? [];
  const ga = (id: string) => attrs.find((a: any) => a.id === id)?.value_name ?? null;
  const isMueble =
    (item.category_id ?? "").includes("1459") ||
    (ga("PROPERTY_TYPE") ?? "") !== "" ||
    (ga("OPERATION") ?? "") !== "";
  if (!isMueble) return null;
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
  const token = await getMLToken();
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("  🔑 Token ML ok");
  }

  // Búsqueda por texto: no requiere permisos de categoría especiales
  const queries = [
    "departamento venta rosario santa fe",
    "casa venta rosario santa fe",
    "departamento alquiler rosario santa fe",
    "propiedad inmueble rosario",
  ];

  const all: any[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    const base = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(q)}&limit=50`;
    let offset = 0;
    while (all.length < 400) {
      const res = await fetch(`${base}&offset=${offset}`, { headers });
      if (!res.ok) {
        const body = await res.text();
        console.warn(`  ⚠️ ML HTTP ${res.status} para "${q}": ${body.slice(0, 120)}`);
        break;
      }
      const data = await res.json();
      const items: any[] = data.results ?? [];
      if (!items.length) break;
      let added = 0;
      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        const norm = normalizeML(item);
        if (norm) { all.push(norm); added++; }
      }
      offset += 50;
      if (offset >= Math.min(data.paging?.total ?? 0, 400)) break;
    }
  }
  return all;
}

// ── Playwright helper ─────────────────────────────────────────────────────────

async function getPlaywright(): Promise<any | null> {
  try {
    return await import("playwright");
  } catch {
    return null;
  }
}

async function createStealthBrowser(pw: any) {
  const browser = await pw.chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-infobars",
    ],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "es-AR",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "Accept-Language": "es-AR,es;q=0.9" },
  });
  // Ocultar automatización
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });
  return { browser, context };
}

async function scrapeNextData(page: any, url: string): Promise<any | null> {
  try {
    // networkidle: espera hasta que no haya requests por 500ms
    // Esto incluye el tiempo de resolución del challenge de Cloudflare
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    const title = await page.title().catch(() => "");
    if (title.toLowerCase().includes("just a moment") || title.toLowerCase().includes("cloudflare")) {
      console.warn(`    ⚠️ Cloudflare challenge activo, esperando resolución...`);
      // Esperar a que CF resuelva (normalmente 5-10 seg)
      await page
        .waitForFunction(() => !document.title.toLowerCase().includes("just a moment"), { timeout: 30000 })
        .catch(() => null);
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
    }

    return await page.evaluate(() => {
      const el = document.getElementById("__NEXT_DATA__");
      if (!el?.textContent) return null;
      try {
        return JSON.parse(el.textContent);
      } catch {
        return null;
      }
    });
  } catch (e: any) {
    const title = await page.title().catch(() => "?");
    console.warn(`    ⚠️ Error al cargar "${url.split("?")[0].slice(-60)}" (título: "${title}"): ${e.message?.slice(0, 60)}`);
    return null;
  }
}

// ── Zonaprop ──────────────────────────────────────────────────────────────────

function extractZonapropPostings(nd: any, operacion: string, tipo: string): any[] {
  const pp = nd?.props?.pageProps;
  const postings = pp?.initialData?.postings ?? pp?.listingData?.postings ?? pp?.postings ?? [];
  return postings.map((item: any) => {
    const posting = item.postingData ?? item;
    const priceData = posting.priceOperationTypes?.[0] ?? {};
    const loc = posting.postingLocation ?? posting.location ?? {};
    const geo = loc.postingGeolocation ?? {};
    const imgs = (posting.postingGallery ?? posting.photos ?? [])
      .map((p: any) => p.url ?? p.image ?? p)
      .filter((u: any) => typeof u === "string" && u.startsWith("http"));
    return {
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
    };
  });
}

async function syncZonaprop(): Promise<any[]> {
  const pw = await getPlaywright();
  if (!pw) {
    console.warn("  ⚠️ Playwright no instalado. Corré: npm install playwright && npx playwright install chromium");
    return [];
  }

  console.log("  ℹ️ Abriendo Chrome (puede aparecer ventana — podés minimizarla)");
  const { browser, context } = await createStealthBrowser(pw);
  const all: any[] = [];

  const SLUGS = ["departamentos", "casas", "ph", "locales", "terrenos"];
  const OPS = [{ slug: "venta", op: "venta" }, { slug: "alquiler", op: "alquiler" }];

  try {
    const page = await context.newPage();
    for (const tipo of SLUGS) {
      for (const { slug, op } of OPS) {
        for (let pg = 1; pg <= 3; pg++) {
          const suffix = pg > 1 ? `-pagina-${pg}` : "";
          const url = `https://www.zonaprop.com.ar/${tipo}-${slug}-rosario${suffix}.html`;
          const nd = await scrapeNextData(page, url);
          if (!nd) {
            console.warn(`  ⚠️ ZP sin datos: ${tipo}-${slug} p${pg}`);
            break;
          }
          const items = extractZonapropPostings(nd, op, tipo);
          if (!items.length) break;
          all.push(...items);
          process.stdout.write(`  ↳ ZP ${tipo}-${slug} p${pg}: ${items.length} props\n`);
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
      .map((p: any) => p.image ?? p.url ?? p)
      .filter((u: any) => typeof u === "string" && u.startsWith("http"));
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

  console.log("  ℹ️ Abriendo Chrome para Argenprop");
  const { browser, context } = await createStealthBrowser(pw);
  const all: any[] = [];

  const TIPOS = ["departamentos", "casas", "ph", "locales", "terrenos"];
  const OPS = [{ slug: "venta", op: "venta" }, { slug: "alquiler", op: "alquiler" }];

  try {
    const page = await context.newPage();
    for (const tipo of TIPOS) {
      for (const { slug, op } of OPS) {
        for (let pg = 1; pg <= 3; pg++) {
          const pageSuffix = pg > 1 ? `-pagina-${pg}` : "";
          const url = `https://www.argenprop.com/${tipo}/${slug}/rosario${pageSuffix}`;
          const nd = await scrapeNextData(page, url);
          if (!nd) {
            console.warn(`  ⚠️ AP sin datos: ${tipo}-${slug} p${pg}`);
            break;
          }
          const items = extractArgenpropItems(nd, op, tipo);
          if (!items.length) break;
          all.push(...items);
          process.stdout.write(`  ↳ AP ${tipo}-${slug} p${pg}: ${items.length} props\n`);
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
