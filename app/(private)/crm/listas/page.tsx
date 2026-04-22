// app/(private)/crm/listas/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookmarkCheck, ExternalLink, Copy, Trash2, Users, Home,
         TrendingDown, TrendingUp, AlertTriangle, Plus, Loader2, Bell } from 'lucide-react'

interface Lista {
  id: string
  nombre: string
  descripcion?: string
  slug: string
  email_cliente?: string
  notificar_cliente: boolean
  created_at: string
  updated_at: string
  contacto?: { id: string; nombre: string; apellido: string }
  propiedades: [{ count: number }]
}

export default function ListasPage() {
  const [listas, setListas] = useState<Lista[]>([])
  const [cargando, setCargando] = useState(true)
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/listas')
      .then(r => r.json())
      .then(data => setListas(data || []))
      .finally(() => setCargando(false))
  }, [])

  const copiarLink = (slug: string) => {
    navigator.clipboard.writeText(`https://foroinmobiliario.com.ar/b/${slug}`)
    setCopiado(slug)
    setTimeout(() => setCopiado(null), 2000)
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta lista? Las propiedades también se eliminarán.')) return
    await fetch(`/api/listas/${id}`, { method: 'DELETE' })
    setListas(prev => prev.filter(l => l.id !== id))
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookmarkCheck className="w-5 h-5 text-blue-400" />
            Listas guardadas
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Propiedades seleccionadas para tus clientes
          </p>
        </div>
        <Link
          href="/crm/busqueda"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva búsqueda
        </Link>
      </div>

      {listas.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-2xl border border-white/10">
          <BookmarkCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Todavía no tenés listas guardadas</p>
          <p className="text-sm mt-1">Buscá propiedades y guardalas para compartir con tus clientes</p>
          <Link
            href="/crm/busqueda"
            className="inline-flex items-center gap-2 mt-4 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Ir a búsqueda inteligente
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {listas.map(lista => {
            const cantPropiedades = lista.propiedades?.[0]?.count || 0
            const url = `https://foroinmobiliario.com.ar/b/${lista.slug}`

            return (
              <div
                key={lista.id}
                className="bg-gray-900 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{lista.nombre}</h3>
                    {lista.descripcion && (
                      <p className="text-sm text-gray-400 mt-0.5 truncate">{lista.descripcion}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {/* Contacto */}
                      {lista.contacto && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Users className="w-3 h-3" />
                          {lista.contacto.nombre} {lista.contacto.apellido}
                        </span>
                      )}
                      {/* Cant propiedades */}
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Home className="w-3 h-3" />
                        {cantPropiedades} propiedad{cantPropiedades !== 1 ? 'es' : ''}
                      </span>
                      {/* Notificaciones */}
                      {lista.notificar_cliente && lista.email_cliente && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <Bell className="w-3 h-3" />
                          Alertas activas
                        </span>
                      )}
                      {/* Fecha */}
                      <span className="text-xs text-gray-500">
                        {new Date(lista.created_at).toLocaleDateString('es-AR')}
                      </span>
                    </div>

                    {/* Link */}
                    <div className="mt-3 flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-1.5">
                      <span className="text-blue-400 text-xs truncate flex-1">{url}</span>
                      <button
                        onClick={() => copiarLink(lista.slug)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white whitespace-nowrap"
                      >
                        <Copy className="w-3 h-3" />
                        {copiado === lista.slug ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <Link
                      href={`/crm/listas/${lista.id}`}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-center"
                    >
                      Ver lista
                    </Link>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1 justify-center"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Vista cliente
                    </a>
                    <button
                      onClick={() => eliminar(lista.id)}
                      className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 justify-center"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
