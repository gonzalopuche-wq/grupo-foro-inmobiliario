// app/api/busqueda-publica/[slug]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data: lista, error } = await supabase
    .from('crm_listas_busqueda')
    .select(`
      id, nombre, descripcion, slug, created_at, updated_at,
      corredor:perfiles(nombre, apellido, matricula, telefono, foto_url)
    `)
    .eq('slug', slug)
    .eq('publica', true)
    .single()

  if (error || !lista) {
    return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
  }

  const { data: propiedades } = await supabase
    .from('crm_propiedades_guardadas')
    .select('*')
    .eq('lista_id', lista.id)
    .order('destacada', { ascending: false })
    .order('orden', { ascending: true })
    .order('created_at', { ascending: false })

  const hace48hs = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: alertas } = await supabase
    .from('crm_busqueda_alertas')
    .select('propiedad_id, tipo, valor_anterior, valor_nuevo, created_at')
    .eq('lista_id', lista.id)
    .gte('created_at', hace48hs)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    lista,
    propiedades: propiedades || [],
    alertas_recientes: alertas || [],
  })
}
