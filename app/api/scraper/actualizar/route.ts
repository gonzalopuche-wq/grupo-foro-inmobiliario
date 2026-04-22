// app/api/scraper/actualizar/route.ts
// Cron job: verifica cambios de precio y disponibilidad en propiedades guardadas
// Llamar desde Vercel Cron Jobs cada 6 horas (configurar en vercel.json)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'es-AR,es;q=0.9',
}

// Verificar precio y disponibilidad de una URL de ZonaProp
async function verificarZonaProp(url: string): Promise<{ precio?: number; disponible: boolean }> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
    if (res.status === 404) return { disponible: false }
    if (!res.ok) return { disponible: true } // asumimos disponible si hay error

    const html = await res.text()

    // Detectar si fue dado de baja
    if (html.includes('Esta publicación no está disponible') ||
        html.includes('fue dada de baja') ||
        html.includes('no existe')) {
      return { disponible: false }
    }

    // Extraer precio del JSON embebido
    const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]+?});\s*<\/script>/)
    if (match) {
      const state = JSON.parse(match[1])
      const posting = state?.posting || state?.realEstate
      const precio = posting?.price?.amount || posting?.operationPrice?.[0]?.amount
      return { precio: precio ? Number(precio) : undefined, disponible: true }
    }

    return { disponible: true }
  } catch {
    return { disponible: true }
  }
}

// Verificar precio y disponibilidad de MercadoLibre via API oficial
async function verificarMercadoLibre(portal_id: string): Promise<{ precio?: number; disponible: boolean }> {
  try {
    const res = await fetch(`https://api.mercadolibre.com/items/${portal_id}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) return { disponible: true }

    const data = await res.json()
    return {
      precio: data.price,
      disponible: data.status === 'active',
    }
  } catch {
    return { disponible: true }
  }
}

// Verificar propiedad según portal
async function verificarPropiedad(prop: any): Promise<{ precio?: number; disponible: boolean }> {
  switch (prop.portal) {
    case 'zonaprop':
      return verificarZonaProp(prop.url_original)
    case 'argenprop':
      return verificarZonaProp(prop.url_original) // mismo método HTML
    case 'mercadolibre':
      return verificarMercadoLibre(prop.portal_id)
    default:
      return { disponible: true }
  }
}

// Enviar email al cliente
async function notificarCliente(
  emailCliente: string,
  listaNombre: string,
  slug: string,
  propTitulo: string,
  tipo: string,
  valorAnterior?: string,
  valorNuevo?: string
) {
  const tipoTexto: Record<string, string> = {
    precio_baja: '🟢 Bajó el precio',
    precio_suba: '🔴 Subió el precio',
    dado_de_baja: '⚫ Ya no disponible',
    vuelto_a_publicar: '🔵 Volvió a publicarse',
  }

  const url = `https://foroinmobiliario.com.ar/b/${slug}`

  await resend.emails.send({
    from: 'GFI® <noreply@foroinmobiliario.com.ar>',
    to: emailCliente,
    subject: `${tipoTexto[tipo] || 'Actualización'} en tu lista "${listaNombre}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">GFI® — Actualización de tu lista</h2>
        <p><strong>${tipoTexto[tipo] || 'Actualización'}</strong></p>
        <p>Propiedad: <strong>${propTitulo}</strong></p>
        ${valorAnterior ? `<p>Precio anterior: ${valorAnterior}</p>` : ''}
        ${valorNuevo ? `<p>Precio actual: <strong>${valorNuevo}</strong></p>` : ''}
        <p>
          <a href="${url}" style="background: #1a56db; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px;">
            Ver lista actualizada
          </a>
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 24px;">
          Esta lista fue preparada especialmente para vos. Si no querés recibir más alertas, contactá a tu corredor.
        </p>
      </div>
    `,
  })
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Validar cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // Traer propiedades disponibles con su lista
    const { data: propiedades, error } = await supabase
      .from('crm_propiedades_guardadas')
      .select(`
        *,
        lista:crm_listas_busqueda(id, nombre, slug, email_cliente, notificar_cliente)
      `)
      .eq('disponible', true)
      .not('portal', 'eq', 'manual') // no verificar las manuales
      .order('updated_at', { ascending: true })
      .limit(100) // procesar de a 100 por cron

    if (error) throw error

    let actualizadas = 0
    let alertas = 0

    for (const prop of (propiedades || [])) {
      try {
        const resultado = await verificarPropiedad(prop)

        let tipo: string | null = null
        let valorAnterior: string | null = null
        let valorNuevo: string | null = null

        // Detectar cambio de disponibilidad
        if (!resultado.disponible && prop.disponible) {
          tipo = 'dado_de_baja'
          await supabase.from('crm_propiedades_guardadas').update({
            disponible: false,
            fecha_baja: new Date().toISOString(),
          }).eq('id', prop.id)
          actualizadas++
        }

        // Detectar cambio de precio
        if (resultado.disponible && resultado.precio && prop.precio_actual) {
          const diff = Math.abs(resultado.precio - prop.precio_actual)
          const porcentaje = (diff / prop.precio_actual) * 100

          if (porcentaje > 0.5) { // cambio > 0.5%
            tipo = resultado.precio < prop.precio_actual ? 'precio_baja' : 'precio_suba'
            valorAnterior = `${prop.moneda} ${prop.precio_actual.toLocaleString('es-AR')}`
            valorNuevo = `${prop.moneda} ${resultado.precio.toLocaleString('es-AR')}`

            await supabase.from('crm_propiedades_guardadas').update({
              precio_anterior: prop.precio_actual,
              precio_actual: resultado.precio,
              precio_actualizado_at: new Date().toISOString(),
            }).eq('id', prop.id)
            actualizadas++
          }
        }

        // Registrar alerta si hubo cambio
        if (tipo) {
          await supabase.from('crm_busqueda_alertas').insert({
            propiedad_id: prop.id,
            lista_id: prop.lista_id,
            corredor_id: prop.corredor_id,
            tipo,
            valor_anterior: valorAnterior,
            valor_nuevo: valorNuevo,
          })
          alertas++

          // Notificar al cliente por email si configurado
          if (prop.lista?.notificar_cliente && prop.lista?.email_cliente) {
            await notificarCliente(
              prop.lista.email_cliente,
              prop.lista.nombre,
              prop.lista.slug,
              prop.titulo,
              tipo,
              valorAnterior || undefined,
              valorNuevo || undefined
            ).catch(err => console.error('Error enviando email:', err))
          }
        }

        // Pequeña pausa para no saturar los portales
        await new Promise(r => setTimeout(r, 500))

      } catch (err) {
        console.error(`Error verificando propiedad ${prop.id}:`, err)
      }
    }

    return NextResponse.json({
      ok: true,
      procesadas: propiedades?.length || 0,
      actualizadas,
      alertas,
    })

  } catch (err) {
    console.error('Error en cron:', err)
    return NextResponse.json({ error: 'Error en actualización' }, { status: 500 })
  }
}
