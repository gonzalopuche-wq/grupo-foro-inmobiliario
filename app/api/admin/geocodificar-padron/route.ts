import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LOTE = 50
const DELAY_MS = 1100 // Nominatim: max 1 req/seg

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function geocodificar(direccion: string, localidad: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(`${direccion}, ${localidad}, Santa Fe, Argentina`)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ar`,
      { headers: { 'User-Agent': 'GrupoForoInmobiliario/1.0', 'Accept-Language': 'es' } }
    )
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { /* ignorar */ }
  return null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: registros } = await sb
    .from('cocir_padron')
    .select('id, direccion, localidad')
    .is('latitud', null)
    .not('direccion', 'is', null)
    .not('localidad', 'is', null)
    .limit(LOTE)

  if (!registros || registros.length === 0) {
    return NextResponse.json({ ok: true, geocodificados: 0, mensaje: 'Todos los registros ya tienen coordenadas' })
  }

  let geocodificados = 0
  let fallidos = 0
  const ahora = new Date().toISOString()

  for (const r of registros) {
    const coords = await geocodificar(r.direccion, r.localidad)
    if (coords) {
      await sb.from('cocir_padron').update({
        latitud: coords.lat,
        longitud: coords.lng,
        geocodificado_at: ahora,
      }).eq('id', r.id)
      geocodificados++
    } else {
      // Marcar con coordenada inválida para no reintentar indefinidamente
      await sb.from('cocir_padron').update({ geocodificado_at: ahora }).eq('id', r.id)
      fallidos++
    }
    await sleep(DELAY_MS)
  }

  return NextResponse.json({
    ok: true,
    geocodificados,
    fallidos,
    procesados: registros.length,
    pendientes_aprox: 'consultar DB',
  })
}
