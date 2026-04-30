// app/api/indicadores/route.ts
// Trae ICL, IPC, Valor JUS con historial y fallback automático desde fuentes externas

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Intentar traer ICL desde API del BCRA v4.0
// Variable 40 = ICL (índice diario). Guardamos el valor del último día disponible.
// calcICL en el dashboard usa (valorActual / valorAnterior - 1) * 100 para calcular variación.
async function fetchICLBCRA(): Promise<{ valor: number; periodo: string } | null> {
  try {
    const res = await fetch(
      'https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/40?limit=1',
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const detalle = data?.results?.[0]?.detalle
    if (!detalle || detalle.length === 0) return null
    const ultimo = detalle[0]
    return {
      valor: ultimo.valor,
      periodo: ultimo.fecha?.substring(0, 7) ?? '',
    }
  } catch {
    return null
  }
}

// Intentar traer IPC desde API del INDEC
async function fetchIPCINDEC(): Promise<{ valor: number; periodo: string } | null> {
  try {
    // INDEC API pública
    const res = await fetch(
      'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_26&limit=1&sort=desc',
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const datos = data?.data
    if (!datos || datos.length === 0) return null
    const [fecha, valor] = datos[0]
    return { valor: parseFloat(valor), periodo: fecha?.substring(0, 7) ?? '' }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const meses = parseInt(searchParams.get('meses') || '6')

  // 1. Intentar actualizar desde fuentes externas
  const [iclExterno, ipcExterno] = await Promise.allSettled([
    fetchICLBCRA(),
    fetchIPCINDEC(),
  ])

  // Si trajimos datos nuevos, guardarlos
  if (iclExterno.status === 'fulfilled' && iclExterno.value) {
    const { valor, periodo } = iclExterno.value
    // Guardar en historial si no existe este período
    await supabase.from('indicadores_historial').upsert({
      clave: 'icl',
      valor,
      periodo,
      descripcion: `ICL ${periodo}`,
      fuente: 'BCRA',
    }, { onConflict: 'clave,periodo', ignoreDuplicates: true })

    // Actualizar tabla indicadores con el último valor
    await supabase.from('indicadores').upsert({
      clave: 'icl_diario',
      valor,
      descripcion: `ICL - Índice Contratos Locación - BCRA - ${periodo}`,
      actualizado_at: new Date().toISOString(),
    }, { onConflict: 'clave' })
  }

  if (ipcExterno.status === 'fulfilled' && ipcExterno.value) {
    const { valor, periodo } = ipcExterno.value
    await supabase.from('indicadores_historial').upsert({
      clave: 'ipc',
      valor,
      periodo,
      descripcion: `IPC mensual ${periodo}`,
      fuente: 'INDEC',
    }, { onConflict: 'clave,periodo', ignoreDuplicates: true })

    await supabase.from('indicadores').upsert({
      clave: 'ipc_mensual',
      valor,
      descripcion: `IPC Mensual - INDEC - ${periodo}`,
      actualizado_at: new Date().toISOString(),
    }, { onConflict: 'clave' })
  }

  // 2. Traer últimos valores de indicadores
  const { data: indicadores } = await supabase
    .from('indicadores')
    .select('clave, valor, descripcion, actualizado_at')
    .in('clave', ['icl_diario', 'ipc_mensual', 'valor_jus', 'icl_periodo', 'ipc_periodo'])

  const indMap: Record<string, any> = {}
  ;(indicadores || []).forEach(i => { indMap[i.clave] = i })

  // 3. Traer historial de los últimos N meses
  const fechaDesde = new Date()
  fechaDesde.setMonth(fechaDesde.getMonth() - meses)
  const periodoDesde = fechaDesde.toISOString().substring(0, 7)

  const { data: historialICL } = await supabase
    .from('indicadores_historial')
    .select('valor, periodo, descripcion, fuente, actualizado_at')
    .eq('clave', 'icl')
    .gte('periodo', periodoDesde)
    .order('periodo', { ascending: false })

  const { data: historialIPC } = await supabase
    .from('indicadores_historial')
    .select('valor, periodo, descripcion, fuente, actualizado_at')
    .eq('clave', 'ipc')
    .gte('periodo', periodoDesde)
    .order('periodo', { ascending: false })

  return NextResponse.json({
    icl: {
      actual: indMap['icl_diario']?.valor ?? null,
      periodo: indMap['icl_periodo']?.valor ?? indMap['icl_diario']?.descripcion ?? null,
      descripcion: indMap['icl_diario']?.descripcion ?? null,
      actualizado_at: indMap['icl_diario']?.actualizado_at ?? null,
      historial: historialICL || [],
      fuente: 'BCRA',
    },
    ipc: {
      actual: indMap['ipc_mensual']?.valor ?? null,
      periodo: indMap['ipc_periodo']?.valor ?? indMap['ipc_mensual']?.descripcion ?? null,
      descripcion: indMap['ipc_mensual']?.descripcion ?? null,
      actualizado_at: indMap['ipc_mensual']?.actualizado_at ?? null,
      historial: historialIPC || [],
      fuente: 'INDEC',
    },
    valor_jus: {
      actual: indMap['valor_jus']?.valor ?? null,
      descripcion: indMap['valor_jus']?.descripcion ?? null,
      actualizado_at: indMap['valor_jus']?.actualizado_at ?? null,
    },
  })
}
