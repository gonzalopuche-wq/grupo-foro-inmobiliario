// app/b/[slug]/page.tsx

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ClienteListaView from './ClienteListaView'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params

  const { data: lista } = await supabase
    .from('crm_listas_busqueda')
    .select('nombre, descripcion')
    .eq('slug', slug)
    .eq('publica', true)
    .single()

  if (!lista) return { title: 'Lista no encontrada — GFI®' }

  return {
    title: `${lista.nombre} — GFI® Grupo Foro Inmobiliario`,
    description: lista.descripcion || 'Propiedades seleccionadas por tu corredor inmobiliario',
    openGraph: {
      title: lista.nombre,
      description: lista.descripcion || 'Propiedades seleccionadas por tu corredor',
    },
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params

  const { data: lista } = await supabase
    .from('crm_listas_busqueda')
    .select(`
      id, nombre, descripcion, slug, created_at, updated_at,
      corredor:perfiles(nombre, apellido, matricula, telefono, foto_url, email)
    `)
    .eq('slug', slug)
    .eq('publica', true)
    .single()

  if (!lista) notFound()

  const { data: propiedades } = await supabase
    .from('crm_propiedades_guardadas')
    .select('*')
    .eq('lista_id', lista.id)
    .order('destacada', { ascending: false })
    .order('orden', { ascending: true })

  const hace48hs = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: alertas } = await supabase
    .from('crm_busqueda_alertas')
    .select('propiedad_id, tipo, valor_anterior, valor_nuevo, created_at')
    .eq('lista_id', lista.id)
    .gte('created_at', hace48hs)

  return (
    <ClienteListaView
      lista={lista as any}
      propiedades={propiedades || []}
      alertasRecientes={alertas || []}
    />
  )
}
