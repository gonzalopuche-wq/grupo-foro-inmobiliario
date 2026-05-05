// app/api/cartera/importar-portal/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PORTALES_SOPORTADOS = ["ZonaProp", "Argenprop", "MercadoLibre", "Propia", "Ficha.info", "Properati", "InfoCasas", "Doomos"];

function detectarPortal(url: string): string | null {
  if (url.includes("zonaprop.com")) return "zonaprop";
  if (url.includes("argenprop.com")) return "argenprop";
  if (url.includes("mercadolibre.com") || url.includes("inmuebles.mercadolibre")) return "mercadolibre";
  if (url.includes("propia.com.ar")) return "propia";
  if (url.includes("red.propia") || url.includes("redpropia")) return "propia";
  if (url.includes("ficha.info")) return "fichainfo";
  if (url.includes("properati.com") || url.includes("proppit.com")) return "properati";
  if (url.includes("infocasas.com")) return "infocasas";
  if (url.includes("doomos.com")) return "doomos";
  if (url.includes("lacapital.com.ar")) return "lacapital";
  return null;
}

async function fetchMercadoLibre(url: string) {
  const mlId = url.match(/MLA-?(\d+)/i)?.[1];
  if (!mlId) throw new Error("No se pudo extraer el ID de MercadoLibre de la URL.");
  const res = await fetch(`https://api.mercadolibre.com/items/MLA${mlId}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`MercadoLibre API error ${res.status}`);
  const item = await res.json();
  const attrs: Record<string, string> = {};
  for (const a of item.attributes || []) attrs[a.id] = a.value_name || a.values?.[0]?.name || "";
  const t = (attrs["PROPERTY_TYPE"] || attrs["SUBTYPE"] || "").toLowerCase();
  const tipo = t.includes("departamento") || t.includes("apartment") ? "Departamento" : t.includes("casa") ? "Casa" : t.includes("ph") ? "PH" : t.includes("local") ? "Local" : t.includes("oficina") ? "Oficina" : t.includes("terreno") ? "Terreno" : t.includes("cochera") ? "Cochera" : "Departamento";
  return { titulo: item.title || "", tipo, operacion: (item.listing_type_id || "").includes("rent") ? "Alquiler" : "Venta", precio: item.price || null, moneda: item.currency_id === "ARS" ? "ARS" : "USD", ciudad: item.location?.city?.name || "Rosario", zona: item.location?.neighborhood?.name || "", direccion: attrs["LOCATION_DETAILS"] || item.location?.address_line || "", dormitorios: parseInt(attrs["BEDROOMS"] || "0") || null, banos: parseInt(attrs["BATHROOMS"] || "0") || null, ambientes: parseInt(attrs["ROOMS"] || "0") || null, superficie_cubierta: parseFloat(attrs["COVERED_AREA"] || "0") || null, superficie_total: parseFloat(attrs["TOTAL_AREA"] || "0") || null, fotos: (item.pictures || []).map((p: any) => p.url?.replace("-I.jpg", "-O.jpg") || "").filter(Boolean).slice(0, 20), url_portal_origen: item.permalink || url, portal_origen: "mercadolibre" };
}

async function fetchGenerico(url: string, portal: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept": "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "es-AR,es;q=0.9" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Error ${res.status} al acceder al portal.`);
  const html = await res.text();
  const getMeta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i"))?.[1] || null;
  const titulo = getMeta("og:title") || getMeta("twitter:title") || html.match(/<h1[^>]*>([^<]{10,120})<\/h1>/i)?.[1]?.trim() || "";
  const descripcion = getMeta("og:description") || getMeta("description") || null;
  const fotoPrincipal = getMeta("og:image") || getMeta("twitter:image") || null;
  const precioMatch = html.match(/\$[\s]*([\d.,]+)/i) || html.match(/(USD|U\$S)\s*([\d.,]+)/i) || html.match(/"price"\s*:\s*"?([\d.]+)"?/i);
  let precio: number | null = null;
  let moneda = "USD";
  if (precioMatch) { precio = parseFloat((precioMatch[1] || precioMatch[2] || "").replace(/\./g, "").replace(",", ".")) || null; if (html.match(/ARS|pesos/i) && !html.match(/USD|dólares/i)) moneda = "ARS"; }
  let jsonLd: any = null;
  const jm = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jm) { try { jsonLd = JSON.parse(jm[1]); } catch {} }
  const direccion = jsonLd?.address?.streetAddress || getMeta("og:street-address") || null;
  const ciudad = jsonLd?.address?.addressLocality || getMeta("og:locality") || "Rosario";
  const textoAnalizar = (titulo + " " + (descripcion || "") + " " + url).toLowerCase();
  const tipo = textoAnalizar.includes("departamento") || textoAnalizar.includes("dpto") ? "Departamento" : textoAnalizar.includes("casa") ? "Casa" : textoAnalizar.includes(" ph ") ? "PH" : textoAnalizar.includes("local") ? "Local" : textoAnalizar.includes("oficina") ? "Oficina" : textoAnalizar.includes("terreno") || textoAnalizar.includes("lote") ? "Terreno" : textoAnalizar.includes("cochera") ? "Cochera" : "Departamento";
  const operacion = textoAnalizar.includes("alquiler") || textoAnalizar.includes("alquilar") ? "Alquiler" : "Venta";
  const dormMatch = textoAnalizar.match(/(\d)\s*(?:dormitorio|dorm|habitacion|ambientes)/);
  const dormitorios = dormMatch ? parseInt(dormMatch[1]) : null;
  const supMatch = html.match(/(\d+)\s*m²/i);
  const superficie_cubierta = supMatch ? parseInt(supMatch[1]) : null;
  return { titulo: titulo.slice(0, 200), descripcion: descripcion?.slice(0, 1000) || null, tipo, operacion, precio, moneda, ciudad, zona: null, direccion, dormitorios, banos: null, ambientes: null, superficie_cubierta, superficie_total: null, fotos: fotoPrincipal ? [fotoPrincipal] : [], url_portal_origen: url, portal_origen: portal };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url?.trim()) return NextResponse.json({ error: "URL requerida." }, { status: 400 });
    const portal = detectarPortal(url.trim());
    if (!portal) return NextResponse.json({ error: `Portal no reconocido. Portales soportados: ${PORTALES_SOPORTADOS.join(", ")}.` }, { status: 400 });
    const datos = portal === "mercadolibre" ? await fetchMercadoLibre(url.trim()) : await fetchGenerico(url.trim(), portal);
    return NextResponse.json({ ok: true, datos });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al importar la propiedad." }, { status: 500 });
  }
}
