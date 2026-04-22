// app/b/[slug]/ClienteListaView.tsx
'use client'

import { useState } from 'react'
import { ExternalLink, Phone, Mail, MapPin, BedDouble, Bath, Square,
         TrendingDown, TrendingUp, X as XIcon, CheckCircle2, Clock,
         Building2, ChevronLeft, ChevronRight } from 'lucide-react'

interface Corredor {
  nombre: string
  apellido: string
  matricula?: string
  telefono?: string
  email?: string
  foto_url?: string
}

interface Propiedad {
  id: string
  portal: string
  url_original: string
  titulo: string
  descripcion?: string
  tipo?: string
  operacion?: string
  barrio?: string
  ciudad?: string
  direccion?: string
  precio_actual?: number
  precio_anterior?: number
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
  destacada: boolean
}

interface Alerta {
  propiedad_id: string
  tipo: string
  valor_anterior?: string
  valor_nuevo?: string
  created_at: string
}

interface Props {
  lista: {
    nombre: string
    descripcion?: string
    slug: string
    updated_at: string
    corredor: Corredor
  }
  propiedades: Propiedad[]
  alertasRecientes: Alerta[]
}

const PORTAL_LABELS: Record<string, string> = {
  zonaprop: 'ZonaProp',
  argenprop: 'Argenprop',
  mercadolibre: 'MercadoLibre',
  infocasas: 'InfoCasas',
  manual: 'Manual',
}

function PropCard({ propiedad, alertas }: { propiedad: Propiedad; alertas: Alerta[] }) {
  const [imgIdx, setImgIdx] = useState(0)
  const [imgError, setImgError] = useState(false)

  const alertaProp = alertas.find(a => a.propiedad_id === propiedad.id)
  const imagenes = propiedad.imagenes?.length
    ? propiedad.imagenes
    : propiedad.imagen_principal
    ? [propiedad.imagen_principal]
    : []

  const formatPrecio = (n?: number, m?: string) =>
    n ? `${m === 'ARS' ? '$' : 'U$D'} ${n.toLocaleString('es-AR')}` : 'Consultar'

  const badgeAlerta = () => {
    if (!alertaProp) return null
    if (alertaProp.tipo === 'dado_de_baja') {
      return (
        <div className="absolute top-3 left-3 bg-gray-900/90 text-gray-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
          <XIcon className="w-3 h-3" /> Ya no disponible
        </div>
      )
    }
    if (alertaProp.tipo === 'precio_baja') {
      return (
        <div className="absolute top-3 left-3 bg-green-900/90 text-green-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
          <TrendingDown className="w-3 h-3" /> Bajó el precio
        </div>
      )
    }
    if (alertaProp.tipo === 'precio_suba') {
      return (
        <div className="absolute top-3 left-3 bg-orange-900/90 text-orange-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
          <TrendingUp className="w-3 h-3" /> Subió el precio
        </div>
      )
    }
    return null
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
      !propiedad.disponible ? 'opacity-60' : ''
    } ${propiedad.destacada ? 'ring-2 ring-blue-500' : ''}`}>

      {/* Imagen */}
      <div className="relative h-52 bg-gray-100">
        {imagenes.length > 0 && !imgError ? (
          <>
            <img
              src={imagenes[imgIdx]}
              alt={propiedad.titulo}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            {imagenes.length > 1 && (
              <>
                <button
                  onClick={() => setImgIdx(i => Math.max(0, i - 1))}
                  disabled={imgIdx === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setImgIdx(i => Math.min(imagenes.length - 1, i + 1))}
                  disabled={imgIdx === imagenes.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {imagenes.slice(0, 6).map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? 'bg-white' : 'bg-white/40'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Building2 className="w-12 h-12" />
          </div>
        )}

        {badgeAlerta()}

        {propiedad.destacada && (
          <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
            ★ Destacada
          </div>
        )}

        {/* Portal badge */}
        <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
          {PORTAL_LABELS[propiedad.portal]}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">
            {propiedad.titulo}
          </h3>
          {propiedad.barrio && (
            <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {propiedad.barrio}{propiedad.ciudad ? `, ${propiedad.ciudad}` : ''}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          {propiedad.ambientes && <span>{propiedad.ambientes} amb.</span>}
          {propiedad.dormitorios && (
            <span className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5" />{propiedad.dormitorios} dorm.
            </span>
          )}
          {propiedad.banos && (
            <span className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" />{propiedad.banos} baños
            </span>
          )}
          {propiedad.superficie_total && (
            <span className="flex items-center gap-1">
              <Square className="w-3.5 h-3.5" />{propiedad.superficie_total} m²
            </span>
          )}
        </div>

        {/* Precio */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900">
              {formatPrecio(propiedad.precio_actual, propiedad.moneda)}
            </span>
            {propiedad.precio_anterior && propiedad.precio_anterior !== propiedad.precio_actual && (
              <span className="text-sm text-gray-400 line-through">
                {formatPrecio(propiedad.precio_anterior, propiedad.moneda)}
              </span>
            )}
          </div>
          {propiedad.expensas && (
            <p className="text-xs text-gray-500 mt-0.5">
              + $ {propiedad.expensas.toLocaleString('es-AR')} expensas
            </p>
          )}
        </div>

        {propiedad.descripcion && (
          <p className="text-xs text-gray-500 line-clamp-2">{propiedad.descripcion}</p>
        )}

        <a
          href={propiedad.url_original}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-gray-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Ver en {PORTAL_LABELS[propiedad.portal]}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}

export default function ClienteListaView({ lista, propiedades, alertasRecientes }: Props) {
  const { corredor } = lista
  const disponibles = propiedades.filter(p => p.disponible)
  const dadosDeBaja = propiedades.filter(p => !p.disponible)

  const actualizacion = new Date(lista.updated_at).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const whatsappUrl = corredor.telefono
    ? `https://wa.me/${corredor.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${corredor.nombre}, vi la lista de propiedades que me enviaste`)}`
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {corredor.foto_url ? (
                <img src={corredor.foto_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                  {corredor.nombre[0]}{corredor.apellido[0]}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {corredor.nombre} {corredor.apellido}
                </p>
                {corredor.matricula && (
                  <p className="text-xs text-gray-500">Mat. {corredor.matricula}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  <Phone className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              )}
              {corredor.email && (
                <a
                  href={`mailto:${corredor.email}`}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Título de la lista */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lista.nombre}</h1>
          {lista.descripcion && (
            <p className="text-gray-600 mt-1">{lista.descripcion}</p>
          )}
          <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-2">
            <Clock className="w-3.5 h-3.5" />
            Actualizado el {actualizacion} · {disponibles.length} propiedad{disponibles.length !== 1 ? 'es' : ''} disponible{disponibles.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Alertas recientes */}
        {alertasRecientes.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-800 font-medium text-sm mb-2">
              Novedades en las últimas 48 horas:
            </p>
            <ul className="space-y-1">
              {alertasRecientes.slice(0, 5).map((a, i) => {
                const prop = propiedades.find(p => p.id === a.propiedad_id)
                if (!prop) return null
                const textos: Record<string, string> = {
                  precio_baja: '↓ Bajó el precio',
                  precio_suba: '↑ Subió el precio',
                  dado_de_baja: '✗ Dado de baja',
                }
                return (
                  <li key={i} className="text-sm text-amber-700">
                    <span className="font-medium">{textos[a.tipo] || a.tipo}:</span>{' '}
                    {prop.titulo.substring(0, 50)}...
                    {a.valor_anterior && a.valor_nuevo && (
                      <span className="text-amber-600"> ({a.valor_anterior} → {a.valor_nuevo})</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Propiedades disponibles */}
        {disponibles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {disponibles.map(prop => (
              <PropCard
                key={prop.id}
                propiedad={prop}
                alertas={alertasRecientes}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No hay propiedades disponibles en este momento</p>
          </div>
        )}

        {/* Dados de baja */}
        {dadosDeBaja.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Ya no disponibles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dadosDeBaja.map(prop => (
                <PropCard
                  key={prop.id}
                  propiedad={prop}
                  alertas={alertasRecientes}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <a
            href="https://foroinmobiliario.com.ar"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Powered by <span className="font-semibold">GFI® Grupo Foro Inmobiliario</span>
          </a>
        </div>
      </div>
    </div>
  )
}
