// app/(private)/crm/busqueda/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { Search, Loader2, Home, AlertCircle,
         ChevronDown, SlidersHorizontal, ExternalLink } from 'lucide-react'
import PropDetailModal from './PropDetailModal'

const TIPOS = ['Departamento', 'Casa', 'PH', 'Local', 'Oficina', 'Terreno', 'Galpón']
const OPERACIONES = ['Venta', 'Alquiler', 'Alquiler temporal']
const DORMITORIOS = ['1', '2', '3', '4', '5+']

// Config visual por fuente (cubre todos los valores posibles del campo fuente en v_propiedades_mercado)
const FUENTES_CONFIG: Record<string, { label: string; color: string; border: string; badge: string }> = {
  gfi:           { label: 'Red GFI',   color: 'rgba(153,0,0,0.15)',    border: 'rgba(153,0,0,0.4)',    badge: '#990000' },
  gfi_red:       { label: 'Red GFI',   color: 'rgba(153,0,0,0.15)',    border: 'rgba(153,0,0,0.4)',    badge: '#990000' },
  gfi_portal:    { label: 'Red GFI',   color: 'rgba(153,0,0,0.15)',    border: 'rgba(153,0,0,0.4)',    badge: '#990000' },
  kiteprop:      { label: 'Kiteprop',  color: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)', badge: '#3b82f6' },
  tokko:         { label: 'Tokko',     color: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.4)', badge: '#8b5cf6' },
  propia:        { label: 'Propia',    color: 'rgba(58,186,182,0.12)', border: 'rgba(58,186,182,0.4)', badge: '#3abab6' },
  propia_red:    { label: 'Propia',    color: 'rgba(58,186,182,0.12)', border: 'rgba(58,186,182,0.4)', badge: '#3abab6' },
  propia_portal: { label: 'Propia',    color: 'rgba(58,186,182,0.12)', border: 'rgba(58,186,182,0.4)', badge: '#3abab6' },
  zonaprop:      { label: 'ZonaProp',  color: 'rgba(230,0,0,0.08)',    border: 'rgba(230,0,0,0.25)',   badge: '#e60000' },
  argenprop:     { label: 'Argenprop', color: 'rgba(245,166,35,0.08)', border: 'rgba(245,166,35,0.3)', badge: '#f5a623' },
  mercadolibre:  { label: 'ML',        color: 'rgba(255,230,0,0.08)',  border: 'rgba(255,230,0,0.25)', badge: '#ffe600' },
}

// Grupos para los chips de filtro (cada grupo expande a múltiples valores de fuente)
const FUENTES_GRUPOS = [
  { id: 'gfi',          label: 'Red GFI',   badge: '#990000', portales: ['gfi', 'gfi_red', 'gfi_portal'] },
  { id: 'kiteprop',     label: 'Kiteprop',  badge: '#3b82f6', portales: ['kiteprop'] },
  { id: 'tokko',        label: 'Tokko',     badge: '#8b5cf6', portales: ['tokko'] },
  { id: 'propia',       label: 'Propia',    badge: '#3abab6', portales: ['propia', 'propia_red', 'propia_portal'] },
  { id: 'zonaprop',     label: 'ZonaProp',  badge: '#e60000', portales: ['zonaprop'] },
  { id: 'argenprop',    label: 'Argenprop', badge: '#f5a623', portales: ['argenprop'] },
  { id: 'mercadolibre', label: 'ML',        badge: '#ffe600', portales: ['mercadolibre'] },
]

interface PropLocal {
  id: string
  fuente: string
  titulo: string
  operacion: string
  tipo: string | null
  precio: number | null
  moneda: string | null
  barrio: string | null
  ciudad: string | null
  dormitorios: number | null
  banos: number | null
  superficie_cubierta: number | null
  foto_principal: string | null
  url: string | null
  propietario_id: string | null
}

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
  { key: 'pr',    label: 'Properati',   color: 'rgba(58,186,182,0.1)',   border: 'rgba(58,186,182,0.3)' },
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

  const [error, setError] = useState('')

  const [resultadosLocal, setResultadosLocal] = useState<PropLocal[]>([])
  const [totalLocal, setTotalLocal] = useState(0)
  const [cargandoLocal, setCargandoLocal] = useState(false)
  const [buscadoLocal, setBuscadoLocal] = useState(false)
  // IDs de grupos seleccionados (por defecto todos)
  const [gruposFiltro, setGruposFiltro] = useState<string[]>(FUENTES_GRUPOS.map(g => g.id))
  const [selectedProp, setSelectedProp] = useState<{id: string; fuente: string} | null>(null)


  // Armar URLs con los filtros actuales (para links externos)
  const portalURLs = zona.trim()
    ? buildPortalURLs(operacion, tipo, zona, precioMin, precioMax, dormitorios)
    : null

  // Buscar en base local unificada (GFI + todos los portales)
  const buscarLocal = useCallback(async () => {
    setCargandoLocal(true)
    setBuscadoLocal(true)
    setResultadosLocal([])
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setCargandoLocal(false); return }

      const params = new URLSearchParams()
      if (operacion) params.set('operacion', operacion.toLowerCase().replace(/ /g, '_'))
      if (tipo) params.set('tipo', tipo.toLowerCase())
      if (zona.trim()) params.set('barrio', zona.trim())
      if (precioMin) params.set('precioMin', precioMin)
      if (precioMax) params.set('precioMax', precioMax)
      if (dormitorios) params.set('dormitorios', dormitorios.replace('+', ''))
      // Expandir grupos a portales individuales; si están todos seleccionados, no filtrar
      const todosSeleccionados = gruposFiltro.length === FUENTES_GRUPOS.length
      if (!todosSeleccionados && gruposFiltro.length > 0) {
        const portales = gruposFiltro.flatMap(g => FUENTES_GRUPOS.find(x => x.id === g)?.portales ?? [])
        params.set('fuentes', portales.join(','))
      }
      params.set('limit', '100')

      const res = await fetch(`/api/propiedades/mercado?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultadosLocal(data.propiedades ?? [])
      setTotalLocal(data.total ?? 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargandoLocal(false)
    }
  }, [operacion, tipo, zona, precioMin, precioMax, dormitorios, gruposFiltro])

  const toggleGrupo = (id: string) => {
    setGruposFiltro(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const label: React.CSSProperties = { fontSize:10, color:'var(--gfi-text-muted)', display:'block', marginBottom:6, fontFamily:'Montserrat,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }

  return (
    <div style={{minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'Inter,sans-serif'}}>

      {/* Header */}
      <div style={{borderBottom:'1px solid var(--gfi-border-subtle)', background:'rgba(13,13,13,0.98)', position:'sticky', top:0, zIndex:20, padding:'14px 20px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', maxWidth:1200, margin:'0 auto'}}>
          <div>
            <h1 style={{margin:0, fontSize:18, fontWeight:800, fontFamily:'Montserrat,sans-serif', display:'flex', alignItems:'center', gap:8}}>
              <Search style={{width:18, height:18, color:'#990000'}} />
              Búsqueda Inteligente
            </h1>
            <p style={{margin:'2px 0 0', fontSize:11, color:'var(--gfi-text-muted)'}}>
              Todo el mercado de la 2da Circ. COCIR — Red GFI · ZonaProp · Argenprop · y más
            </p>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:20}}>

        {/* ── Filtros ── */}
        <div style={{background:'var(--gfi-bg-card)', border:'1px solid var(--gfi-border)', borderRadius:12, padding:20, marginBottom:16}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:14}}>
            <div>
              <label style={label}>Operación</label>
              <div style={{display:'flex', gap:4}}>
                {OPERACIONES.map(op => (
                  <button key={op} onClick={() => setOperacion(op)}
                    style={{flex:1, padding:'7px 4px', borderRadius:6, border:`1px solid ${operacion===op?'#990000':'var(--gfi-border)'}`, background:operacion===op?'rgba(200,0,0,0.12)':'transparent', color:operacion===op?'#fff':'var(--gfi-text-muted)', fontSize:10, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor:'pointer'}}>
                    {op}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={label}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                style={{width:'100%', background:'var(--gfi-border-subtle)', border:'1px solid var(--gfi-border)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none'}}>
                {TIPOS.map(t => <option key={t} style={{background:'#111'}}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Zona / Barrio</label>
              <input type="text" value={zona} onChange={e => setZona(e.target.value)} onKeyDown={e => e.key==='Enter' && buscarLocal()}
                placeholder="Ej: Pichincha, Centro, Fisherton..."
                style={{width:'100%', background:'var(--gfi-border-subtle)', border:'1px solid var(--gfi-border)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box'}} />
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <button onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
              style={{background:'none', border:'none', color:'var(--gfi-text-muted)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4, padding:0}}>
              <SlidersHorizontal style={{width:13, height:13}} />
              Filtros avanzados
              <ChevronDown style={{width:13, height:13, transform:filtrosAbiertos?'rotate(180deg)':'none', transition:'transform 0.2s'}} />
            </button>
            {filtrosAbiertos && (
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginTop:12}}>
                <div>
                  <label style={label}>Precio mín.</label>
                  <input type="number" value={precioMin} onChange={e => setPrecioMin(e.target.value)} placeholder="USD 0"
                    style={{width:'100%', background:'var(--gfi-border-subtle)', border:'1px solid var(--gfi-border)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={label}>Precio máx.</label>
                  <input type="number" value={precioMax} onChange={e => setPrecioMax(e.target.value)} placeholder="Sin límite"
                    style={{width:'100%', background:'var(--gfi-border-subtle)', border:'1px solid var(--gfi-border)', borderRadius:6, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', boxSizing:'border-box'}} />
                </div>
                <div>
                  <label style={label}>Dormitorios</label>
                  <div style={{display:'flex', gap:4}}>
                    {DORMITORIOS.map(d => (
                      <button key={d} onClick={() => setDormitorios(dormitorios===d?'':d)}
                        style={{flex:1, padding:'7px 2px', borderRadius:6, border:`1px solid ${dormitorios===d?'#990000':'var(--gfi-border)'}`, background:dormitorios===d?'rgba(200,0,0,0.12)':'transparent', color:dormitorios===d?'#fff':'var(--gfi-text-muted)', fontSize:10, fontWeight:700, cursor:'pointer'}}>
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

          {/* Filtro de fuentes */}
          <div style={{marginBottom:12}}>
            <label style={label}>Buscar en</label>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {FUENTES_GRUPOS.map(g => {
                const activa = gruposFiltro.includes(g.id)
                return (
                  <button key={g.id} onClick={() => toggleGrupo(g.id)}
                    style={{padding:'5px 12px', borderRadius:20, border:`1px solid ${activa ? g.badge : 'var(--gfi-border)'}`, background:activa ? `${g.badge}22` : 'transparent', color:activa ? '#fff' : 'var(--gfi-text-muted)', fontSize:11, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor:'pointer', transition:'all 0.15s'}}>
                    {g.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Botón base local */}
          <button onClick={buscarLocal} disabled={cargandoLocal || gruposFiltro.length === 0}
            style={{width:'100%', background:'rgba(153,0,0,0.85)', border:'none', color:'#fff', padding:'12px', borderRadius:8, fontWeight:700, fontSize:13, fontFamily:'Montserrat,sans-serif', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:(cargandoLocal||gruposFiltro.length===0)?0.5:1, marginBottom:8}}>
            {cargandoLocal
              ? <><Loader2 style={{width:15, height:15, animation:'spin 1s linear infinite'}} />Buscando en base local...</>
              : <><Search style={{width:15, height:15}} />Buscar en base GFI + portales (todo el mercado)</>
            }
          </button>

          {/* Links a todos los portales */}
          {portalURLs && (
            <div>
              <p style={{margin:'0 0 8px', fontSize:10, color:'var(--gfi-text-muted)', fontFamily:'Montserrat,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase'}}>
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
              <p style={{margin:'8px 0 0', fontSize:11, color:'var(--gfi-text-dim)'}}>
                Encontraste algo que te gusta? Copiá la URL y pegala abajo para agregarlo a tu lista.
              </p>
            </div>
          )}
        </div>

        {/* ── Resultados base local (GFI + ZP + AP) ── */}
        {buscadoLocal && (
          <div style={{marginBottom:28}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:8, flexWrap:'wrap'}}>
              <div>
                <span style={{fontSize:14, fontWeight:800, color:'#fff', fontFamily:'Montserrat,sans-serif'}}>
                  {cargandoLocal ? 'Buscando en todo el mercado...' : `${totalLocal.toLocaleString('es-AR')} propiedades en el mercado`}
                </span>
                {!cargandoLocal && totalLocal > 0 && (
                  <div style={{display:'flex', gap:8, marginTop:6, flexWrap:'wrap'}}>
                    {Object.entries(
                      resultadosLocal.reduce<Record<string, number>>((acc, p) => {
                        acc[p.fuente] = (acc[p.fuente] ?? 0) + 1
                        return acc
                      }, {})
                    ).map(([fuente, cant]) => (
                      <span key={fuente} style={{fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, background: FUENTES_CONFIG[fuente]?.color ?? 'var(--gfi-border-subtle)', border:`1px solid ${FUENTES_CONFIG[fuente]?.border ?? 'var(--gfi-border)'}`, color:'var(--gfi-text-primary)', fontFamily:'Montserrat,sans-serif', letterSpacing:'0.05em'}}>
                        {FUENTES_CONFIG[fuente]?.label ?? fuente}: {cant}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!cargandoLocal && resultadosLocal.length === 0 && (
              <div style={{textAlign:'center', padding:'32px 0', color:'var(--gfi-text-dim)'}}>
                <Home style={{width:32, height:32, margin:'0 auto 8px', display:'block', opacity:0.3}} />
                <p style={{margin:0}}>Sin resultados en la base local para esos filtros.</p>
              </div>
            )}

            {resultadosLocal.length > 0 && (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14}}>
                {resultadosLocal.map(p => {
                  const cfg = FUENTES_CONFIG[p.fuente] ?? FUENTES_CONFIG.gfi
                  const precioStr = p.precio
                    ? `${p.moneda === 'ARS' ? '$' : 'U$D'} ${p.precio.toLocaleString('es-AR')}`
                    : null
                  return (
                    <div key={p.id}
                      onClick={() => setSelectedProp({id: p.id, fuente: p.fuente})}
                      style={{display:'block', background:'var(--gfi-bg-card)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:10, overflow:'hidden', color:'inherit', transition:'border-color 0.15s', cursor:'pointer'}}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = cfg.border)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}>
                      <div style={{height:160, background:'var(--gfi-border-subtle)', overflow:'hidden', position:'relative'}}>
                        {p.foto_principal
                          ? <img src={p.foto_principal} alt={p.titulo ?? ''} style={{width:'100%', height:'100%', objectFit:'cover'}}
                              referrerPolicy="no-referrer"
                              onError={e => { const t = e.currentTarget; t.style.display='none'; (t.nextSibling as HTMLElement | null)?.style && ((t.nextSibling as HTMLElement).style.display='flex'); }} />
                          : null}
                        <div style={{display: p.foto_principal ? 'none' : 'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize:28, color:'var(--gfi-border)'}}>🏠</div>
                        <span style={{position:'absolute', top:8, left:8, fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:10, background:cfg.badge, color:'#fff', fontFamily:'Montserrat,sans-serif', letterSpacing:'0.06em', textTransform:'uppercase'}}>
                          {cfg.label}
                        </span>
                        {p.fuente === 'gfi' && (
                          <span style={{position:'absolute', top:8, right:8, fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:10, background:'rgba(0,0,0,0.6)', color:'var(--gfi-text-secondary)', fontFamily:'Montserrat,sans-serif'}}>
                            Cartera GFI
                          </span>
                        )}
                      </div>
                      <div style={{padding:'12px 14px'}}>
                        <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:4, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>{p.titulo}</div>
                        {(p.barrio || p.ciudad) && (
                          <div style={{fontSize:11, color:'var(--gfi-text-muted)', marginBottom:8}}>📍 {[p.barrio, p.ciudad].filter(Boolean).join(', ')}</div>
                        )}
                        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                          {precioStr
                            ? <span style={{fontSize:15, fontWeight:800, color:cfg.badge}}>{precioStr}</span>
                            : <span style={{fontSize:12, color:'var(--gfi-text-dim)'}}>Consultar</span>
                          }
                          <div style={{display:'flex', gap:6}}>
                            {p.dormitorios && <span style={{fontSize:10, background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:4, color:'var(--gfi-text-secondary)'}}>🛏 {p.dormitorios}</span>}
                            {p.superficie_cubierta && <span style={{fontSize:10, background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:4, color:'var(--gfi-text-secondary)'}}>📐 {p.superficie_cubierta}m²</span>}
                          </div>
                        </div>
                        {(p.operacion || p.tipo) && (
                          <div style={{fontSize:10, color:'var(--gfi-text-dim)', marginTop:6}}>{[p.operacion, p.tipo].filter(Boolean).join(' · ')}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {selectedProp && (
        <PropDetailModal
          propId={selectedProp.id}
          fuente={selectedProp.fuente}
          onClose={() => setSelectedProp(null)}
        />
      )}
    </div>
  )
}
