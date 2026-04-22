// app/api/scraper/buscar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

export interface PropiedadResultado {
  portal: 'zonaprop' | 'argenprop' | 'mercadolibre' | 'infocasas'
  portal_id: string
  url_original: string
  titulo: string
  descripcion?: string
  tipo?: string
  operacion?: string
  barrio?: string
  ciudad?: string
  direccion?: string
  precio_actual?: number
  moneda?: string
  expensas?: number
  superficie_total?: number
  superficie_cubierta?: number
  dormitorios?: number
  banos?: number
  ambientes?: number
  imagen_principal?: string
  imagenes?: string[]
  disponible: boolean
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-AR,es;q=0.9',
  'Referer': 'https://www.zonaprop.com.ar/',
}

interface BusquedaParams {
  operacion: string
  tipo: string
  zona: string
  precioMin?: number
  precioMax?: number
  dormitorios?: number
  portales?: string[]
}

async function buscarZonaProp(params: BusquedaParams): Promise<PropiedadResultado[]> {
  try {
    const { operacion, tipo, zona, precioMin, precioMax, dormitorios } = params
    const operacionMap: Record<string, string> = { venta: 'venta', alquiler: 'alquiler', 'alquiler-temporal': 'alquiler-temporal' }
    const tipoMap: Record<string, string> = { departamento: 'departamento', casa: 'casa', ph: 'ph', local: 'local', oficina: 'oficina', terreno: 'terreno' }
    const op = operacionMap[operacion] || 'venta'
    const tp = tipoMap[tipo] || 'departamento'
    const zonaSlug = zona.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    let url = `https://www.zonaprop.com.ar/${tp}-${op}-${zonaSlug}`
    const queryParts: string[] = []
    if (precioMin) queryParts.push(`preciomin=${precioMin}`)
    if (precioMax) queryParts.push(`preciomax=${precioMax}`)
    if (dormitorios) queryParts.push(`ambientes=${dormitorios}`)
    queryParts.push('orden=relevancia-DESC')
    url += '.html?' + queryParts.join('&')
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const html = await res.text()
    const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.+?});\s*<\/script>/s)
    if (!match) return []
    const state = JSON.parse(match[1])
    const listings = state?.listPostings || state?.searchResult?.listings || []
    return listings.slice(0, 20).map((item: any) => {
      const posting = item.postingInfo || item
      const precio = posting.price || posting.operationPrice?.[0]
      return {
        portal: 'zonaprop' as const,
        portal_id: String(posting.postingId || posting.id || ''),
        url_original: `https://www.zonaprop.com.ar${posting.url || ''}`,
        titulo: posting.title || posting.address || '',
        descripcion: posting.description?.substr(0, 500),
        tipo: tp, operacion: op,
        barrio: posting.location?.neighbourhood || '',
        ciudad: posting.location?.city || 'Rosario',
        direccion: posting.address || '',
        precio_actual: precio?.amount || precio?.value,
        moneda: precio?.currency === 'ARS' ? 'ARS' : 'USD',
        expensas: posting.expenses?.amount,
        superficie_total: posting.totalSurface || posting.surface,
        superficie_cubierta: posting.coveredSurface,
        dormitorios: posting.bedrooms || posting.rooms,
        banos: posting.bathrooms,
        ambientes: posting.rooms || posting.ambientes,
        imagen_principal: posting.photos?.[0]?.url || posting.pictures?.[0],
        imagenes: (posting.photos || []).slice(0, 8).map((p: any) => p.url || p),
        disponible: true,
      }
    }).filter((p: PropiedadResultado) => p.portal_id)
  } catch (err) {
    console.error('ZonaProp error:', err)
    return []
  }
}

async function buscarArgenprop(params: BusquedaParams): Promise<PropiedadResultado[]> {
  try {
    const { operacion, tipo, zona, precioMin, precioMax, dormitorios } = params
    const op = operacion === 'alquiler' ? 'alquiler' : 'venta'
    const zonaSlug = zona.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const tipoSlug = (tipo || 'departamento').toLowerCase()
    const apiUrl = new URL('https://www.argenprop.com/api/v2/listing/search')
    apiUrl.searchParams.set('operationType', op === 'venta' ? '1' : '2')
    apiUrl.searchParams.set('propertyType', tipoSlug)
    apiUrl.searchParams.set('location', `rosario-${zonaSlug}`)
    apiUrl.searchParams.set('page', '1')
    apiUrl.searchParams.set('pageSize', '20')
    if (precioMin) apiUrl.searchParams.set('priceMin', String(precioMin))
    if (precioMax) apiUrl.searchParams.set('priceMax', String(precioMax))
    if (dormitorios) apiUrl.searchParams.set('rooms', String(dormitorios))
    const res = await fetch(apiUrl.toString(), { headers: { ...HEADERS, Referer: 'https://www.argenprop.com/' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    const listings = data?.items || data?.data?.items || []
    return listings.slice(0, 20).map((item: any) => ({
      portal: 'argenprop' as const,
      portal_id: String(item.id || item.listingId || ''),
      url_original: `https://www.argenprop.com${item.url || item.link || ''}`,
      titulo: item.title || item.address || '',
      descripcion: item.description?.substr(0, 500),
      tipo: tipoSlug, operacion: op,
      barrio: item.location?.neighbourhood || '',
      ciudad: item.location?.city || 'Rosario',
      direccion: item.address || item.location?.address || '',
      precio_actual: item.price?.amount || item.price,
      moneda: item.price?.currency === 'ARS' ? 'ARS' : 'USD',
      expensas: item.expenses?.amount || item.expenses,
      superficie_total: item.totalArea || item.surface,
      superficie_cubierta: item.coveredArea,
      dormitorios: item.bedrooms || item.rooms,
      banos: item.bathrooms,
      ambientes: item.rooms,
      imagen_principal: item.photos?.[0]?.url || item.mainPhoto,
      imagenes: (item.photos || []).slice(0, 8).map((p: any) => p.url || p),
      disponible: true,
    })).filter((p: PropiedadResultado) => p.portal_id)
  } catch (err) {
    console.error('Argenprop error:', err)
    return []
  }
}

async function buscarMercadoLibre(params: BusquedaParams): Promise<PropiedadResultado[]> {
  try {
    const { operacion, tipo, zona, precioMin, precioMax } = params
    const catMap: Record<string, string> = { venta: 'MLA1459', alquiler: 'MLA1480' }
    const categoria = catMap[operacion] || 'MLA1459'
    const apiUrl = new URL('https://api.mercadolibre.com/sites/MLA/search')
    apiUrl.searchParams.set('category', categoria)
    apiUrl.searchParams.set('q', `${tipo || 'departamento'} ${zona} Rosario`)
    apiUrl.searchParams.set('limit', '20')
    apiUrl.searchParams.set('offset', '0')
    if (precioMin) apiUrl.searchParams.set('price', `${precioMin}-*`)
    if (precioMax) {
      const precio = apiUrl.searchParams.get('price')
      apiUrl.searchParams.set('price', precio ? precio.replace('*', String(precioMax)) : `*-${precioMax}`)
    }
    const res = await fetch(apiUrl.toString(), { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    const results = data?.results || []
    return results.map((item: any) => {
      const atributos: Record<string, string> = {}
      ;(item.attributes || []).forEach((a: any) => { atributos[a.id] = a.value_name || '' })
      return {
        portal: 'mercadolibre' as const,
        portal_id: String(item.id || ''),
        url_original: item.permalink || '',
        titulo: item.title || '',
        descripcion: '',
        tipo: tipo || '', operacion,
        barrio: atributos['NEIGHBORHOOD'] || '',
        ciudad: atributos['CITY'] || 'Rosario',
        direccion: atributos['LOCATION_DETAILS'] || '',
        precio_actual: item.price,
        moneda: item.currency_id === 'ARS' ? 'ARS' : 'USD',
        expensas: undefined,
        superficie_total: parseFloat(atributos['TOTAL_AREA'] || '0') || undefined,
        superficie_cubierta: parseFloat(atributos['COVERED_AREA'] || '0') || undefined,
        dormitorios: parseInt(atributos['BEDROOMS'] || '0') || undefined,
        banos: parseInt(atributos['BATHROOMS'] || '0') || undefined,
        ambientes: parseInt(atributos['ROOMS'] || '0') || undefined,
        imagen_principal: item.thumbnail?.replace('-I.jpg', '-O.jpg'),
        imagenes: item.pictures?.map((p: any) => p.url?.replace('-I.jpg', '-O.jpg')).filter(Boolean) || [],
        disponible: item.status === 'active',
      }
    }).filter((p: PropiedadResultado) => p.portal_id)
  } catch (err) {
    console.error('MercadoLibre error:', err)
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const params: BusquedaParams = await req.json()
    const portales = params.portales || ['zonaprop', 'argenprop', 'mercadolibre']

    const promesas: Promise<PropiedadResultado[]>[] = []
    if (portales.includes('zonaprop')) promesas.push(buscarZonaProp(params))
    if (portales.includes('argenprop')) promesas.push(buscarArgenprop(params))
    if (portales.includes('mercadolibre')) promesas.push(buscarMercadoLibre(params))

    const resultados = await Promise.allSettled(promesas)
    const propiedades: PropiedadResultado[] = []
    resultados.forEach(r => { if (r.status === 'fulfilled') propiedades.push(...r.value) })

    const unicos = propiedades.filter((p, i, arr) =>
      arr.findIndex(x => x.url_original === p.url_original) === i
    )

    return NextResponse.json({ total: unicos.length, propiedades: unicos })
  } catch (err) {
    console.error('Error scraper:', err)
    return NextResponse.json({ error: 'Error en búsqueda' }, { status: 500 })
  }
}
