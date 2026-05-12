// API: importar propiedad desde URL de portal externo
// Detecta el portal, extrae datos y los devuelve estructurados para pre-llenar el formulario de cartera

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 45;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/json,*/*",
  "Accept-Language": "es-AR,es;q=0.9",
};

// ── Detectar portal ───────────────────────────────────────────────────────────

function detectarPortal(url: string): string | null {
  if (url.includes("zonaprop.com.ar")) return "zonaprop";
  if (url.includes("argenprop.com")) return "argenprop";
  if (url.includes("mercadolibre.com") || url.includes("mlstatic.com")) return "mercadolibre";
  if (url.includes("red.propia.com.ar")) return "red_propia";
  if (url.includes("ficha.info")) return "ficha_info";
  if (url.includes("properati.com")) return "properati";
  if (url.includes("navent.com")) return "navent";
  return null;
}

// ── Normalizadores ────────────────────────────────────────────────────────────

function normalizarOperacion(op: string): string {
  const o = op.toLowerCase();
  if (o.includes("alquiler") && o.includes("temp")) return "Alquiler temporal";
  if (o.includes("alquiler")) return "Alquiler";
  return "Venta";
}

function normalizarTipo(tipo: string): string {
  const t = tipo.toLowerCase();
  if (t.includes("departamento") || t.includes("dpto")) return "Departamento";
  if (t.includes("casa")) return "Casa";
  if (t.includes("ph")) return "PH";
  if (t.includes("local")) return "Local";
  if (t.includes("oficina")) return "Oficina";
  if (t.includes("terreno") || t.includes("lote")) return "Terreno";
  if (t.includes("cochera") || t.includes("garage")) return "Cochera";
  if (t.includes("galpón") || t.includes("galpon")) return "Galpon";
  return "Departamento";
}

// ── ZonaProp ──────────────────────────────────────────────────────────────────

async function scrapeZonaprop(url: string) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Extraer __PRELOADED_STATE__
  const m = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]+?});\s*<\/script>/);
  if (!m) throw new Error("No se pudo extraer datos de ZonaProp");
  const state = JSON.parse(m[1]);

  const posting = state?.posting || state?.realEstate || state?.listPostings?.[0]?.postingInfo;
  if (!posting) throw new Error("Estructura inesperada de ZonaProp");

  const precio = posting.price || posting.operationPrice?.[0];
  const fotos = (posting.photos || posting.pictures || []).map((p: any) =>
    typeof p === "string" ? p : (p.url || p.location || "")
  ).filter(Boolean).slice(0, 20);

  const tipo = normalizarTipo(posting.propertyType || "departamento");
  const operacion = normalizarOperacion(posting.operationType || "venta");

  return {
    titulo: posting.title || posting.address || "",
    tipo,
    operacion,
    precio: precio?.amount || precio?.value || null,
    moneda: precio?.currency === "ARS" ? "ARS" : "USD",
    expensas: posting.expenses?.amount || null,
    ciudad: posting.location?.city || "Rosario",
    zona: posting.location?.neighbourhood || posting.location?.zone || "",
    direccion: posting.address || posting.location?.address || "",
    dormitorios: posting.bedrooms || posting.rooms || null,
    banos: posting.bathrooms || null,
    ambientes: posting.rooms || null,
    superficie_cubierta: posting.coveredSurface || null,
    superficie_total: posting.totalSurface || posting.surface || null,
    descripcion: posting.description || "",
    fotos,
    portal: "zonaprop",
    url_original: url,
  };
}

// ── Argenprop ─────────────────────────────────────────────────────────────────

async function scrapeArgenprop(url: string) {
  const res = await fetch(url, { headers: { ...HEADERS, Referer: "https://www.argenprop.com/" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Buscar JSON en script
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]+?});<\/script>/) ||
                html.match(/<script id="__NEXT_DATA__"[^>]*>({[\s\S]+?})<\/script>/);

  let data: any = null;
  if (match) {
    try { data = JSON.parse(match[1]); } catch { /* continuar */ }
  }

  // Fallback: extraer desde meta tags
  const metaTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] || "";
  const metaDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] || "";
  const metaImg = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] || "";

  // Extraer precio del HTML
  const precioMatch = html.match(/(?:USD|ARS|\$)\s*[\d.,]+/i)?.[0];
  const precioNum = precioMatch ? parseFloat(precioMatch.replace(/[^\d]/g, "")) : null;
  const moneda = precioMatch?.toUpperCase().includes("USD") ? "USD" : "ARS";

  // Extraer dormitorios de título/descripción
  const dormMatch = (metaTitle + " " + metaDesc).match(/(\d+)\s*(?:dorm|dormitor|amb)/i);

  if (data) {
    const prop = data?.propertyDetail || data?.pageProps?.property || data;
    return {
      titulo: prop.title || metaTitle || "",
      tipo: normalizarTipo(prop.propertyType || "departamento"),
      operacion: normalizarOperacion(prop.operationType || "venta"),
      precio: prop.price?.amount || precioNum,
      moneda: prop.price?.currency === "ARS" ? "ARS" : moneda,
      ciudad: prop.location?.city || "Rosario",
      zona: prop.location?.neighbourhood || "",
      direccion: prop.address || "",
      dormitorios: prop.bedrooms || (dormMatch ? parseInt(dormMatch[1]) : null),
      banos: prop.bathrooms || null,
      ambientes: prop.rooms || null,
      superficie_cubierta: prop.coveredSurface || null,
      superficie_total: prop.totalSurface || null,
      descripcion: prop.description || metaDesc || "",
      fotos: [metaImg].filter(Boolean).slice(0, 20),
      portal: "argenprop",
      url_original: url,
    };
  }

  return {
    titulo: metaTitle,
    tipo: "Departamento",
    operacion: "Venta",
    precio: precioNum,
    moneda,
    ciudad: "Rosario",
    zona: "",
    direccion: "",
    dormitorios: dormMatch ? parseInt(dormMatch[1]) : null,
    banos: null,
    ambientes: null,
    superficie_cubierta: null,
    superficie_total: null,
    descripcion: metaDesc,
    fotos: [metaImg].filter(Boolean),
    portal: "argenprop",
    url_original: url,
  };
}

// ── MercadoLibre ──────────────────────────────────────────────────────────────

async function scrapeMercadoLibre(url: string) {
  // Extraer item ID de la URL
  const idMatch = url.match(/MLA-?(\d+)/i);
  if (!idMatch) throw new Error("No se pudo extraer ID de MercadoLibre");
  const itemId = `MLA${idMatch[1]}`;

  const [itemRes, descRes] = await Promise.all([
    fetch(`https://api.mercadolibre.com/items/${itemId}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }),
    fetch(`https://api.mercadolibre.com/items/${itemId}/description`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }),
  ]);

  if (!itemRes.ok) throw new Error(`MercadoLibre API: HTTP ${itemRes.status}`);
  const item = await itemRes.json();
  const desc = descRes.ok ? await descRes.json() : null;

  const attrs: Record<string, string> = {};
  (item.attributes || []).forEach((a: any) => { attrs[a.id] = a.value_name || ""; });

  const tipo = normalizarTipo(attrs["PROPERTY_TYPE"] || attrs["SUBTYPE"] || "departamento");
  const operacion = item.category_id?.includes("1480") ? "Alquiler" : "Venta";

  return {
    titulo: item.title || "",
    tipo,
    operacion,
    precio: item.price || null,
    moneda: item.currency_id === "ARS" ? "ARS" : "USD",
    ciudad: attrs["CITY"] || "Rosario",
    zona: attrs["NEIGHBORHOOD"] || attrs["STATE"] || "",
    direccion: attrs["LOCATION_DETAILS"] || "",
    dormitorios: parseInt(attrs["BEDROOMS"] || "0") || null,
    banos: parseInt(attrs["BATHROOMS"] || "0") || null,
    ambientes: parseInt(attrs["ROOMS"] || "0") || null,
    superficie_cubierta: parseFloat(attrs["COVERED_AREA"] || "0") || null,
    superficie_total: parseFloat(attrs["TOTAL_AREA"] || "0") || null,
    descripcion: desc?.plain_text || "",
    fotos: (item.pictures || []).map((p: any) => p.url?.replace("-I.jpg", "-O.jpg") || "").filter(Boolean).slice(0, 20),
    portal: "mercadolibre",
    url_original: url,
  };
}

// ── Genérico (meta tags OG) ───────────────────────────────────────────────────

async function scrapeGenerico(url: string, portal: string) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const metaTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ||
                    html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
  const metaDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] || "";
  const metaImg = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] || "";

  const precioMatch = html.match(/(?:USD|ARS|\$)\s*[\d.,]+/i)?.[0];
  const precioNum = precioMatch ? parseFloat(precioMatch.replace(/[^\d.,]/g, "").replace(",", "")) : null;
  const moneda = precioMatch?.toUpperCase().includes("USD") ? "USD" : "ARS";

  return {
    titulo: metaTitle.replace(/\s*[-|·].*$/, "").trim(),
    tipo: "Departamento",
    operacion: "Venta",
    precio: precioNum,
    moneda,
    ciudad: "Rosario",
    zona: "",
    direccion: "",
    dormitorios: null,
    banos: null,
    ambientes: null,
    superficie_cubierta: null,
    superficie_total: null,
    descripcion: metaDesc,
    fotos: [metaImg].filter(Boolean),
    portal,
    url_original: url,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

// Descarga fotos externas y las sube a Supabase storage para evitar hotlink blocking
async function proxearFotos(urls: string[], supabase: any, userId: string): Promise<string[]> {
  const result: string[] = [];
  for (let i = 0; i < Math.min(urls.length, 15); i++) {
    const url = urls[i];
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) { result.push(url); continue; }
      const buffer = await res.arrayBuffer();
      const ct = res.headers.get("content-type") || "image/jpeg";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const path = `imports/${userId}/${Date.now()}_${i}.${ext}`;
      const { data, error } = await supabase.storage.from("fotos_cartera").upload(path, buffer, { contentType: ct, upsert: false });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("fotos_cartera").getPublicUrl(data.path);
        result.push(urlData.publicUrl);
      } else {
        result.push(url); // fallback a URL externa si falla el upload
      }
    } catch {
      result.push(url);
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { url } = await req.json();
    if (!url?.trim()) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

    const portal = detectarPortal(url);
    if (!portal) {
      return NextResponse.json({ error: "Portal no reconocido. Portales soportados: ZonaProp, Argenprop, MercadoLibre, Red Propia, Ficha.info, Properati." }, { status: 400 });
    }

    let data;
    switch (portal) {
      case "zonaprop": data = await scrapeZonaprop(url); break;
      case "argenprop": data = await scrapeArgenprop(url); break;
      case "mercadolibre": data = await scrapeMercadoLibre(url); break;
      default: data = await scrapeGenerico(url, portal);
    }

    // Re-subir fotos al storage propio para evitar hotlink blocking de portales
    if (data.fotos && data.fotos.length > 0) {
      data.fotos = await proxearFotos(data.fotos, supabase, user.id);
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("importar-url error:", err);
    return NextResponse.json({ error: err.message || "Error al importar" }, { status: 500 });
  }
}
