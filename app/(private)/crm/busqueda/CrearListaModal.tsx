// app/(private)/crm/busqueda/CrearListaModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, BookmarkPlus, User, Mail, Plus, Loader2, CheckCircle2 } from 'lucide-react'

interface Contacto {
  id: string
  nombre: string
  apellido: string
  email?: string
  telefono?: string
}

interface CrearListaModalProps {
  propiedades: any[]
  onClose: () => void
  onCreada: (listaId: string, slug: string) => void
}

export default function CrearListaModal({ propiedades, onClose, onCreada }: CrearListaModalProps) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [emailCliente, setEmailCliente] = useState('')
  const [notificarCliente, setNotificarCliente] = useState(true)
  const [contactoId, setContactoId] = useState('')
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [cargandoContactos, setCargandoContactos] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(false)
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/crm/contactos?limit=100')
      .then(r => r.json())
      .then(data => setContactos(data || []))
      .catch(() => {})
      .finally(() => setCargandoContactos(false))
  }, [])

  // Auto-completar email cuando se selecciona contacto
  useEffect(() => {
    if (contactoId) {
      const c = contactos.find(x => x.id === contactoId)
      if (c?.email) setEmailCliente(c.email)
      if (c) setNombre(`${c.nombre} ${c.apellido} — ${new Date().toLocaleDateString('es-AR')}`)
    }
  }, [contactoId, contactos])

  const guardar = async () => {
    if (!nombre.trim()) { setError('Ponele un nombre a la lista'); return }
    setError('')
    setGuardando(true)

    try {
      // 1. Crear lista
      const resLista = await fetch('/api/listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion,
          contacto_id: contactoId || null,
          email_cliente: emailCliente || null,
          notificar_cliente: notificarCliente,
        }),
      })

      const lista = await resLista.json()
      if (!resLista.ok) throw new Error(lista.error)

      // 2. Guardar propiedades en paralelo
      await Promise.allSettled(
        propiedades.map(prop =>
          fetch(`/api/listas/${lista.id}/propiedades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prop),
          })
        )
      )

      setSlug(lista.slug)
      setListo(true)
      onCreada(lista.id, lista.slug)

    } catch (err: any) {
      setError(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const urlLista = `https://foroinmobiliario.com.ar/b/${slug}`

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">
              {listo ? 'Lista creada' : 'Guardar en lista'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!listo ? (
          <div className="p-5 space-y-4">
            {/* Resumen de propiedades */}
            <div className="bg-gray-800/50 rounded-xl p-3 text-sm text-gray-300">
              {propiedades.length} propiedad{propiedades.length !== 1 ? 'es' : ''} seleccionada{propiedades.length !== 1 ? 's' : ''}
            </div>

            {/* Asociar a contacto */}
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">
                <User className="w-3.5 h-3.5 inline mr-1" />
                Contacto del CRM (opcional)
              </label>
              {cargandoContactos ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando contactos...
                </div>
              ) : (
                <select
                  value={contactoId}
                  onChange={e => setContactoId(e.target.value)}
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="">— Sin contacto —</option>
                  {contactos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellido} {c.telefono ? `· ${c.telefono}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Nombre de la lista */}
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Nombre de la lista *</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Departamentos 2 dorm Pichincha — García"
                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Descripción (opcional)</label>
              <input
                type="text"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej: Búsqueda entre U$D 80.000 y U$D 100.000"
                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>

            {/* Email cliente para alertas */}
            <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="notificar"
                  checked={notificarCliente}
                  onChange={e => setNotificarCliente(e.target.checked)}
                  className="mt-0.5 accent-blue-500"
                />
                <label htmlFor="notificar" className="text-sm text-gray-300 cursor-pointer">
                  Notificar al cliente cuando cambie el precio o se dé de baja una propiedad
                </label>
              </div>
              {notificarCliente && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    <Mail className="w-3 h-3 inline mr-1" />
                    Email del cliente
                  </label>
                  <input
                    type="email"
                    value={emailCliente}
                    onChange={e => setEmailCliente(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={guardar}
              disabled={guardando}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {guardando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
              ) : (
                <><BookmarkPlus className="w-4 h-4" /> Crear lista</>
              )}
            </button>
          </div>
        ) : (
          /* Estado: lista creada */
          <div className="p-5 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-white font-medium">{propiedades.length} propiedades guardadas</h3>
              <p className="text-gray-400 text-sm">La lista se irá actualizando automáticamente</p>
            </div>

            {/* Link para el cliente */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-xs text-gray-400">Link para el cliente:</p>
              <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
                <span className="text-blue-300 text-sm flex-1 truncate">{urlLista}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(urlLista)}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                >
                  Copiar
                </button>
              </div>
              <p className="text-xs text-gray-500">
                El cliente puede ver las propiedades sin iniciar sesión y recibe alertas por email cuando cambia el precio.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-xl text-sm font-medium"
              >
                Cerrar
              </button>
              <a
                href={`/crm/listas`}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium text-center"
              >
                Ver mis listas
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
