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

// ─── Helpers de normalización ─────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function opSlug(op: string) {
  const m: Record<string, string> = { 'venta': 'venta', 'alquiler': 'alquiler', 'alquiler-temporal': 'alquiler-temporal' }
  return m[op.toLowerCase().replace(' ', '-')] || 'venta'
}

function tipoSlug(t: string) {
  const m: Record<string, string> = {
    'departamento': 'departamento', 'casa': 'casa', 'ph': 'ph',
    'local': 'local', 'oficina': 'oficina', 'terreno': 'terreno', 'galpon': 'galpon', 'galpón': 'galpon'
  }
  return m[t.toLowerCase()] || 'departamento'
}

// ─── URLs por portal ──────────────────────────────────────────────────────────

function buildPortalURLs(operacion: string, tipo: string, zona: string, precioMin: string, precioMax: string, dorm: string) {
  const op = opSlug(operacion)
  const tp = tipoSlug(tipo)
  const z = slugify(zona)
  const pmin = precioMin || ''
  const pmax = precioMax || ''
  const d = dorm.replace('+', '')

  // ZonaProp
  const zp = (() => {
    let url = `https://www.zonaprop.com.ar/${tp}-${op}-${z}.html?`
    const q = ['orden=relevancia-DESC']
    if (pmin) q.push(`preciomin=${pmin}`)
    if (pmax) q.push(`preciomax=${pmax}`)
    if (d) q.push(`ambientes=${d}`)
    return url + q.join('&')
  })()

  // Argenprop
  const ap = (() => {
    let url = `https://www.argenprop.com/${tp}-${op}-en-rosario-${z}`
    const q: string[] = []
    if (pmin) q.push(`preciomin=${pmin}`)
    if (pmax) q.push(`preciomax=${pmax}`)
    if (d) q.push(`dormitorios=${d}`)
    return url + (q.length ? '?' + q.join('&') : '')
  })()

  // InfoCasas
  const ic = `https://www.infocasas.com.ar/${tp}s-en-${op}/rosario/${z}`

  // Properati (ahora Proppit)
  const pr = `https://www.properati.com.ar/${tp}s-en-venta/rosario/${z}?operation_type=${op === 'venta' ? 'Venta' : 'Alquiler'}`

  // Propia
  const propiaOp = op === 'venta' ? 'venta' : 'alquiler'
  const propiaTp = tp === 'departamento' ? 'departamentos' : tp === 'casa' ? 'casas' : tp + 's'
  const propia = `https://propia.com.ar/propiedades?operacion=${propiaOp}&tipo=${propiaTp}&provincia=santa-fe&ciudad=rosario&zona=${z}${pmin ? `&precio_min=${pmin}` : ''}${pmax ? `&precio_max=${pmax}` : ''}${d ? `&dormitorios=${d}` : ''}`

  // BienesRosario
  const br = `https://www.bienesrosario.com/${tp}s-en-${op}?zona=${zona}`

  // Doomos
  const dm = `https://www.doomos.com.ar/${op}/${tp}/rosario-santa-fe/${z}`

  // LaCapital Clasificados
  const lc = `https://clasificados.lacapital.com.ar/inmuebles/${op}/${tp}/rosario/${z}`

  // Yumblin
  const yb = `https://www.yumblin.com/rosario/${z}/${tp}s-en-${op}`

  // BienesOnline
  const bo = `https://www.bienesonline.com/argentina/santa-fe/rosario/${tp}s-en-${op}/?q=${zona}+rosario`

  return { zp, ap, ic, pr, propia, br, dm, lc, yb, bo }
}

// ─── Config visual de portales ────────────────────────────────────────────────

const PORTALES_CONFIG = [
  { key: 'zp',    label: 'ZonaProp',    color: 'rgba(230,0,0,0.15)',     border: 'rgba(230,0,0,0.3)' },
  { key: 'ap',    label: 'Argenprop',   color: 'rgba(245,166,35,0.1)',   border: 'rgba(245,166,35,0.3)' },
  { key: 'ic',    label: 'InfoCasas',   color: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.3)' },
  { key: 'pr',    label: 'Properati',   color: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.3)' },
  { key: 'propia',label: 'Propia',      color: 'rgba(139,92,246,0.1)',   border: 'rgba(139,92,246,0.3)' },
  { key: 'br',    label: 'BienesRosario', color: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.3)' },
  { key: 'dm',    label: 'Doomos',      color: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.3)' },
  { key: 'lc',    label: 'LaCapital',   color: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)' },
  { key: 'yb',    label: 'Yumblin',     color: 'rgba(20,184,166,0.1)',   border: 'rgba(20,184,166,0.3)' },
  { key: 'bo',    label: 'BienesOnline',color: 'rgba(99,102,241,0.1)',   border: 'rgba(99,102,241,0.3)' },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BusquedaPage() {
  const [operacion, setOperacion] = useState('Venta')
  const [tipo, setTipo] = useState('Departamento')
  const [zona, setZona] = useState('')
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [dormitorios, setDormitorios] = useState('')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const [resultados, setResultados] = useState<Propiedad[]>([])
  const [cargando, setCargando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState('')

  const [urlManual, setUrlManual] = useState('')
  const [propiedadesManuales, setPropiedadesManuales] = useState<Propiedad[]>([])
  const [cargandoManual, setCargandoManual] = useState(false)

  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [modalLista, setModalLista] = useState(false)

  // Armar URLs con los filtros actuales
  const portalURLs = zona.trim()
    ? buildPortalURLs(operacion, tipo, zona, precioMin, precioMax, dormitorios)
    : null

  // Buscar en MercadoLibre (API oficial gratuita)
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
          operacion: opSlug(operacion),
          tipo: tipoSlug(tipo),
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

  // Agregar propiedad por URL
  const agregarManual = async () => {
    if (!urlManual.trim()) return
    const url = urlManual.trim()
    if ([...resultados, ...propiedadesManuales].find(p => p.url_original === url)) {
      setUrlManual(''); return
    }

    let portal = 'manual'
    if (url.includes('zonaprop')) portal = 'zonaprop'
    else if (url.includes('argenprop')) portal = 'argenprop'
    else if (url.includes('mercadolibre') || url.includes('inmuebles.mercadolibre')) portal = 'mercadolibre'
    else if (url.includes('infocasas')) portal = 'infocasas'
    else if (url.includes('properati') || url.includes('proppit')) portal = 'properati'
    else if (url.includes('propia.com.ar')) portal = 'propia'
    else if (url.includes('bienesrosario')) portal = 'bienesrosario'
    else if (url.includes('doomos')) portal = 'doomos'
    else if (url.includes('lacapital')) portal = 'lacapital'
    else if (url.includes('yumblin')) portal = 'yumblin'
    else if (url.includes('bienesonline')) portal = 'bienesonline'

    setCargandoManual(true)
    try {
      // ML: traer datos via API oficial
      if (portal === 'mercadolibre') {
        const mlId = url.match(/MLA-?(\d+)/i)?.[0]?.replace('-', '')
        if (mlId) {
          const res = await fetch(`https://api.mercadolibre.com/items/${mlId}`)
          if (res.ok) {
            const item = await res.json()
            const atributos: Record<string, string> = {}
            ;(item.attributes || []).forEach((a: any) => { atributos[a.id] = a.value_name || '' })
            setPropiedadesManuales(prev => [{
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
            }, ...prev])
            setUrlManual('')
            setCargandoManual(false)
            return
          }
        }
      }

      // Resto de portales: agregar con datos mínimos
      setPropiedadesManuales(prev => [{
        portal,
        portal_id: `manual_${Date.now()}`,
        url_original: url,
        titulo: `Propiedad en ${portal.charAt(0).toUpperCase() + portal.slice(1)}`,
        barrio: zona || '',
        ciudad: 'Rosario',
        disponible: true,
      }, ...prev])
      setUrlManual('')
    } catch {
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

  const label: React.CSSProperties = { fontSize:10, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:6, fontFamily:'Montserrat,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }

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
              MercadoLibre · ZonaProp · Argenprop · Properati · Propia · InfoCasas · y más
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
        <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:20, marginBottom:16}}>
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
                style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box'}} />
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
                    style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={label}>Precio máx.</label>
                  <input type="number" value={precioMax} onChange={e => setPrecioMax(e.target.value)} placeholder="Sin límite"
                    style={{width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box'}} />
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

          {/* Botón ML */}
          <button onClick={buscar} disabled={cargando}
            style={{width:'100%', background:'#cc0000', border:'none', color:'#fff', padding:'12px', borderRadius:8, fontWeight:700, fontSize:13, fontFamily:'Montserrat,sans-serif', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:cargando?0.7:1, marginBottom:12}}>
            {cargando
              ? <><Loader2 style={{width:15, height:15, animation:'spin 1s linear infinite'}} />Buscando en MercadoLibre...</>
              : <><Search style={{width:15, height:15}} />Buscar en MercadoLibre (resultados acá)</>
            }
          </button>

          {/* Links a todos los portales */}
          {portalURLs && (
            <div>
              <p style={{margin:'0 0 8px', fontSize:10, color:'rgba(255,255,255,0.3)', fontFamily:'Montserrat,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase'}}>
                Buscar también en — abre en nueva pestaña con tu búsqueda aplicada:
              </p>
              <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                {PORTALES_CONFIG.map(p => (
                  <a key={p.key} href={(portalURLs as any)[p.key]} target="_blank" rel="noopener noreferrer"
                    style={{display:'flex', alignItems:'center', gap:5, background:p.color, border:`1px solid ${p.border}`, color:'rgba(255,255,255,0.75)', padding:'7px 14px', borderRadius:20, fontSize:11, fontWeight:700, fontFamily:'Montserrat,sans-serif', textDecoration:'none', whiteSpace:'nowrap'}}>
                    <ExternalLink style={{width:11, height:11}} />
                    {p.label}
                  </a>
                ))}
              </div>
              <p style={{margin:'8px 0 0', fontSize:11, color:'rgba(255,255,255,0.2)'}}>
                Encontraste algo que te gusta? Copiá la URL y pegala abajo para agregarlo a tu lista.
              </p>
            </div>
          )}
        </div>

        {/* ── Agregar por URL ── */}
        <div style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:16, marginBottom:20}}>
          <label style={{...label, marginBottom:8}}>
            <LinkIcon style={{width:12, height:12, display:'inline', marginRight:5}} />
            Agregar propiedad por URL — de cualquier portal
          </label>
          <div style={{display:'flex', gap:8}}>
            <input type="url" value={urlManual} onChange={e => setUrlManual(e.target.value)} onKeyDown={e => e.key==='Enter' && agregarManual()}
              placeholder="Pegá la URL de ZonaProp, Argenprop, Properati, Propia, InfoCasas, Doomos, LaCapital..."
              style={{flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'9px 12px', color:'#fff', fontSize:12, outline:'none', fontFamily:'Inter,sans-serif'}} />
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
            <p style={{...label, marginBottom:12}}>Propiedades agregadas ({propiedadesManuales.length})</p>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14}}>
              {propiedadesManuales.map(prop => (
                <div key={prop.url_original} style={{position:'relative'}}>
                  <button onClick={() => quitarManual(prop.url_original)}
                    style={{position:'absolute', top:8, right:8, zIndex:10, background:'rgba(0,0,0,0.7)', border:'none', color:'rgba(255,255,255,0.6)', borderRadius:'50%', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'}}>
                    <X style={{width:12, height:12}} />
                  </button>
                  <PropiedadCard propiedad={prop} seleccionada={seleccionadas.has(prop.url_original)} onToggle={() => toggleSeleccion(prop.url_original)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Resultados MercadoLibre ── */}
        {buscado && (
          <>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <span style={{fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.7)', fontFamily:'Montserrat,sans-serif'}}>
                {cargando ? 'Buscando en MercadoLibre...' : resultados.length === 0 ? 'Sin resultados en MercadoLibre' : `${resultados.length} resultados en MercadoLibre`}
              </span>
              {todasLasPropiedades.length > 0 && (
                <button onClick={() => {
                  if (seleccionadas.size === todasLasPropiedades.length) setSeleccionadas(new Set())
                  else setSeleccionadas(new Set(todasLasPropiedades.map(p => p.url_original)))
                }} style={{background:'none', border:'none', color:'#cc0000', fontSize:11, cursor:'pointer', fontWeight:600}}>
                  {seleccionadas.size === todasLasPropiedades.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
              )}
            </div>

            {!cargando && resultados.length === 0 && (
              <div style={{textAlign:'center', padding:'48px 0', color:'rgba(255,255,255,0.2)'}}>
                <Home style={{width:36, height:36, margin:'0 auto 10px', display:'block', opacity:0.3}} />
                <p style={{margin:0}}>Sin resultados en MercadoLibre para esa búsqueda.</p>
                <p style={{margin:'4px 0 0', fontSize:12}}>Buscá en los otros portales con los botones de arriba.</p>
              </div>
            )}

            {resultados.length > 0 && (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14}}>
                {resultados.map(prop => (
                  <PropiedadCard key={prop.url_original} propiedad={prop} seleccionada={seleccionadas.has(prop.url_original)} onToggle={() => toggleSeleccion(prop.url_original)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modalLista && (
        <CrearListaModal propiedades={propiedadesSeleccionadas} onClose={() => setModalLista(false)} onCreada={() => { setModalLista(false); setSeleccionadas(new Set()) }} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
