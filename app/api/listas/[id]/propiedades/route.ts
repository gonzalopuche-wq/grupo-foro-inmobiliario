// app/api/listas/[id]/propiedades/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { user: null, supabase: null }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return { user, supabase }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase } = await getUser(req)
  if (!user || !supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const { data, error } = await supabase
    .from('crm_propiedades_guardadas')
    .select('*')
    .eq('lista_id', id)
    .eq('corredor_id', user.id)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase } = await getUser(req)
  if (!user || !supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const { data: lista } = await supabase
    .from('crm_listas_busqueda')
    .select('id')
    .eq('id', id)
    .eq('corredor_id', user.id)
    .single()
  if (!lista) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })

  const { data: existe } = await supabase
    .from('crm_propiedades_guardadas')
    .select('id')
    .eq('lista_id', id)
    .eq('url_original', body.url_original)
    .maybeSingle()
  if (existe) return NextResponse.json({ error: 'Ya está en la lista', id: existe.id }, { status: 409 })

  const { data, error } = await supabase
    .from('crm_propiedades_guardadas')
    .insert({ ...body, lista_id: id, corredor_id: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('crm_busqueda_alertas').insert({
    propiedad_id: data.id,
    lista_id: id,
    corredor_id: user.id,
    tipo: 'nuevo',
    valor_nuevo: data.precio_actual ? `${data.moneda} ${data.precio_actual.toLocaleString()}` : 'Sin precio',
  })
  return NextResponse.json(data)
}
