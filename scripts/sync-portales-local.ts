/**
 * sync-portales-local.ts
 *
 * Corre desde tu PC (IP residencial) y guarda en Supabase.
 * Bypasea el bloqueo de IPs de datacenter (Vercel).
 *
 * USO:
 *   1. Copiá .env.local a este directorio o configurá las vars abajo
 *   2. npx tsx scripts/sync-portales-local.ts
 *
 * O con variables de entorno:
 *   NEXT_PUBLIC_SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/sync-portales-local.ts
 *
 * Para correr automáticamente (ej: cada noche a las 3am):
 *   Mac/Linux: crontab -e → agregar:
 *   0 3 * * * cd /ruta/a/proyecto && npx tsx scripts/sync-portales-local.ts >> /tmp/sync-portales.log 2>&1
 */

import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";

// Cargar .env.local automáticamente si existe
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
  console.error("   Configurá .env.local o pasalos como variables de entorno");
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
    if (!res.ok) { console.warn(`  ⚠️ ML token HTTP ${res.status}`); return null; }
    const d = await res.json();
    return d.access_token ?? null;
  } catch (e: any) {
    console.warn("  ⚠️ ML token error:", e.message);
    return null;
  }
}

async function syncML(): Promise<any[]> {
  const token = await getMLToken();
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("  🔑 Usando token ML");
  } else {
    console.log("  ⚠️ Sin token ML (puede ser bloqueado)");
  }

  const ROSARIO_LAT = "-33.0394_-32.8717";
  const ROSARIO_LON = "-60.7961_-60.6122";
  const strategies = [
    `https://api.mercadolibre.com/sites/MLA/search?category=MLA1459&item_location=lat:${ROSARIO_LAT},lon:${ROSARIO_LON}&limit=50`,
    `https://api.mercadolibre.com/sites/MLA/search?category=MLA1459&city=TUxBQUMxMjg3NTU&limit=50`,
  ];

  for (const baseUrl of strategies) {
    const all: any[] = [];
    let offset = 0;
    while (all.length < 500) {
      const res = await fetch(`${baseUrl}&offset=${offset}`, { headers });
      if (!res.ok) { console.warn(`  ⚠️ ML HTTP ${res.status} para ${baseUrl.split("?")[1]?.slice(0, 40)}`); break; }
      const data = await res.json();
      const items = data.results ?? [];
      if (!items.length) break;
      all.push(...items.map((item: any) => normalizeML(item)));
      offset += 50;
      if (offset >= Math.min(data.paging?.total ?? 0, 500)) break;
    }
    if (all.length > 0) return all;
  }
  return [];
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

// ── Zonaprop ──────────────────────────────────────────────────────────────────

async function syncZonaprop(): Promise<any[]> {
  const all: any[] = [];
  const SLUGS = ["departamentos", "casas", "ph", "locales", "terrenos"];
  const OPS = [{ slug: "venta", op: "venta" }, { slug: "alquiler", op: "alquiler" }];

  for (const tipo of SLUGS) {
    for (const { slug, op } of OPS) {
      for (let page = 1; page <= 3; page++) {
        const suffix = page > 1 ? `-pagina-${page}` : "";
        const url = `https://www.zonaprop.com.ar/${tipo}-${slug}-rosario${suffix}.html`;
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept-Language": "es-AR,es;q=0.9",
            }
          });
          if (!res.ok) { console.warn(`  ⚠️ ZP HTTP ${res.status}`); break; }
          const html = await res.text();
          const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
          if (!match) { break; }
          const nd = JSON.parse(match[1]);
          const pp = nd?.props?.pageProps;
          const postings = pp?.initialData?.postings ?? pp?.listingData?.postings ?? pp?.postings ?? [];
          if (!postings.length) break;
          for (const item of postings) {
            const posting = item.postingData ?? item;
            const priceData = posting.priceOperationTypes?.[0] ?? {};
            const loc = posting.postingLocation ?? posting.location ?? {};
            const geo = loc.postingGeolocation ?? {};
            const imgs = (posting.postingGallery ?? posting.photos ?? [])
              .map((p: any) => p.url ?? p.image ?? p).filter((u: any) => typeof u === "string" && u.startsWith("http"));
            all.push({
              portal_id: String(item.postingId ?? item.id),
              url: `https://www.zonaprop.com.ar${posting.url ?? ""}`,
              titulo: posting.title ?? "",
              operacion: op,
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
          if (postings.length < 20) break;
        } catch (e: any) {
          console.warn(`  ⚠️ ZP error: ${e.message}`);
          break;
        }
      }
    }
  }
  return all;
}

// ── Argenprop ─────────────────────────────────────────────────────────────────

async function syncArgenprop(): Promise<any[]> {
  const all: any[] = [];
  const TIPOS = ["departamentos", "casas", "ph", "locales", "terrenos"];
  const OPS = [{ slug: "venta", op: "venta" }, { slug: "alquiler", op: "alquiler" }];

  for (const tipo of TIPOS) {
    for (const { slug, op } of OPS) {
      for (let page = 1; page <= 3; page++) {
        const pageSuffix = page > 1 ? `-pagina-${page}` : "";
        const url = `https://www.argenprop.com/${tipo}/${slug}/rosario${pageSuffix}`;
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept-Language": "es-AR,es;q=0.9",
            }
          });
          if (!res.ok) { console.warn(`  ⚠️ AP HTTP ${res.status}`); break; }
          const html = await res.text();
          const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
          if (!match) break;
          const nd = JSON.parse(match[1]);
          const pp = nd?.props?.pageProps;
          const items = pp?.initialData?.listingResults ?? pp?.listingResults ?? pp?.listings ?? [];
          if (!items.length) break;
          for (const item of items) {
            const imgs = (item.photos ?? item.images ?? [])
              .map((p: any) => p.image ?? p.url ?? p).filter((u: any) => typeof u === "string" && u.startsWith("http"));
            all.push({
              portal_id: String(item.id ?? item.postingId),
              url: item.url ? `https://www.argenprop.com${item.url}` : "",
              titulo: item.title ?? item.headline ?? "",
              operacion: op,
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
            });
          }
          if (items.length < 20) break;
        } catch (e: any) {
          console.warn(`  ⚠️ AP error: ${e.message}`);
          break;
        }
      }
    }
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
    process.stdout.write(`Sincronizando ${nombre}... `);
    try {
      const items = await fn();
      if (!items.length) {
        console.log(`⚠️  0 propiedades`);
        resultados[portal] = { importados: 0, error: "0 propiedades encontradas" };
        continue;
      }
      const { importados, error } = await upsertBatch(items, portal);
      if (error) {
        console.log(`❌ Error al guardar: ${error}`);
        resultados[portal] = { importados, error };
      } else {
        console.log(`✅ ${importados} propiedades importadas`);
        resultados[portal] = { importados };
      }
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
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
