import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Comparable scraping ──────────────────────────────────────────────────────

interface PropComp {
  portal: string
  titulo: string
  precio: number
  moneda: string
  m2: number | null
  barrio: string
  url: string
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
const HEADERS_FETCH = { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9", "Accept": "application/json, text/html, */*" }

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

function tipoSlugZP(tipo: string) {
  const m: Record<string, string> = { departamento: "departamento", casa: "casa", ph: "ph", "local comercial": "local", oficina: "oficina", terreno: "terreno", galpon: "galpon" }
  return m[tipo.toLowerCase()] || "inmueble"
}

function tipoSlugPropia(tipo: string) {
  const m: Record<string, string> = { departamento: "departamentos", casa: "casas", ph: "ph", "local comercial": "locales-comerciales", oficina: "oficinas", terreno: "terrenos" }
  return m[tipo.toLowerCase()] || "departamentos"
}

// Construye URL de búsqueda del portal (siempre funciona, el usuario puede verificar)
function portalSearchUrl(portal: string, tipo: string, op: string, barrio: string): string {
  const z = slugify(barrio)
  const o = op === "alquiler" ? "alquiler" : "venta"
  switch (portal) {
    case "ZonaProp":     return `https://www.zonaprop.com.ar/${tipoSlugZP(tipo)}-${o}-${z}.html`
    case "Argenprop":    return `https://www.argenprop.com/${slugify(tipo)}/${o}/rosario/${z}`
    case "Propia":       return `https://red.propia.com.ar/${tipoSlugPropia(tipo)}/${o}/rosario/${z}`
    case "MercadoLibre": return `https://listado.mercadolibre.com.ar/inmuebles/${tipoSlugPropia(tipo)}/${o}/${z}`
    default: return ""
  }
}

// Valida que la URL sea una publicación individual (tiene path significativo)
function esUrlPublicacion(url: string): boolean {
  try {
    const u = new URL(url)
    return u.pathname.length > 5 && u.pathname !== "/"
  } catch { return false }
}

async function scrapeZonaProp(barrio: string, tipo: string, op: string): Promise<PropComp[]> {
  const fallbackUrl = portalSearchUrl("ZonaProp", tipo, op, barrio)
  try {
    const res = await fetch(fallbackUrl + "?orden=relevancia-DESC", { headers: { ...HEADERS_FETCH, Referer: "https://www.zonaprop.com.ar/" }, signal: AbortSignal.timeout(9000) })
    if (!res.ok) return []
    const html = await res.text()
    const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]+?});\s*<\/script>/)
    if (!match) return []
    const state = JSON.parse(match[1])
    const listings: any[] = state?.listPostings || state?.searchResult?.listings || []
    return listings.slice(0, 15).map((item: any) => {
      const p = item.postingInfo || item
      const precio = p.price || p.operationPrice?.[0]
      const listingPath = p.url || p.link || ""
      const listingUrl = listingPath ? `https://www.zonaprop.com.ar${listingPath}` : ""
      return {
        portal: "ZonaProp",
        titulo: p.title || p.address || "",
        precio: precio?.amount || precio?.value || 0,
        moneda: precio?.currency === "ARS" ? "ARS" : "USD",
        m2: p.coveredSurface || p.totalSurface || p.surface || null,
        barrio: p.location?.neighbourhood || barrio,
        url: esUrlPublicacion(listingUrl) ? listingUrl : fallbackUrl,
      }
    }).filter(p => p.precio > 0)
  } catch { return [] }
}

async function scrapeArgenprop(barrio: string, tipo: string, op: string): Promise<PropComp[]> {
  const fallbackUrl = portalSearchUrl("Argenprop", tipo, op, barrio)
  try {
    const res = await fetch(fallbackUrl, { headers: { ...HEADERS_FETCH, Referer: "https://www.argenprop.com/" }, signal: AbortSignal.timeout(9000) })
    if (!res.ok) return []
    const html = await res.text()
    const match = html.match(/__NEXT_DATA__\s*=\s*({[\s\S]+?})\s*;?\s*<\/script>/)
      || html.match(/window\.__DATA__\s*=\s*({[\s\S]+?});\s*<\/script>/)
    if (!match) return []
    const data = JSON.parse(match[1])
    const items: any[] = data?.props?.pageProps?.listings || data?.props?.pageProps?.results || data?.listings || []
    return items.slice(0, 15).map((item: any) => {
      const path = item.url || item.link || ""
      const listingUrl = path ? `https://www.argenprop.com${path}` : ""
      return {
        portal: "Argenprop",
        titulo: item.title || item.address || "",
        precio: item.price?.amount || item.price || 0,
        moneda: item.price?.currency === "ARS" ? "ARS" : "USD",
        m2: item.coveredArea || item.totalArea || null,
        barrio: item.location?.neighbourhood || barrio,
        url: esUrlPublicacion(listingUrl) ? listingUrl : fallbackUrl,
      }
    }).filter(p => p.precio > 0)
  } catch { return [] }
}

async function scrapeMercadoLibre(barrio: string, tipo: string, op: string): Promise<PropComp[]> {
  const fallbackUrl = portalSearchUrl("MercadoLibre", tipo, op, barrio)
  try {
    const catMap: Record<string, string> = { venta: "MLA1459", alquiler: "MLA1480" }
    const categoria = catMap[op] || "MLA1459"
    const q = `${tipo} ${barrio} Rosario`
    const apiUrl = `https://api.mercadolibre.com/sites/MLA/search?category=${categoria}&q=${encodeURIComponent(q)}&limit=15`
    const res = await fetch(apiUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.results || []).map((item: any) => {
      const attrs: Record<string, string> = {}
      ;(item.attributes || []).forEach((a: any) => { attrs[a.id] = a.value_name || "" })
      const m2Total = parseFloat(attrs["TOTAL_AREA"] || "0") || null
      const m2Cub = parseFloat(attrs["COVERED_AREA"] || "0") || null
      // ML permalink is always a real listing URL
      const url = item.permalink && esUrlPublicacion(item.permalink) ? item.permalink : fallbackUrl
      return {
        portal: "MercadoLibre",
        titulo: item.title || "",
        precio: item.price || 0,
        moneda: item.currency_id === "ARS" ? "ARS" : "USD",
        m2: m2Cub || m2Total,
        barrio: attrs["NEIGHBORHOOD"] || barrio,
        url,
      }
    }).filter((p: PropComp) => p.precio > 0)
  } catch { return [] }
}

async function scrapePropia(barrio: string, tipo: string, op: string): Promise<PropComp[]> {
  const fallbackUrl = portalSearchUrl("Propia", tipo, op, barrio)
  try {
    const res = await fetch(fallbackUrl, { headers: { ...HEADERS_FETCH, Referer: "https://red.propia.com.ar/" }, signal: AbortSignal.timeout(9000) })
    if (!res.ok) return []
    const html = await res.text()
    // Propia puede usar __NEXT_DATA__ o una variable de estado propia
    const match = html.match(/__NEXT_DATA__\s*=\s*({[\s\S]+?})\s*;?\s*<\/script>/)
      || html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]+?});\s*<\/script>/)
    if (!match) return []
    const data = JSON.parse(match[1])
    const items: any[] = data?.props?.pageProps?.properties
      || data?.props?.pageProps?.listings
      || data?.props?.pageProps?.results
      || data?.listings
      || []
    return items.slice(0, 15).map((item: any) => {
      const path = item.url || item.slug || ""
      const listingUrl = path ? `https://red.propia.com.ar${path.startsWith("/") ? "" : "/"}${path}` : ""
      return {
        portal: "Propia",
        titulo: item.title || item.address || item.direccion || "",
        precio: item.price || item.precio || 0,
        moneda: item.currency === "ARS" ? "ARS" : "USD",
        m2: item.totalArea || item.coveredArea || item.m2 || item.superficie || null,
        barrio: item.neighborhood || item.barrio || item.location?.neighbourhood || barrio,
        url: esUrlPublicacion(listingUrl) ? listingUrl : fallbackUrl,
      }
    }).filter(p => p.precio > 0)
  } catch { return [] }
}

// propia.com.ar (portal oficial, distinto de red.propia.com.ar)
async function scrapePropiaCom(barrio: string, tipo: string, op: string): Promise<PropComp[]> {
  const opSlug = op === "alquiler" ? "alquiler" : "venta"
  const fallbackUrl = `https://www.propia.com.ar/propiedades?operacion=${opSlug}&tipo=${slugify(tipo)}&zona=${slugify(barrio)}`
  try {
    const apiUrl = `https://www.propia.com.ar/api/propiedades?operacion=${opSlug}&tipo=${encodeURIComponent(tipo)}&zona=${encodeURIComponent(barrio)}&limit=15`
    const res = await fetch(apiUrl, { headers: { Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    const items: any[] = data?.data || data?.results || data?.propiedades || []
    if (items.length === 0) return []
    return items.slice(0, 15).map((item: any) => {
      const id = item.id || item._id || ""
      const listingUrl = id ? `https://www.propia.com.ar/propiedad/${id}` : fallbackUrl
      return {
        portal: "Propia.com.ar",
        titulo: item.title || item.titulo || item.address || item.direccion || "",
        precio: item.price || item.precio || 0,
        moneda: item.currency === "ARS" ? "ARS" : "USD",
        m2: item.superficie || item.m2 || item.totalArea || null,
        barrio: item.barrio || item.zona || barrio,
        url: esUrlPublicacion(listingUrl) ? listingUrl : fallbackUrl,
      }
    }).filter(p => p.precio > 0)
  } catch { return [] }
}

function filtrarComparables(props: PropComp[], monedaEsperada: string, m2Ref?: number): PropComp[] {
  return props
    .filter(p => {
      if (p.moneda !== monedaEsperada) return false
      if (p.precio <= 0) return false
      // Filtrar por m2 si disponible (±60% del de referencia)
      if (m2Ref && p.m2) {
        const ratio = p.m2 / m2Ref
        if (ratio < 0.4 || ratio > 2.5) return false
      }
      return true
    })
    // Deduplicar por precio+m2
    .filter((p, i, arr) => arr.findIndex(x => x.precio === p.precio && x.m2 === p.m2) === i)
    .slice(0, 8)
}

// ─── Build price table from auto-calculated DB data ───────────────────────────

interface PreciosAuto {
  alquiler_rosario?: Array<{ label: string; min: number; max: number; mediana: number; n: number; moneda: string }>
  venta_rosario?: Array<{ label: string; min: number; max: number; mediana: number; n: number; moneda: string }>
  actualizado?: string
  total_listings_procesados?: number
}

function fmt(n: number) { return n.toLocaleString("es-AR") }

function buildPreciosSection(precios: PreciosAuto | null, hoy: string): string {
  if (precios?.alquiler_rosario?.length) {
    const alq = precios.alquiler_rosario
    const vent = precios.venta_rosario || []
    const actualizado = precios.actualizado
      ? new Date(precios.actualizado).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
      : hoy
    const filas = alq.map(r =>
      `- ${r.label}: ARS ${fmt(r.min)} - ${fmt(r.max)} (mediana ARS ${fmt(r.mediana)}, n=${r.n})`
    ).join("\n")
    const ventFila = vent.length
      ? `\nVENTA ROSARIO (USD/m2 — datos reales portales, actualizado ${actualizado}):\n` +
        vent.map(r => `- ${r.label}: USD ${fmt(r.min)} - ${fmt(r.max)} (mediana USD ${fmt(r.mediana)}, n=${r.n})`).join("\n")
      : `\nVENTA ROSARIO (USD/m2 — estimados ${hoy}):
- Centro/Alberdi/Echesortu/Pichincha: USD 1.400-2.100/m2
- Fisherton/Puerto Norte/Roca Santa Fe: USD 2.000-3.200/m2
- Residencial consolidado: USD 1.100-1.700/m2
- Periféricos/emergentes: USD 800-1.200/m2`

    return `ALQUILERES ROSARIO (ARS/mes — datos reales portales, actualizado ${actualizado}):
${filas}
Modificadores de zona:
  Centro/Alberdi/Echesortu/Pichincha/República de la Sexta: valores base
  Fisherton/Puerto Norte/Roca Santa Fe/barrios premium: +20-40%
  Periféricos/emergentes: -15-25%
${ventFila}`
  }

  // Fallback: hardcoded 2026 values
  return `ALQUILERES ROSARIO (ARS/mes — mercado actual ${hoy}):
- Monoambiente / 1 amb (30-45m2): ARS 600.000 - 950.000
- 2 ambientes (45-65m2): ARS 850.000 - 1.350.000
- 3 ambientes (65-90m2): ARS 1.200.000 - 1.900.000
- 4+ amb / PH: ARS 1.700.000 - 2.800.000
- Casas: ARS 1.400.000 - 3.500.000 según zona y m2
Modificadores de zona:
  Centro/Alberdi/Echesortu/Pichincha/República de la Sexta: valores base
  Fisherton/Puerto Norte/Roca Santa Fe/barrios premium: +20-40%
  Periféricos/emergentes: -15-25%

VENTA ROSARIO (USD/m2 — mercado de usados ${hoy}):
- Centro/Alberdi/Echesortu/Pichincha: USD 1.400-2.100/m2
- Fisherton/Puerto Norte/Roca Santa Fe: USD 2.000-3.200/m2
- Residencial consolidado (Abasto, Belgrano, Italia, Las Delicias): USD 1.100-1.700/m2
- Periféricos y emergentes: USD 800-1.200/m2`
}

// ─── Tool schema ──────────────────────────────────────────────────────────────

const tasacionTool: Anthropic.Tool = {
  name: "tasacion_result",
  description: "Devuelve el resultado de la tasación inmobiliaria profesional",
  input_schema: {
    type: "object" as const,
    properties: {
      valor_min:          { type: "number",  description: "Valor mínimo de tasación en USD" },
      valor_max:          { type: "number",  description: "Valor máximo de tasación en USD" },
      valor_sugerido:     { type: "number",  description: "Valor sugerido de tasación en USD" },
      precio_m2:          { type: "number",  description: "Precio por m² en USD" },
      moneda:             { type: "string",  enum: ["USD"] },
      alquiler_estimado:  { type: ["number","null"], description: "Alquiler estimado mensual en ARS para la operación de venta. Valores mínimos 2026: 1 amb ARS 600k, 2 amb ARS 850k, 3 amb ARS 1.200k. Null si la operación es Alquiler." },
      analisis:           { type: "string",  description: "2-3 párrafos de análisis del mercado y justificación del valor, referenciando los comparables reales" },
      factores_positivos: { type: "array",   items: { type: "string" } },
      factores_negativos: { type: "array",   items: { type: "string" } },
      indices_comparables: {
        type: "array",
        description: "Índices (base 1) de los comparables más relevantes de la lista real proporcionada, ordenados por relevancia. Máximo 5. Si no hay comparables reales, dejar vacío.",
        items: { type: "number" },
      },
      recomendacion: { type: "string", description: "Recomendación estratégica: precio de publicación, tiempo estimado de comercialización, tips de negociación" },
    },
    required: ["valor_min","valor_max","valor_sugerido","precio_m2","moneda","analisis","factores_positivos","factores_negativos","indices_comparables","recomendacion"],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const datos = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No hay clave de IA configurada." }, { status: 500 });
  }

  try {
    const hoy = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    const opBusqueda = (datos.operacion || "Venta").toLowerCase()
    const tipoBusqueda = (datos.tipo || "Departamento").toLowerCase()
    const m2Ref = datos.sup_cubierta ? parseFloat(datos.sup_cubierta) : undefined

    // Leer precios auto-calculados del mercado (generados por el cron semanal)
    const { data: preciosDB } = await supabaseAdmin
      .from("indicadores")
      .select("valor_texto")
      .eq("clave", "tasador_precios_auto")
      .single()
    const preciosAuto: PreciosAuto | null = preciosDB?.valor_texto
      ? JSON.parse(preciosDB.valor_texto)
      : null

    // Buscar comparables reales en paralelo
    const [resZona, resArgen, resML, resPropia, resPropiaCom] = await Promise.allSettled([
      scrapeZonaProp(datos.barrio, tipoBusqueda, opBusqueda),
      scrapeArgenprop(datos.barrio, tipoBusqueda, opBusqueda),
      scrapeMercadoLibre(datos.barrio, tipoBusqueda, opBusqueda),
      scrapePropia(datos.barrio, tipoBusqueda, opBusqueda),
      scrapePropiaCom(datos.barrio, tipoBusqueda, opBusqueda),
    ])

    const monedaComp = opBusqueda === "alquiler" ? "ARS" : "USD"
    const todosComps = [
      ...(resZona.status === "fulfilled" ? resZona.value : []),
      ...(resArgen.status === "fulfilled" ? resArgen.value : []),
      ...(resML.status === "fulfilled" ? resML.value : []),
      ...(resPropia.status === "fulfilled" ? resPropia.value : []),
      ...(resPropiaCom.status === "fulfilled" ? resPropiaCom.value : []),
    ]
    const comparablesFiltrados = filtrarComparables(todosComps, monedaComp, m2Ref)

    // Si los scrapers no devolvieron nada (bot protection), agregar stubs con links de búsqueda verificables
    const portalesStub: PropComp[] = comparablesFiltrados.length === 0
      ? ["ZonaProp", "Argenprop", "MercadoLibre", "Propia"].map(portal => ({
          portal,
          titulo: `Buscar ${datos.tipo.toLowerCase()} en ${datos.barrio}`,
          precio: 0,
          moneda: monedaComp,
          m2: null,
          barrio: datos.barrio,
          url: portalSearchUrl(portal, tipoBusqueda, opBusqueda, datos.barrio),
        }))
      : []

    const comparablesTexto = comparablesFiltrados.length > 0
      ? `\nCOMPARABLES REALES ENCONTRADOS EN PORTALES (${comparablesFiltrados.length} propiedades):\n` +
        comparablesFiltrados.map((c, i) =>
          `${i+1}. [${c.portal}] ${c.titulo} | Barrio: ${c.barrio} | Precio: ${c.moneda} ${c.precio.toLocaleString("es-AR")}${c.m2 ? ` | ${c.m2} m²` : ""}`
        ).join("\n")
      : "\n(No se obtuvieron comparables reales de portales. Usar estimados del mercado.)"

    const preciosSection = buildPreciosSection(preciosAuto, hoy)

    const prompt = `Sos un tasador inmobiliario matriculado especialista en Rosario y Argentina. Fecha: ${hoy}.

════════════ PRECIOS DE MERCADO VIGENTES — ${hoy} ════════════
${preciosSection}

ALQUILERES CABA (ARS/mes referencia):
- 2 amb (50-65m2): ARS 1.100.000 - 1.900.000
- 3 amb (65-90m2): ARS 1.500.000 - 2.600.000

ALQUILERES GBA (ARS/mes referencia):
- Zona norte premium: ARS 1.000.000 - 1.600.000
- Zona oeste/sur: ARS 700.000 - 1.150.000

════════════ PROPIEDAD A TASAR ════════════
Tipo: ${datos.tipo}
Operacion: ${datos.operacion}
Barrio: ${datos.barrio}
Direccion: ${datos.direccion || "No especificada"}
Superficie cubierta: ${datos.sup_cubierta} m2
${datos.sup_total ? `Superficie total: ${datos.sup_total} m2` : ""}
Ambientes: ${datos.ambientes}
Dormitorios: ${datos.dormitorios || "No especificado"}
Banos: ${datos.banos || "No especificado"}
Antiguedad: ${datos.antiguedad ? `${datos.antiguedad} anios` : "No especificada"}
Estado: ${datos.estado}
Piso: ${datos.piso || "No aplica"}
Cochera: ${datos.cochera ? "Si" : "No"}
Amenities: ${datos.amenities || "Ninguno"}
Observaciones: ${datos.observaciones || "Ninguna"}
${comparablesTexto}

════════════ INSTRUCCIONES ════════════
1. Analizá los comparables reales de los portales (listados arriba con índice 1, 2, 3...) para calibrar el precio.
2. En "indices_comparables" devolvé los índices (1-based) de los 3 a 5 comparables más relevantes para esta propiedad, ordenados de mayor a menor relevancia. Si no hay comparables reales, devolvé array vacío.
3. El valor_min y valor_max deben derivarse directamente del rango de precios de los comparables seleccionados, ajustado por diferencias de m², estado y zona.
4. El alquiler_estimado DEBE estar dentro de los rangos de mercado indicados arriba, nunca por debajo de los mínimos. Datos: ${preciosAuto ? "actualizados automáticamente desde portales" : "estimados 2026"}.
5. El analisis debe mencionar los portales consultados (ZonaProp, Argenprop, Propia, MercadoLibre) y la fecha ${hoy}, y explicar cómo los comparables justifican el rango de valor.`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      tools: [tasacionTool],
      tool_choice: { type: "tool", name: "tasacion_result" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find(b => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Respuesta invalida de IA." }, { status: 500 });
    }

    const input = toolUse.input as Record<string, unknown>
    const indices: number[] = Array.isArray(input.indices_comparables) ? (input.indices_comparables as number[]) : []
    // Resolve selected indices to real scraped comparables (1-based)
    const comparablesSeleccionados = indices
      .map(idx => comparablesFiltrados[idx - 1])
      .filter(Boolean)
      .slice(0, 5)
    // Use: AI-selected → first 3 scraped → portal search stubs
    const comparablesReales = comparablesSeleccionados.length > 0
      ? comparablesSeleccionados
      : comparablesFiltrados.length > 0
        ? comparablesFiltrados.slice(0, 3)
        : portalesStub

    const resultadoFinal = {
      ...input,
      comparables_reales: comparablesReales,
      _portales_consultados: [
        resZona.status === "fulfilled" && resZona.value.length > 0 ? "ZonaProp" : null,
        resArgen.status === "fulfilled" && resArgen.value.length > 0 ? "Argenprop" : null,
        resML.status === "fulfilled" && resML.value.length > 0 ? "MercadoLibre" : null,
        resPropia.status === "fulfilled" && resPropia.value.length > 0 ? "Propia" : null,
        resPropiaCom.status === "fulfilled" && resPropiaCom.value.length > 0 ? "Propia.com.ar" : null,
      ].filter(Boolean),
      _total_comparables_encontrados: comparablesFiltrados.length,
      _comparables_tipo: comparablesFiltrados.length > 0 ? "reales" : "busqueda",
    }
    return NextResponse.json(resultadoFinal);
  } catch {
    return NextResponse.json({ error: "Error al procesar la tasacion." }, { status: 500 });
  }
}
