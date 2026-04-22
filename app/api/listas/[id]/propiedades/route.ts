// app/api/listas/[id]/propiedades/route.ts
// Agregar / listar propiedades en una lista

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET — traer propiedades de una lista
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('crm_propiedades_guardadas')
    .select('*')
    .eq('lista_id', params.id)
    .eq('corredor_id', session.user.id)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — guardar propiedad en lista
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()

  // Verificar que la lista pertenece al corredor
  const { data: lista } = await supabase
    .from('crm_listas_busqueda')
    .select('id')
    .eq('id', params.id)
    .eq('corredor_id', session.user.id)
    .single()

  if (!lista) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })

  // Verificar si ya existe (por url_original)
  const { data: existe } = await supabase
    .from('crm_propiedades_guardadas')
    .select('id')
    .eq('lista_id', params.id)
    .eq('url_original', body.url_original)
    .single()

  if (existe) return NextResponse.json({ error: 'Ya está en la lista', id: existe.id }, { status: 409 })

  const { data, error } = await supabase
    .from('crm_propiedades_guardadas')
    .insert({
      ...body,
      lista_id: params.id,
      corredor_id: session.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar alerta tipo 'nuevo'
  await supabase.from('crm_busqueda_alertas').insert({
    propiedad_id: data.id,
    lista_id: params.id,
    corredor_id: session.user.id,
    tipo: 'nuevo',
    valor_nuevo: data.precio_actual ? `${data.moneda} ${data.precio_actual.toLocaleString()}` : 'Sin precio',
  })

  return NextResponse.json(data)
}
