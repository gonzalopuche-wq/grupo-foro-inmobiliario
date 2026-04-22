// app/(private)/crm/busqueda/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { Search, BookmarkPlus, ExternalLink, Filter, SlidersHorizontal, Loader2,
         Home, Building2, MapPin, DollarSign, BedDouble, CheckCircle2, X,
         ChevronDown, Layers, AlertCircle, Star } from 'lucide-react'
import CrearListaModal from './CrearListaModal'
import PropiedadCard from './PropiedadCard'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Propiedad {
  portal: string
  portal_id: string
  url_original: string
  titulo: string
  descripcion?: string
  tipo?: string
  operacion?: string
  barrio?: string
  ciudad?: string
  direccion?: string
  precio_actual?: number
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
}

const PORTALES = [
  { id: 'zonaprop', label: 'ZonaProp', color: '#e60000' },
  { id: 'argenprop', label: 'Argenprop', color: '#f5a623' },
  { id: 'mercadolibre', label: 'MercadoLibre', color: '#ffe600' },
]

const TIPOS = ['Departamento', 'Casa', 'PH', 'Local', 'Oficina', 'Terreno', 'Galpón']
const OPERACIONES = ['Venta', 'Alquiler', 'Alquiler temporal']
const DORMITORIOS = ['1', '2', '3', '4', '5+']

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BusquedaPage() {
  // Filtros
  const [operacion, setOperacion] = useState('Venta')
  const [tipo, setTipo] = useState('Departamento')
  const [zona, setZona] = useState('')
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [dormitorios, setDormitorios] = useState('')
  const [portalesSeleccionados, setPortalesSeleccionados] = useState(['zonaprop', 'argenprop', 'mercadolibre'])
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  // Resultados
  const [resultados, setResultados] = useState<Propiedad[]>([])
  const [cargando, setCargando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState('')

  // Selección para lista
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [modalLista, setModalLista] = useState(false)

  // Búsqueda
  const buscar = useCallback(async () => {
    if (!zona.trim()) { setError('Ingresá una zona o barrio'); return }
    setError('')
    setCargando(true)
    setBuscado(true)

    try {
      const res = await fetch('/api/scraper/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operacion: operacion.toLowerCase().replace(' ', '-'),
          tipo: tipo.toLowerCase(),
          zona: zona.trim(),
          precioMin: precioMin ? Number(precioMin) : undefined,
          precioMax: precioMax ? Number(precioMax) : undefined,
          dormitorios: dormitorios ? Number(dormitorios.replace('+', '')) : undefined,
          portales: portalesSeleccionados,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error en búsqueda')
      setResultados(data.propiedades || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [operacion, tipo, zona, precioMin, precioMax, dormitorios, portalesSeleccionados])

  // Toggle selección
  const toggleSeleccion = (url: string) => {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  const seleccionarTodas = () => {
    if (seleccionadas.size === resultados.length) {
      setSeleccionadas(new Set())
    } else {
      setSeleccionadas(new Set(resultados.map(p => p.url_original)))
    }
  }

  const propiedadesSeleccionadas = resultados.filter(p => seleccionadas.has(p.url_original))

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-400" />
                Búsqueda Inteligente
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">
                ZonaProp · Argenprop · MercadoLibre — todo desde GFI
              </p>
            </div>
            {seleccionadas.size > 0 && (
              <button
                onClick={() => setModalLista(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <BookmarkPlus className="w-4 h-4" />
                Guardar en lista ({seleccionadas.size})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Buscador principal */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-4">
          {/* Fila 1: Operación + Tipo + Zona */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Operación</label>
              <div className="flex gap-1">
                {OPERACIONES.map(op => (
                  <button
                    key={op}
                    onClick={() => setOperacion(op)}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                      operacion === op
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Zona / Barrio</label>
              <input
                type="text"
                value={zona}
                onChange={e => setZona(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
                placeholder="Ej: Pichincha, Centro, Fisherton..."
                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>

          {/* Filtros avanzados */}
          <div>
            <button
              onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros avanzados
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtrosAbiertos ? 'rotate-180' : ''}`} />
            </button>

            {filtrosAbiertos && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Precio mín.</label>
                  <input
                    type="number"
                    value={precioMin}
                    onChange={e => setPrecioMin(e.target.value)}
                    placeholder="USD 0"
                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Precio máx.</label>
                  <input
                    type="number"
                    value={precioMax}
                    onChange={e => setPrecioMax(e.target.value)}
                    placeholder="Sin límite"
                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Dormitorios</label>
                  <div className="flex gap-1">
                    {DORMITORIOS.map(d => (
                      <button
                        key={d}
                        onClick={() => setDormitorios(dormitorios === d ? '' : d)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                          dormitorios === d
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Portales</label>
                  <div className="flex gap-1">
                    {PORTALES.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setPortalesSeleccionados(prev =>
                          prev.includes(p.id)
                            ? prev.filter(x => x !== p.id)
                            : [...prev, p.id]
                        )}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                          portalesSeleccionados.includes(p.id)
                            ? 'bg-gray-700 text-white border border-white/20'
                            : 'bg-gray-800 text-gray-500'
                        }`}
                      >
                        {p.label.split('prop')[0] || p.label.substring(0, 4)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botón buscar */}
          {error && (
            <p className="text-red-400 text-sm flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />{error}
            </p>
          )}

          <button
            onClick={buscar}
            disabled={cargando}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {cargando ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Buscando en {portalesSeleccionados.length} portales...</>
            ) : (
              <><Search className="w-5 h-5" /> Buscar propiedades</>
            )}
          </button>
        </div>

        {/* Resultados */}
        {buscado && !cargando && (
          <>
            {/* Barra de resultados */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-gray-300 font-medium">
                  {resultados.length === 0
                    ? 'Sin resultados'
                    : `${resultados.length} propiedades encontradas`
                  }
                </span>
                {/* Badges por portal */}
                <div className="flex gap-2">
                  {PORTALES.map(p => {
                    const cant = resultados.filter(r => r.portal === p.id).length
                    if (!cant) return null
                    return (
                      <span key={p.id} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                        {p.label}: {cant}
                      </span>
                    )
                  })}
                </div>
              </div>

              {resultados.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={seleccionarTodas}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {seleccionadas.size === resultados.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                  </button>
                </div>
              )}
            </div>

            {/* Grid de propiedades */}
            {resultados.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No encontramos propiedades para esa búsqueda.</p>
                <p className="text-sm mt-1">Probá con otro barrio o ajustá los filtros.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resultados.map(prop => (
                  <PropiedadCard
                    key={prop.url_original}
                    propiedad={prop}
                    seleccionada={seleccionadas.has(prop.url_original)}
                    onToggle={() => toggleSeleccion(prop.url_original)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal guardar lista */}
      {modalLista && (
        <CrearListaModal
          propiedades={propiedadesSeleccionadas}
          onClose={() => setModalLista(false)}
          onCreada={() => {
            setModalLista(false)
            setSeleccionadas(new Set())
          }}
        />
      )}
    </div>
  )
}
