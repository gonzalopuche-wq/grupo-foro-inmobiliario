'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

interface PropMapa {
  id: string
  operacion: string
  tipo_propiedad: string
  precio: number | null
  moneda: string
  ciudad: string
  zona: string | null
  dormitorios: number | null
  banos: number | null
  superficie_cubierta: number | null
  superficie_total: number | null
  descripcion: string | null
  fotos: string[] | null
  latitud: number | null
  longitud: number | null
  honorario_compartir: string | null
}

const ROSARIO: [number, number] = [-32.9442, -60.6505]

const OP_COLOR: Record<string, string> = {
  venta: '#cc0000',
  alquiler: '#3b82f6',
  temporario: '#f97316',
}

const OP_LABEL: Record<string, string> = {
  venta: 'Venta',
  alquiler: 'Alquiler',
  temporario: 'Alquiler temporal',
}

const fmtPrecio = (n: number | null, m: string) =>
  n ? `${m ?? 'USD'} ${n.toLocaleString('es-AR')}` : 'Sin precio'

async function geocodeInterseccion(calle1: string, calle2: string, ciudad: string): Promise<[number, number] | null> {
  const q = encodeURIComponent(`${calle1} y ${calle2}, ${ciudad}, Argentina`)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ar`,
      { headers: { 'Accept-Language': 'es', 'User-Agent': 'GrupoForoInmobiliario/1.0' } }
    )
    const data = await res.json()
    if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  } catch { /* silent */ }
  return null
}

function MapEventTracker({
  onMove,
}: {
  onMove: (map: L.Map) => void
}) {
  const map = useMapEvents({
    moveend: () => onMove(map),
    zoomend: () => onMove(map),
  })
  return null
}

function MapInstanceCapture({ onReady }: { onReady: (m: L.Map) => void }) {
  const map = useMap()
  useEffect(() => { onReady(map) }, [map, onReady])
  return null
}

export default function MapaRedGFI() {
  const [props, setProps] = useState<PropMapa[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroOp, setFiltroOp] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroDorms, setFiltroDorms] = useState('')
  const [haMovido, setHaMovido] = useState(false)
  const [boundsActivos, setBoundsActivos] = useState<L.LatLngBounds | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [modoPanel, setModoPanel] = useState<'ninguno' | 'cuadrante'>('ninguno')
  const [c1a, setC1a] = useState('')
  const [c1b, setC1b] = useState('')
  const [c2a, setC2a] = useState('')
  const [c2b, setC2b] = useState('')
  const [ciudadGeo, setCiudadGeo] = useState('Rosario')
  const [geocodificando, setGeocodificando] = useState(false)
  const [geoError, setGeoError] = useState('')

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      const { data } = await supabase
        .from('mir_ofrecidos')
        .select('id,operacion,tipo_propiedad,precio,moneda,ciudad,zona,dormitorios,banos,superficie_cubierta,superficie_total,descripcion,fotos,latitud,longitud,honorario_compartir')
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(500)
      setProps((data as PropMapa[]) ?? [])
      setCargando(false)
    }
    cargar()
  }, [])

  const handleMapReady = useCallback((m: L.Map) => {
    setMapInstance(m)
    setBoundsActivos(m.getBounds())
  }, [])

  const handleMove = useCallback((m: L.Map) => {
    setHaMovido(true)
    setBoundsActivos(m.getBounds())
  }, [])

  const buscarEnZona = async () => {
    if (!mapInstance) return
    const bounds = mapInstance.getBounds()
    setBoundsActivos(bounds)
    setHaMovido(false)
    setCargando(true)
    const { data } = await supabase
      .from('mir_ofrecidos')
      .select('id,operacion,tipo_propiedad,precio,moneda,ciudad,zona,dormitorios,banos,superficie_cubierta,superficie_total,descripcion,fotos,latitud,longitud,honorario_compartir')
      .eq('activo', true)
      .not('latitud', 'is', null)
      .gte('latitud', bounds.getSouth())
      .lte('latitud', bounds.getNorth())
      .gte('longitud', bounds.getWest())
      .lte('longitud', bounds.getEast())
      .order('created_at', { ascending: false })
      .limit(500)
    setProps((data as PropMapa[]) ?? [])
    setCargando(false)
  }

  const buscarPorCuadrante = async () => {
    if (!c1a || !c1b || !c2a || !c2b) { setGeoError('Completá las cuatro calles para definir el cuadrante.'); return }
    setGeocodificando(true)
    setGeoError('')
    const [p1, p2] = await Promise.all([
      geocodeInterseccion(c1a, c1b, ciudadGeo),
      geocodeInterseccion(c2a, c2b, ciudadGeo),
    ])
    if (!p1 || !p2) {
      setGeoError('No se encontraron las intersecciones. Verificá los nombres de las calles.')
      setGeocodificando(false)
      return
    }
    const bounds = L.latLngBounds(L.latLng(p1[0], p1[1]), L.latLng(p2[0], p2[1]))
    if (mapInstance) {
      mapInstance.fitBounds(bounds.pad(0.15))
    }
    setBoundsActivos(bounds)
    setHaMovido(false)
    setModoPanel('ninguno')
    setGeocodificando(false)
  }

  const propsFiltradas = props.filter(p => {
    if (filtroOp && p.operacion !== filtroOp) return false
    if (filtroTipo && !p.tipo_propiedad?.toLowerCase().includes(filtroTipo.toLowerCase())) return false
    if (filtroDorms && p.dormitorios !== null && p.dormitorios < parseInt(filtroDorms)) return false
    return true
  })

  const conCoords = propsFiltradas.filter(p => p.latitud && p.longitud)

  const enBounds = boundsActivos
    ? conCoords.filter(p => boundsActivos.contains(L.latLng(p.latitud!, p.longitud!)))
    : conCoords

  const sinCoords = propsFiltradas.filter(p => !p.latitud || !p.longitud)
  const resultados = [...enBounds, ...sinCoords]

  const tipos = [...new Set(props.map(p => p.tipo_propiedad).filter(Boolean))].sort()

  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', color: '#fff', fontFamily: 'Inter,sans-serif' },
    topBar: { padding: '16px 20px 0', maxWidth: 1200, margin: '0 auto' },
    breadcrumb: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 },
    titulo: { margin: '0 0 12px', fontSize: 18, fontWeight: 800, fontFamily: 'Montserrat,sans-serif' },
    filtros: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 12, alignItems: 'center' },
    sel: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '6px 10px', fontSize: 12, outline: 'none', cursor: 'pointer' },
    mapWrap: { position: 'relative' as const, width: '100%', height: '58vh', minHeight: 360 },
    buscarBtn: { position: 'absolute' as const, bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: '#cc0000', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 24, fontSize: 13, fontWeight: 800, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' as const },
    buscarBtnInactive: { background: 'rgba(40,40,40,0.9)', border: '1px solid rgba(255,255,255,0.15)' },
    panelBtn: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' },
    cuadrantePanel: { margin: '0 20px 0', maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto', background: 'rgba(30,30,30,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0 0 10px 10px', padding: '16px 20px' },
    inputCalle: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 13, outline: 'none', flex: 1, fontFamily: 'Inter,sans-serif' },
    resultados: { maxWidth: 1200, margin: '0 auto', padding: '16px 20px' },
    card: { display: 'flex', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 8, alignItems: 'center' },
  }

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.breadcrumb}>
          <Link href="/red-gfi" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Red GFI</Link>
          <span>/</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Mapa</span>
        </div>
        <h1 style={s.titulo}>🗺️ Búsqueda en mapa — Red GFI</h1>

        {/* Filtros */}
        <div style={s.filtros}>
          <select style={s.sel} value={filtroOp} onChange={e => setFiltroOp(e.target.value)}>
            <option value="">Todas las operaciones</option>
            <option value="venta">Venta</option>
            <option value="alquiler">Alquiler</option>
            <option value="temporario">Temporario</option>
          </select>
          <select style={s.sel} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select style={s.sel} value={filtroDorms} onChange={e => setFiltroDorms(e.target.value)}>
            <option value="">Dorms (mín.)</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
          <button
            style={{ ...s.panelBtn, background: modoPanel === 'cuadrante' ? 'rgba(204,0,0,0.15)' : undefined, borderColor: modoPanel === 'cuadrante' ? 'rgba(204,0,0,0.4)' : undefined }}
            onClick={() => setModoPanel(modoPanel === 'cuadrante' ? 'ninguno' : 'cuadrante')}
          >
            📍 Buscar por cuadrante de calles
          </button>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 4 }}>
            {cargando ? 'Cargando…' : `${resultados.length} resultados (${enBounds.length} en zona visible)`}
          </span>
        </div>
      </div>

      {/* Panel cuadrante de calles */}
      {modoPanel === 'cuadrante' && (
        <div style={s.cuadrantePanel}>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Definir zona por intersección de calles
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>Esquina SW (abajo-izquierda)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={s.inputCalle} placeholder="Ej: Av. Pellegrini" value={c1a} onChange={e => setC1a(e.target.value)} />
                <span style={{ alignSelf: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>y</span>
                <input style={s.inputCalle} placeholder="Ej: Bv. Oroño" value={c1b} onChange={e => setC1b(e.target.value)} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>Esquina NE (arriba-derecha)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={s.inputCalle} placeholder="Ej: Av. Córdoba" value={c2a} onChange={e => setC2a(e.target.value)} />
                <span style={{ alignSelf: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>y</span>
                <input style={s.inputCalle} placeholder="Ej: San Martín" value={c2b} onChange={e => setC2b(e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Ciudad:</span>
              <input style={{ ...s.inputCalle, flex: 'none', width: 120 }} value={ciudadGeo} onChange={e => setCiudadGeo(e.target.value)} />
            </div>
            <button
              onClick={buscarPorCuadrante}
              disabled={geocodificando}
              style={{ background: '#cc0000', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}
            >
              {geocodificando ? 'Buscando…' : '🔍 Ir al cuadrante'}
            </button>
          </div>
          {geoError && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f87171' }}>{geoError}</p>}
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            Las calles se geocodifican automáticamente con OpenStreetMap. Usá nombres completos para mejor precisión.
          </p>
        </div>
      )}

      {/* Mapa */}
      <div style={s.mapWrap}>
        <MapContainer
          center={ROSARIO}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapInstanceCapture onReady={handleMapReady} />
          <MapEventTracker onMove={handleMove} />
          {conCoords.map(p => (
            <CircleMarker
              key={p.id}
              center={[p.latitud!, p.longitud!]}
              radius={8}
              pathOptions={{
                color: OP_COLOR[p.operacion] ?? '#888',
                fillColor: OP_COLOR[p.operacion] ?? '#888',
                fillOpacity: 0.8,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: 180, fontSize: 13 }}>
                  {p.fotos?.[0] && (
                    <img src={p.fotos[0]} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />
                  )}
                  <strong>{p.tipo_propiedad}</strong>
                  <br />
                  <span style={{ color: OP_COLOR[p.operacion] }}>{OP_LABEL[p.operacion] ?? p.operacion}</span>
                  {' · '}
                  <strong>{fmtPrecio(p.precio, p.moneda)}</strong>
                  <br />
                  <span style={{ color: '#666', fontSize: 11 }}>
                    {[p.zona, p.ciudad].filter(Boolean).join(', ')}
                  </span>
                  {p.dormitorios && <><br />{p.dormitorios} dorm. {p.banos ? `· ${p.banos} baños` : ''}</>}
                  {p.honorario_compartir && <><br /><span style={{ color: '#22c55e', fontSize: 11 }}>Hon: {p.honorario_compartir}</span></>}
                  <br />
                  <a href={`/red-gfi/ficha/${p.id}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#cc0000', fontSize: 11, fontWeight: 700 }}>
                    Ver ficha anónima →
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Botón buscar en esta zona */}
        <button
          style={{ ...s.buscarBtn, ...(haMovido ? {} : s.buscarBtnInactive) }}
          onClick={buscarEnZona}
        >
          🔍 Buscar en esta zona
        </button>

        {/* Leyenda */}
        <div style={{ position: 'absolute', bottom: 20, right: 12, zIndex: 999, background: 'rgba(20,20,20,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
          {Object.entries(OP_COLOR).map(([op, color]) => (
            <div key={op} style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ccc', marginBottom: 2 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '1px solid white' }} />
              {OP_LABEL[op]}
            </div>
          ))}
        </div>
      </div>

      {/* Resultados */}
      <div style={s.resultados}>
        {enBounds.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              {enBounds.length} propiedades en la zona visible
            </div>
            {enBounds.map(p => <TarjetaMapa key={p.id} p={p} />)}
          </>
        )}

        {sinCoords.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '16px 0 10px' }}>
              {sinCoords.length} sin ubicación exacta
            </div>
            {sinCoords.map(p => <TarjetaMapa key={p.id} p={p} dimmed />)}
          </>
        )}

        {resultados.length === 0 && !cargando && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13, fontStyle: 'italic' }}>
            No hay propiedades que coincidan con los filtros seleccionados.
          </div>
        )}
      </div>
    </div>
  )
}

function TarjetaMapa({ p, dimmed }: { p: PropMapa; dimmed?: boolean }) {
  const color = OP_COLOR[p.operacion] ?? '#888'
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '10px 12px', marginBottom: 8,
      background: dimmed ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${dimmed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 8, alignItems: 'center',
      opacity: dimmed ? 0.6 : 1,
    }}>
      {p.fotos?.[0]
        ? <img src={p.fotos[0]} alt="" style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
        : <div style={{ width: 60, height: 45, background: 'rgba(255,255,255,0.04)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏠</div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
          {p.tipo_propiedad}
          <span style={{ marginLeft: 6, fontSize: 11, color, fontWeight: 700 }}>{OP_LABEL[p.operacion] ?? p.operacion}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
          📍 {[p.zona, p.ciudad].filter(Boolean).join(', ')}
          {p.dormitorios ? ` · ${p.dormitorios} dorm.` : ''}
          {p.honorario_compartir ? ` · Hon: ${p.honorario_compartir}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, color: '#22c55e', fontSize: 13 }}>
          {fmtPrecio(p.precio, p.moneda)}
        </div>
        <a href={`/red-gfi/ficha/${p.id}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
          Ver ficha →
        </a>
      </div>
    </div>
  )
}
