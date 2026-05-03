import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
const H = { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9", "Accept": "application/json, text/html, */*" }

interface Listing {
  precio: number
  moneda: string
  m2: number | null
  barrio?: string
  portal: string
}

// ─── Scrapers ─────────────────────────────────────────────────────────────────

async function scrapeZP(tipo: string, op: string, zona: string): Promise<Listing[]> {
  try {
    const zonaSlug = zona.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")
    const url = `https://www.zonaprop.com.ar/${tipo}-${op}-${zonaSlug}.html?orden=relevancia-DESC`
    const res = await fetch(url, { headers: { ...H, Referer: "https://www.zonaprop.com.ar/" }, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const html = await res.text()
    const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]+?});\s*<\/script>/)
    if (!match) return []
    const state = JSON.parse(match[1])
    const listings = state?.listPostings || state?.searchResult?.listings || []
    return listings.map((item: any) => {
      const p = item.postingInfo || item
      const precio = p.price || p.operationPrice?.[0]
      return {
        precio: precio?.amount || precio?.value || 0,
        moneda: precio?.currency === "ARS" ? "ARS" : "USD",
        m2: p.coveredSurface || p.totalSurface || p.surface || null,
        barrio: p.location?.neighbourhood || zona,
        portal: "ZonaProp",
      }
    }).filter((l: Listing) => l.precio > 0)
  } catch { return [] }
}

async function scrapeML(tipo: string, op: string, zona: string): Promise<Listing[]> {
  try {
    const catMap: Record<string, string> = { venta: "MLA1459", alquiler: "MLA1480" }
    const cat = catMap[op] || "MLA1459"
    const url = `https://api.mercadolibre.com/sites/MLA/search?category=${cat}&q=${encodeURIComponent(`${tipo} ${zona} Rosario`)}&limit=50`
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.results || []).map((item: any) => {
      const attrs: Record<string, string> = {}
      ;(item.attributes || []).forEach((a: any) => { attrs[a.id] = a.value_name || "" })
      const m2c = parseFloat(attrs["COVERED_AREA"] || "0") || null
      const m2t = parseFloat(attrs["TOTAL_AREA"] || "0") || null
      return {
        precio: item.price || 0,
        moneda: item.currency_id === "ARS" ? "ARS" : "USD",
        m2: m2c || m2t,
        barrio: attrs["NEIGHBORHOOD"] || zona,
        portal: "MercadoLibre",
      }
    }).filter((l: Listing) => l.precio > 0)
  } catch { return [] }
}

// ─── Estadísticas ─────────────────────────────────────────────────────────────

function mediana(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid-1] + sorted[mid]) / 2) : sorted[mid]
}

function percentil(arr: number[], p: number): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.min(idx, sorted.length - 1)]
}

function bucket(m2: number | null): string | null {
  if (!m2) return null
  if (m2 < 50) return "mono"
  if (m2 < 72) return "2amb"
  if (m2 < 100) return "3amb"
  if (m2 < 140) return "4amb"
  return "casa"
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Solo admin
  const auth = req.headers.get("authorization")?.replace("Bearer ", "")
  if (auth) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(auth)
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    const { data: perfil } = await supabaseAdmin.from("perfiles").select("tipo").eq("id", user.id).single()
    if (perfil?.tipo !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 })
  }

  try {
    const hoy = new Date().toISOString()

    // ─ Scrapear en paralelo (alquiler y venta, distintas zonas) ─
    const [
      alqCentroZP, alqCentroML,
      alqFishZP, alqFishML,
      ventaCentroZP, ventaCentroML,
      ventaFishZP,
    ] = await Promise.allSettled([
      scrapeZP("departamento", "alquiler", "rosario"),
      scrapeML("departamento", "alquiler", "rosario"),
      scrapeZP("departamento", "alquiler", "fisherton"),
      scrapeML("departamento", "alquiler", "fisherton"),
      scrapeZP("departamento", "venta", "rosario"),
      scrapeML("departamento", "venta", "rosario"),
      scrapeZP("departamento", "venta", "fisherton"),
    ])

    const alqTodos: Listing[] = [
      ...(alqCentroZP.status === "fulfilled" ? alqCentroZP.value : []),
      ...(alqCentroML.status === "fulfilled" ? alqCentroML.value : []),
      ...(alqFishZP.status === "fulfilled" ? alqFishZP.value : []),
      ...(alqFishML.status === "fulfilled" ? alqFishML.value : []),
    ].filter(l => l.moneda === "ARS" && l.precio > 50000)

    const ventaTodos: Listing[] = [
      ...(ventaCentroZP.status === "fulfilled" ? ventaCentroZP.value : []),
      ...(ventaCentroML.status === "fulfilled" ? ventaCentroML.value : []),
      ...(ventaFishZP.status === "fulfilled" ? ventaFishZP.value : []),
    ].filter(l => l.precio > 5000)

    // ─ Calcular medianas por bucket de m2 ─
    const alqPorBucket: Record<string, number[]> = { mono: [], "2amb": [], "3amb": [], "4amb": [], casa: [] }
    for (const l of alqTodos) {
      const b = bucket(l.m2)
      if (b && alqPorBucket[b]) alqPorBucket[b].push(l.precio)
    }

    // Para venta, calcular USD/m2
    const ventaUSDm2: number[] = []
    for (const l of ventaTodos) {
      if (l.m2 && l.m2 > 20 && l.precio > 1000) {
        const moneda = l.moneda === "ARS" ? "ARS" : "USD"
        // Si precio en ARS, necesitamos convertir — omitimos por ahora (ML los tiene en ARS)
        if (moneda === "USD") ventaUSDm2.push(Math.round(l.precio / l.m2))
      }
    }

    const resultados = {
      alquiler_rosario: [
        {
          label: "Monoambiente / 1 amb (30-45m²)",
          min: percentil(alqPorBucket.mono, 25) || 600000,
          max: percentil(alqPorBucket.mono, 75) || 950000,
          mediana: mediana(alqPorBucket.mono) || 750000,
          n: alqPorBucket.mono.length,
          moneda: "ARS",
        },
        {
          label: "2 ambientes (45-65m²)",
          min: percentil(alqPorBucket["2amb"], 25) || 850000,
          max: percentil(alqPorBucket["2amb"], 75) || 1350000,
          mediana: mediana(alqPorBucket["2amb"]) || 1050000,
          n: alqPorBucket["2amb"].length,
          moneda: "ARS",
        },
        {
          label: "3 ambientes (65-90m²)",
          min: percentil(alqPorBucket["3amb"], 25) || 1200000,
          max: percentil(alqPorBucket["3amb"], 75) || 1900000,
          mediana: mediana(alqPorBucket["3amb"]) || 1500000,
          n: alqPorBucket["3amb"].length,
          moneda: "ARS",
        },
        {
          label: "4+ ambientes / PH",
          min: percentil(alqPorBucket["4amb"], 25) || 1700000,
          max: percentil(alqPorBucket["4amb"], 75) || 2800000,
          mediana: mediana(alqPorBucket["4amb"]) || 2200000,
          n: alqPorBucket["4amb"].length,
          moneda: "ARS",
        },
        {
          label: "Casas",
          min: percentil(alqPorBucket.casa, 25) || 1400000,
          max: percentil(alqPorBucket.casa, 75) || 3500000,
          mediana: mediana(alqPorBucket.casa) || 2200000,
          n: alqPorBucket.casa.length,
          moneda: "ARS",
        },
      ],
      venta_rosario: ventaUSDm2.length >= 5 ? [
        {
          label: "USD/m² promedio mercado Rosario (portal data)",
          min: percentil(ventaUSDm2, 25),
          max: percentil(ventaUSDm2, 75),
          mediana: mediana(ventaUSDm2),
          n: ventaUSDm2.length,
          moneda: "USD_m2",
        },
      ] : [],
      total_listings_procesados: alqTodos.length + ventaTodos.length,
      portales: ["ZonaProp", "MercadoLibre"],
      actualizado: hoy,
    }

    // Guardar en indicadores
    await supabaseAdmin.from("indicadores").upsert(
      { clave: "tasador_precios_auto", valor: 0, valor_texto: JSON.stringify(resultados) },
      { onConflict: "clave" }
    )

    return NextResponse.json({ ok: true, ...resultados })
  } catch (err) {
    console.error("actualizar-mercado error:", err)
    return NextResponse.json({ error: "Error calculando precios" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("indicadores")
      .select("valor_texto, updated_at")
      .eq("clave", "tasador_precios_auto")
      .single()
    if (!data?.valor_texto) return NextResponse.json({ datos: null })
    return NextResponse.json({ datos: JSON.parse(data.valor_texto), actualizado: data.updated_at })
  } catch {
    return NextResponse.json({ datos: null })
  }
}
