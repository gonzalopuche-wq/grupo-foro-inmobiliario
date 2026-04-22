// app/(private)/crm/busqueda/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { Search, BookmarkPlus, Loader2, Home, AlertCircle,
         ChevronDown, SlidersHorizontal, ExternalLink, Plus, X, Link as LinkIcon } from 'lucide-react'
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
  precio_actual?: number
  moneda?: string
  superficie_total?: number
  dormitorios?: number
  banos?: number
  imagen_principal?: string
  imagenes?: string[]
  disponible: boolean
}

const TIPOS = ['Departamento', 'Casa', 'PH', 'Local', 'Oficina', 'Terreno', 'Galpón']
const OPERACIONES = ['Venta', 'Alquiler', 'Alquiler temporal']
const DORMITORIOS = ['1', '2', '3', '4', '5+']

// ─── Armar URLs de búsqueda en portales externos ──────────────────────────────

function armarURLZonaProp(operacion: string, tipo: string, zona: string, precioMin: string, precioMax: string, dorm: string) {
  const opMap: Record<string, string> = { 'venta': 'venta', 'alquiler': 'alquiler', 'alquiler-temporal': 'alquiler-temporal' }
  const tpMap: Record<string, string> = { 'departamento': 'departamento', 'casa': 'casa', 'ph': 'ph', 'local': 'local', 'oficina': 'oficina', 'terreno': 'terreno', 'galpón': 'galpon' }
  const op = opMap[operacion.toLowerCase().replace(' ', '-')] || 'venta'
  const tp = tpMap[tipo.toLowerCase()] || 'departamento'
  const zonaSlug = zona.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  let url = `https://www.zonaprop.com.ar/${tp}-${op}-${zonaSlug}.html?`
  const q: string[] = []
  if (precioMin) q.push(`preciomin=${precioMin}`)
  if (precioMax) q.push(`preciomax=${precioMax}`)
  if (dorm) q.push(`ambientes=${dorm.replace('+', '')}`)
  q.push('orden=relevancia-DESC')
  return url + q.join('&')
}

function armarURLArgenprop(operacion: string, tipo: string, zona: string, precioMin: string, precioMax: string, dorm: string) {
  const op = operacion.toLowerCase().includes('alquiler') ? 'alquiler' : 'venta'
  const zonaSlug = zona.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const tpSlug = tipo.toLowerCase().replace('ó', 'o').replace('é', 'e')
  let url = `https://www.argenprop.com/${tpSlug}-${op}-en-rosario-${zonaSlug}`
  const q: string[] = []
  if (precioMin) q.push(`preciomin=${precioMin}`)
  if (precioMax) q.push(`preciomax=${precioMax}`)
  if (dorm) q.push(`dormitorios=${dorm.replace('+', '')}`)
  return url + (q.length ? '?' + q.join('&') : '')
}

function armarURLInfocasas(operacion: string, tipo: string, zona: string) {
  const op = operacion.toLowerCase().includes('alquiler') ? 'alquiler' : 'venta'
  const zonaSlug = zona.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const tpSlug = tipo.toLowerCase()
  return `https://www.infocasas.com.ar/${tpSlug}s-en-${op}/rosario/${zonaSlug}`
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BusquedaPage() {
  const [operacion, setOperacion] = useState('Venta')
  const [tipo, setTipo] = useState('Departamento')
  const [zona, setZona] = useState('')
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [dormitorios, setDormitorios] = useState('')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  // Resultados ML
  const [resultados, setResultados] = useState<Propiedad[]>([])
  const [cargando, setCargando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState('')

  // Carga manual
  const [urlManual, setUrlManual] = useState('')
  const [propiedadesManuales, setPropiedadesManuales] = useState<Propiedad[]>([])
  const [cargandoManual, setCargandoManual] = useState(false)

  // Selección
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [modalLista, setModalLista] = useState(false)

  // Buscar en MercadoLibre
  const buscar = useCallback(async () => {
    if (!zona.trim()) { setError('Ingresá una zona o barrio'); return }
    setError('')
    setCargando(true)
    setBuscado(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Sesión expirada'); setCargando(false); return }

      const res = await fetch('/api/scraper/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          operacion: operacion.toLowerCase().replace(' ', '-'),
          tipo: tipo.toLowerCase(),
          zona: zona.trim(),
          precioMin: precioMin ? Number(precioMin) : undefined,
          precioMax: precioMax ? Number(precioMax) : undefined,
          dormitorios: dormitorios ? Number(dormitorios.replace('+', '')) : undefined,
          portales: ['mercadolibre'],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultados(data.propiedades || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [operacion, tipo, zona, precioMin, precioMax, dormitorios])

  // Agregar propiedad manual por URL
  const agregarManual = async () => {
    if (!urlManual.trim()) return
    const url = urlManual.trim()

    // Detectar portal
    let portal = 'manual'
    if (url.includes('zonaprop')) portal = 'zonaprop'
    else if (url.includes('argenprop')) portal = 'argenprop'
    else if (url.includes('mercadolibre') || url.includes('inmuebles.mercadolibre')) portal = 'mercadolibre'
    else if (url.includes('infocasas')) portal = 'infocasas'

    // Verificar que no esté ya
    const yaExiste = [...resultados, ...propiedadesManuales].find(p => p.url_original === url)
    if (yaExiste) { setUrlManual(''); return }

    setCargandoManual(true)
    try {
      // Para ML intentamos obtener datos via API
      if (portal === 'mercadolibre') {
        const mlId = url.match(/MLA-?(\d+)/i)?.[0]?.replace('-', '')
        if (mlId) {
          const res = await fetch(`https://api.mercadolibre.com/items/${mlId}`)
          if (res.ok) {
            const item = await res.json()
            const atributos: Record<string, string> = {}
            ;(item.attributes || []).forEach((a: any) => { atributos[a.id] = a.value_name || '' })
            const prop: Propiedad = {
              portal: 'mercadolibre',
              portal_id: item.id,
              url_original: item.permalink || url,
              titulo: item.title || url,
              barrio: atributos['NEIGHBORHOOD'] || '',
              ciudad: atributos['CITY'] || 'Rosario',
              precio_actual: item.price,
              moneda: item.currency_id === 'ARS' ? 'ARS' : 'USD',
              superficie_total: parseFloat(atributos['TOTAL_AREA'] || '0') || undefined,
              dormitorios: parseInt(atributos['BEDROOMS'] || '0') || undefined,
              banos: parseInt(atributos['BATHROOMS'] || '0') || undefined,
              imagen_principal: item.thumbnail?.replace('-I.jpg', '-O.jpg'),
              imagenes: (item.pictures || []).map((p: any) => p.url?.replace('-I.jpg', '-O.jpg')).filter(Boolean),
              disponible: true,
            }
            setPropiedadesManuales(prev => [prop, ...prev])
            setUrlManual('')
            setCargandoManual(false)
            return
          }
        }
      }

      // Para otros portales: agregar con datos mínimos
      const prop: Propiedad = {
        portal,
        portal_id: `manual_${Date.now()}`,
        url_original: url,
        titulo: `Propiedad en ${portal} — ${zona || 'Rosario'}`,
        disponible: true,
      }
      setPropiedadesManuales(prev => [prop, ...prev])
      setUrlManual('')
    } catch {
      // Agregar igual con datos mínimos
      setPropiedadesManuales(prev => [{
        portal,
        portal_id: `manual_${Date.now()}`,
        url_original: url,
        titulo: `Propiedad desde ${portal}`,
        disponible: true,
      }, ...prev])
      setUrlManual('')
    } finally {
      setCargandoManual(false)
    }
  }

  const quitarManual = (url: string) => {
    setPropiedadesManuales(prev => prev.filter(p => p.url_original !== url))
    setSeleccionadas(prev => { const n = new Set(prev); n.delete(url); return n })
  }

  const toggleSeleccion = (url: string) => {
    setSeleccionadas(prev => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n })
  }

  const todasLasPropiedades = [...propiedadesManuales, ...resultados]
  const propiedadesSeleccionadas = todasLasPropiedades.filter(p => seleccionadas.has(p.url_original))

  const zpUrl = zona ? armarURLZonaProp(operacion, tipo, zona, precioMin, precioMax, dormitorios) : null
  const apUrl = zona ? armarURLArgenprop(operacion, tipo, zona, precioMin, precioMax, dormitorios) : null
  const icUrl = zona ? armarURLInfocasas(operacion, tipo, zona) : null

  // Estilos inline (mismo sistema que CRM)
  const label = { fontSize:10, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:6, fontFamily:'Montserrat,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const }

  return (
    <div style={{minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'Inter,sans-serif'}}>

      {/* Header */}
      <div style={{borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(13,13,13,0.98)', position:'sticky', top:0, zIndex:20, padding:'14px 20px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', maxWidth:1200, margin:'0 auto'}}>
          <div>
            <h1 style={{margin:0, fontSize:18, fontWeight:800, fontFamily:'Montserrat,sans-serif', display:'flex', alignItems:'center', gap:8}}>
              <Search style={{width:18, height:18, color:'#cc0000'}} />
              Búsqueda Inteligente
            </h1>
            <p style={{margin:'2px 0 0', fontSize:11, color:'rgba(255,255,255,0.3)'}}>
              MercadoLibre · ZonaProp · Argenprop · InfoCasas
            </p>
          </div>
          {seleccionadas.size > 0 && (
            <button onClick={() => setModalLista(true)}
              style={{display:'flex', alignItems:'center', gap:8, background:'#cc0000', border:'none', color:'#fff', padding:'9px 18px', borderRadius:8, fontSize:12, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor:'pointer'}}>
              <BookmarkPlus style={{width:15, height:15}} />
              Guardar lista ({seleccionadas.size})
            </button>
          )}
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:20}}>

        {/* ── Filtros ── */}
        <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:20, marginBottom:20}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:14}}>
            <div>
              <label style={label}>Operación</label>
              <div style={{display:'flex', gap:4}}>
                {OPERACIONES.map(op => (
                  <button key={op} onClick={() => setOperacion(op)}
                    style={{flex:1, padding:'7px 4px', borderRadius:6, border:`1px solid ${operacion===op?'#cc0000':'rgba(255,255,255,0.1)'}`, background:operacion===op?'rgba(200,0,0,0.12)':'transparent', color:operacion===op?'#fff':'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor:'pointer'}}>
                    {op}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={label}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none'}}>
                {TIPOS.map(t => <option key={t} style={{background:'#111'}}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Zona / Barrio</label>
              <input type="text" value={zona} onChange={e => setZona(e.target.value)} onKeyDown={e => e.key==='Enter' && buscar()}
                placeholder="Ej: Pichincha, Centro, Fisherton..."
                style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box' as const}} />
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <button onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
              style={{background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4, padding:0}}>
              <SlidersHorizontal style={{width:13, height:13}} />
              Filtros avanzados
              <ChevronDown style={{width:13, height:13, transform:filtrosAbiertos?'rotate(180deg)':'none', transition:'transform 0.2s'}} />
            </button>
            {filtrosAbiertos && (
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginTop:12}}>
                <div>
                  <label style={label}>Precio mín.</label>
                  <input type="number" value={precioMin} onChange={e => setPrecioMin(e.target.value)} placeholder="USD 0"
                    style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box' as const}} />
                </div>
                <div>
                  <label style={label}>Precio máx.</label>
                  <input type="number" value={precioMax} onChange={e => setPrecioMax(e.target.value)} placeholder="Sin límite"
                    style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box' as const}} />
                </div>
                <div>
                  <label style={label}>Dormitorios</label>
                  <div style={{display:'flex', gap:4}}>
                    {DORMITORIOS.map(d => (
                      <button key={d} onClick={() => setDormitorios(dormitorios===d?'':d)}
                        style={{flex:1, padding:'7px 2px', borderRadius:6, border:`1px solid ${dormitorios===d?'#cc0000':'rgba(255,255,255,0.1)'}`, background:dormitorios===d?'rgba(200,0,0,0.12)':'transparent', color:dormitorios===d?'#fff':'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700, cursor:'pointer'}}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{display:'flex', alignItems:'center', gap:6, color:'#f87171', fontSize:12, marginBottom:10}}>
              <AlertCircle style={{width:14, height:14}} />{error}
            </div>
          )}

          {/* Botón ML + links a portales */}
          <div style={{display:'flex', gap:10, flexWrap:'wrap' as const}}>
            <button onClick={buscar} disabled={cargando}
              style={{flex:'1 1 200px', background:'#cc0000', border:'none', color:'#fff', padding:'11px', borderRadius:8, fontWeight:700, fontSize:13, fontFamily:'Montserrat,sans-serif', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:cargando?0.7:1}}>
              {cargando
                ? <><Loader2 style={{width:15, height:15, animation:'spin 1s linear infinite'}} />Buscando en MercadoLibre...</>
                : <><Search style={{width:15, height:15}} />Buscar en MercadoLibre</>
              }
            </button>

            {zpUrl && (
              <a href={zpUrl} target="_blank" rel="noopener noreferrer"
                style={{flex:'1 1 140px', background:'rgba(230,0,0,0.08)', border:'1px solid rgba(230,0,0,0.25)', color:'rgba(255,255,255,0.7)', padding:'11px', borderRadius:8, fontWeight:700, fontSize:12, fontFamily:'Montserrat,sans-serif', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                <ExternalLink style={{width:13, height:13}} />ZonaProp ↗
              </a>
            )}

            {apUrl && (
              <a href={apUrl} target="_blank" rel="noopener noreferrer"
                style={{flex:'1 1 140px', background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.2)', color:'rgba(255,255,255,0.7)', padding:'11px', borderRadius:8, fontWeight:700, fontSize:12, fontFamily:'Montserrat,sans-serif', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                <ExternalLink style={{width:13, height:13}} />Argenprop ↗
              </a>
            )}

            {icUrl && (
              <a href={icUrl} target="_blank" rel="noopener noreferrer"
                style={{flex:'1 1 140px', background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', color:'rgba(255,255,255,0.7)', padding:'11px', borderRadius:8, fontWeight:700, fontSize:12, fontFamily:'Montserrat,sans-serif', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                <ExternalLink style={{width:13, height:13}} />InfoCasas ↗
              </a>
            )}
          </div>

          {zona && (
            <p style={{margin:'10px 0 0', fontSize:11, color:'rgba(255,255,255,0.25)'}}>
              Los botones ↗ abren cada portal con tu búsqueda ya aplicada. Copiá la URL de las que te gusten y pegala abajo para agregarlas a tu lista.
            </p>
          )}
        </div>

        {/* ── Agregar por URL ── */}
        <div style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:16, marginBottom:20}}>
          <label style={{...label, marginBottom:10}}>
            <LinkIcon style={{width:12, height:12, display:'inline', marginRight:5}} />
            Agregar propiedad por URL
          </label>
          <div style={{display:'flex', gap:8}}>
            <input
              type="url"
              value={urlManual}
              onChange={e => setUrlManual(e.target.value)}
              onKeyDown={e => e.key==='Enter' && agregarManual()}
              placeholder="Pegá la URL de ZonaProp, Argenprop, MercadoLibre, InfoCasas..."
              style={{flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'9px 12px', color:'#fff', fontSize:12, outline:'none', fontFamily:'Inter,sans-serif'}}
            />
            <button onClick={agregarManual} disabled={cargandoManual || !urlManual.trim()}
              style={{background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', padding:'9px 16px', borderRadius:6, fontSize:12, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor:'pointer', display:'flex', alignItems:'center', gap:6, opacity:(!urlManual.trim()||cargandoManual)?0.4:1}}>
              {cargandoManual ? <Loader2 style={{width:14, height:14, animation:'spin 1s linear infinite'}} /> : <Plus style={{width:14, height:14}} />}
              Agregar
            </button>
          </div>
        </div>

        {/* ── Propiedades manuales ── */}
        {propiedadesManuales.length > 0 && (
          <div style={{marginBottom:24}}>
            <p style={{...label, marginBottom:12}}>Propiedades agregadas manualmente ({propiedadesManuales.length})</p>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14}}>
              {propiedadesManuales.map(prop => (
                <div key={prop.url_original} style={{position:'relative'}}>
                  <button onClick={() => quitarManual(prop.url_original)}
                    style={{position:'absolute', top:8, right:8, zIndex:10, background:'rgba(0,0,0,0.7)', border:'none', color:'rgba(255,255,255,0.6)', borderRadius:'50%', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'}}>
                    <X style={{width:12, height:12}} />
                  </button>
                  <PropiedadCard
                    propiedad={prop}
                    seleccionada={seleccionadas.has(prop.url_original)}
                    onToggle={() => toggleSeleccion(prop.url_original)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Resultados MercadoLibre ── */}
        {buscado && (
          <>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <span style={{fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.7)', fontFamily:'Montserrat,sans-serif'}}>
                  {cargando ? 'Buscando...' : resultados.length === 0 ? 'Sin resultados en MercadoLibre' : `${resultados.length} resultados en MercadoLibre`}
                </span>
              </div>
              {resultados.length > 0 && (
                <button
                  onClick={() => {
                    if (seleccionadas.size === todasLasPropiedades.length) setSeleccionadas(new Set())
                    else setSeleccionadas(new Set(todasLasPropiedades.map(p => p.url_original)))
                  }}
                  style={{background:'none', border:'none', color:'#cc0000', fontSize:11, cursor:'pointer', fontWeight:600}}>
                  {seleccionadas.size === todasLasPropiedades.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
              )}
            </div>

            {!cargando && resultados.length === 0 && (
              <div style={{textAlign:'center', padding:'48px 0', color:'rgba(255,255,255,0.2)'}}>
                <Home style={{width:36, height:36, margin:'0 auto 10px', display:'block', opacity:0.3}} />
                <p style={{margin:0}}>No encontramos resultados en MercadoLibre para esa búsqueda.</p>
                <p style={{margin:'4px 0 0', fontSize:12}}>Probá en ZonaProp o Argenprop con los botones de arriba.</p>
              </div>
            )}

            {resultados.length > 0 && (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14}}>
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
