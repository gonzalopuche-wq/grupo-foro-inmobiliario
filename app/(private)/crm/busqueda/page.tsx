// app/(private)/crm/busqueda/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { Search, BookmarkPlus, SlidersHorizontal, Loader2,
         Home, AlertCircle, ChevronDown } from 'lucide-react'
import CrearListaModal from './CrearListaModal'
import PropiedadCard from './PropiedadCard'

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
  { id: 'zonaprop', label: 'ZonaProp' },
  { id: 'argenprop', label: 'Argenprop' },
  { id: 'mercadolibre', label: 'MercadoLibre' },
]
const TIPOS = ['Departamento', 'Casa', 'PH', 'Local', 'Oficina', 'Terreno', 'Galpón']
const OPERACIONES = ['Venta', 'Alquiler', 'Alquiler temporal']
const DORMITORIOS = ['1', '2', '3', '4', '5+']

export default function BusquedaPage() {
  const [operacion, setOperacion] = useState('Venta')
  const [tipo, setTipo] = useState('Departamento')
  const [zona, setZona] = useState('')
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [dormitorios, setDormitorios] = useState('')
  const [portalesSeleccionados, setPortalesSeleccionados] = useState(['zonaprop', 'argenprop', 'mercadolibre'])
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [resultados, setResultados] = useState<Propiedad[]>([])
  const [cargando, setCargando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState('')
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [modalLista, setModalLista] = useState(false)

  const buscar = useCallback(async () => {
    if (!zona.trim()) { setError('Ingresá una zona o barrio'); return }
    setError('')
    setCargando(true)
    setBuscado(true)
    try {
      // Obtener token de sesión
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Sesión expirada, volvé a iniciar sesión'); setCargando(false); return }

      const res = await fetch('/api/scraper/buscar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
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

  const toggleSeleccion = (url: string) => {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  const seleccionarTodas = () => {
    if (seleccionadas.size === resultados.length) setSeleccionadas(new Set())
    else setSeleccionadas(new Set(resultados.map(p => p.url_original)))
  }

  const propiedadesSeleccionadas = resultados.filter(p => seleccionadas.has(p.url_original))

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#fff',fontFamily:'Inter,sans-serif'}}>
      {/* Header */}
      <div style={{borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(15,15,15,0.95)',position:'sticky',top:0,zIndex:20,padding:'14px 20px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',maxWidth:1200,margin:'0 auto'}}>
          <div>
            <h1 style={{margin:0,fontSize:18,fontWeight:800,fontFamily:'Montserrat,sans-serif',display:'flex',alignItems:'center',gap:8}}>
              <Search style={{width:18,height:18,color:'#cc0000'}} />
              Búsqueda Inteligente
            </h1>
            <p style={{margin:'2px 0 0',fontSize:11,color:'rgba(255,255,255,0.35)'}}>ZonaProp · Argenprop · MercadoLibre — todo desde GFI</p>
          </div>
          {seleccionadas.size > 0 && (
            <button
              onClick={() => setModalLista(true)}
              style={{display:'flex',alignItems:'center',gap:8,background:'#cc0000',border:'none',color:'#fff',padding:'8px 16px',borderRadius:6,fontSize:12,fontWeight:700,fontFamily:'Montserrat,sans-serif',cursor:'pointer'}}
            >
              <BookmarkPlus style={{width:15,height:15}} />
              Guardar en lista ({seleccionadas.size})
            </button>
          )}
        </div>
      </div>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'20px'}}>

        {/* Buscador */}
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:20,marginBottom:24}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
            {/* Operación */}
            <div>
              <label style={{fontSize:10,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:6,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Operación</label>
              <div style={{display:'flex',gap:4}}>
                {OPERACIONES.map(op => (
                  <button key={op} onClick={() => setOperacion(op)}
                    style={{flex:1,padding:'7px 4px',borderRadius:6,border:`1px solid ${operacion===op?'#cc0000':'rgba(255,255,255,0.1)'}`,background:operacion===op?'rgba(200,0,0,0.12)':'transparent',color:operacion===op?'#fff':'rgba(255,255,255,0.4)',fontSize:10,fontWeight:700,fontFamily:'Montserrat,sans-serif',cursor:'pointer'}}
                  >{op}</button>
                ))}
              </div>
            </div>
            {/* Tipo */}
            <div>
              <label style={{fontSize:10,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:6,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 10px',color:'#fff',fontSize:12,outline:'none'}}>
                {TIPOS.map(t => <option key={t} style={{background:'#1a1a1a'}}>{t}</option>)}
              </select>
            </div>
            {/* Zona */}
            <div>
              <label style={{fontSize:10,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:6,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Zona / Barrio</label>
              <input type="text" value={zona} onChange={e => setZona(e.target.value)} onKeyDown={e => e.key==='Enter' && buscar()}
                placeholder="Ej: Pichincha, Centro, Fisherton..."
                style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 10px',color:'#fff',fontSize:12,outline:'none',boxSizing:'border-box'}}
              />
            </div>
          </div>

          {/* Filtros avanzados */}
          <div style={{marginBottom:12}}>
            <button onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
              style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4,padding:0}}>
              <SlidersHorizontal style={{width:13,height:13}} />
              Filtros avanzados
              <ChevronDown style={{width:13,height:13,transform:filtrosAbiertos?'rotate(180deg)':'none',transition:'transform 0.2s'}} />
            </button>

            {filtrosAbiertos && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12,marginTop:12}}>
                <div>
                  <label style={{fontSize:10,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:6}}>Precio mín.</label>
                  <input type="number" value={precioMin} onChange={e => setPrecioMin(e.target.value)} placeholder="USD 0"
                    style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 10px',color:'#fff',fontSize:12,outline:'none',boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={{fontSize:10,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:6}}>Precio máx.</label>
                  <input type="number" value={precioMax} onChange={e => setPrecioMax(e.target.value)} placeholder="Sin límite"
                    style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 10px',color:'#fff',fontSize:12,outline:'none',boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={{fontSize:10,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:6}}>Dormitorios</label>
                  <div style={{display:'flex',gap:4}}>
                    {DORMITORIOS.map(d => (
                      <button key={d} onClick={() => setDormitorios(dormitorios===d?'':d)}
                        style={{flex:1,padding:'7px 2px',borderRadius:6,border:`1px solid ${dormitorios===d?'#cc0000':'rgba(255,255,255,0.1)'}`,background:dormitorios===d?'rgba(200,0,0,0.12)':'transparent',color:dormitorios===d?'#fff':'rgba(255,255,255,0.4)',fontSize:10,fontWeight:700,cursor:'pointer'}}
                      >{d}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:10,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:6}}>Portales</label>
                  <div style={{display:'flex',gap:4}}>
                    {PORTALES.map(p => (
                      <button key={p.id}
                        onClick={() => setPortalesSeleccionados(prev => prev.includes(p.id) ? prev.filter(x=>x!==p.id) : [...prev,p.id])}
                        style={{flex:1,padding:'7px 2px',borderRadius:6,border:`1px solid ${portalesSeleccionados.includes(p.id)?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.08)'}`,background:portalesSeleccionados.includes(p.id)?'rgba(255,255,255,0.07)':'transparent',color:portalesSeleccionados.includes(p.id)?'#fff':'rgba(255,255,255,0.3)',fontSize:9,fontWeight:700,cursor:'pointer'}}
                      >{p.label.split('prop')[0] || p.label.substring(0,4)}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{display:'flex',alignItems:'center',gap:6,color:'#f87171',fontSize:12,marginBottom:10}}>
              <AlertCircle style={{width:14,height:14}} />{error}
            </div>
          )}

          <button onClick={buscar} disabled={cargando}
            style={{width:'100%',background:'#cc0000',border:'none',color:'#fff',padding:'12px',borderRadius:8,fontWeight:700,fontSize:13,fontFamily:'Montserrat,sans-serif',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:cargando?0.7:1}}>
            {cargando ? (
              <><Loader2 style={{width:16,height:16,animation:'spin 1s linear infinite'}} />Buscando en {portalesSeleccionados.length} portales...</>
            ) : (
              <><Search style={{width:16,height:16}} />Buscar propiedades</>
            )}
          </button>
        </div>

        {/* Resultados */}
        {buscado && !cargando && (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{color:'rgba(255,255,255,0.7)',fontWeight:600,fontSize:14}}>
                  {resultados.length === 0 ? 'Sin resultados' : `${resultados.length} propiedades encontradas`}
                </span>
                <div style={{display:'flex',gap:8}}>
                  {PORTALES.map(p => {
                    const cant = resultados.filter(r => r.portal === p.id).length
                    if (!cant) return null
                    return <span key={p.id} style={{fontSize:10,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.4)',padding:'2px 8px',borderRadius:20}}>{p.label}: {cant}</span>
                  })}
                </div>
              </div>
              {resultados.length > 0 && (
                <button onClick={seleccionarTodas} style={{background:'none',border:'none',color:'#cc0000',fontSize:11,cursor:'pointer',fontWeight:600}}>
                  {seleccionadas.size === resultados.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
              )}
            </div>

            {resultados.length === 0 ? (
              <div style={{textAlign:'center',padding:'64px 0',color:'rgba(255,255,255,0.25)'}}>
                <Home style={{width:40,height:40,margin:'0 auto 12px',display:'block',opacity:0.3}} />
                <p style={{margin:0}}>No encontramos propiedades para esa búsqueda.</p>
                <p style={{margin:'4px 0 0',fontSize:12}}>Probá con otro barrio o ajustá los filtros.</p>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
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

      {modalLista && (
        <CrearListaModal
          propiedades={propiedadesSeleccionadas}
          onClose={() => setModalLista(false)}
          onCreada={() => { setModalLista(false); setSeleccionadas(new Set()) }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
