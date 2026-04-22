// app/(private)/crm/busqueda/PropiedadCard.tsx
'use client'

import { ExternalLink, BedDouble, Bath, Square, MapPin, CheckCircle2, Bookmark } from 'lucide-react'
import Image from 'next/image'

interface PropiedadCardProps {
  propiedad: {
    portal: string
    url_original: string
    titulo: string
    descripcion?: string
    barrio?: string
    ciudad?: string
    precio_actual?: number
    moneda?: string
    expensas?: number
    superficie_total?: number
    superficie_cubierta?: number
    dormitorios?: number
    banos?: number
    ambientes?: number
    imagen_principal?: string
    disponible: boolean
  }
  seleccionada: boolean
  onToggle: () => void
}

const PORTAL_COLORS: Record<string, string> = {
  zonaprop: 'bg-red-900/40 text-red-300 border-red-800',
  argenprop: 'bg-orange-900/40 text-orange-300 border-orange-800',
  mercadolibre: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  infocasas: 'bg-blue-900/40 text-blue-300 border-blue-800',
  manual: 'bg-gray-800 text-gray-300 border-gray-700',
}

const PORTAL_LABELS: Record<string, string> = {
  zonaprop: 'ZonaProp',
  argenprop: 'Argenprop',
  mercadolibre: 'MercadoLibre',
  infocasas: 'InfoCasas',
  manual: 'Manual',
}

export default function PropiedadCard({ propiedad, seleccionada, onToggle }: PropiedadCardProps) {
  const { portal, url_original, titulo, descripcion, barrio, precio_actual,
          moneda, expensas, superficie_total, dormitorios, banos, imagen_principal } = propiedad

  const formatPrecio = (n: number, m: string) =>
    `${m === 'ARS' ? '$' : 'U$D'} ${n.toLocaleString('es-AR')}`

  return (
    <div
      onClick={onToggle}
      className={`relative bg-gray-900 rounded-xl border transition-all cursor-pointer group ${
        seleccionada
          ? 'border-blue-500 ring-1 ring-blue-500/30'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Imagen */}
      <div className="relative h-44 rounded-t-xl overflow-hidden bg-gray-800">
        {imagen_principal ? (
          <img
            src={imagen_principal}
            alt={titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { (e.target as HTMLImageElement).src = '/placeholder-property.jpg' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <Square className="w-10 h-10" />
          </div>
        )}

        {/* Badge portal */}
        <div className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full border ${PORTAL_COLORS[portal]}`}>
          {PORTAL_LABELS[portal]}
        </div>

        {/* Check seleccionada */}
        <div className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          seleccionada
            ? 'bg-blue-600'
            : 'bg-black/50 opacity-0 group-hover:opacity-100'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Contenido */}
      <div className="p-3 space-y-2">
        <h3 className="font-medium text-white text-sm leading-snug line-clamp-2">
          {titulo}
        </h3>

        {barrio && (
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <MapPin className="w-3 h-3" />
            {barrio}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {dormitorios && (
            <span className="flex items-center gap-1">
              <BedDouble className="w-3 h-3" />{dormitorios} dorm.
            </span>
          )}
          {banos && (
            <span className="flex items-center gap-1">
              <Bath className="w-3 h-3" />{banos} baños
            </span>
          )}
          {superficie_total && (
            <span className="flex items-center gap-1">
              <Square className="w-3 h-3" />{superficie_total} m²
            </span>
          )}
        </div>

        {/* Precio */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div>
            {precio_actual ? (
              <span className="text-white font-semibold text-base">
                {formatPrecio(precio_actual, moneda || 'USD')}
              </span>
            ) : (
              <span className="text-gray-500 text-sm">Consultar precio</span>
            )}
            {expensas && (
              <span className="text-gray-500 text-xs ml-2">
                + $ {expensas.toLocaleString('es-AR')} expensas
              </span>
            )}
          </div>

          <a
            href={url_original}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-gray-500 hover:text-blue-400 transition-colors p-1"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
