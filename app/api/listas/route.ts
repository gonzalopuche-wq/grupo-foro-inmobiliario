// app/api/listas/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { user: null, supabase: null }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return { user, supabase }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUser(req)
  if (!user || !supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const contacto_id = searchParams.get('contacto_id')

  let query = supabase
    .from('crm_listas_busqueda')
    .select(`*, contacto:crm_contactos(id, nombre, apellido, email), propiedades:crm_propiedades_guardadas(count)`)
    .eq('corredor_id', user.id)
    .order('created_at', { ascending: false })

  if (contacto_id) query = query.eq('contacto_id', contacto_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUser(req)
  if (!user || !supabase) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { nombre, contacto_id, descripcion, criterios, email_cliente, notificar_cliente } = body
  if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('crm_listas_busqueda')
    .insert({
      corredor_id: user.id,
      nombre,
      contacto_id: contacto_id || null,
      descripcion,
      criterios: criterios || {},
      email_cliente,
      notificar_cliente: notificar_cliente ?? true,
      publica: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
