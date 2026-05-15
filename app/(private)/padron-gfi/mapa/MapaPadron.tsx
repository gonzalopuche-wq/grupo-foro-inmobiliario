'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'

interface Corredor {
  id: string
  matricula: string | null
  nombre: string | null
  apellido: string | null
  inmobiliaria: string | null
  direccion: string | null
  localidad: string | null
  telefono: string | null
  email: string | null
  estado: string | null
  latitud: number
  longitud: number
}

interface Zona {
  localidad: string
  corredores: Corredor[]
  lat: number
  lng: number
}

const ROSARIO: [number, number] = [-32.9442, -60.6505]

function makeZonaIcon(count: number, activos: number) {
  const color = activos > 0 ? '#cc0000' : '#555'
  const html = `
    <div style="
      background:${color};
      color:#fff;
      border-radius:50%;
      width:${Math.min(20 + count * 2, 56)}px;
      height:${Math.min(20 + count * 2, 56)}px;
      display:flex;align-items:center;justify-content:center;
      font-family:Montserrat,sans-serif;font-weight:800;
      font-size:${count > 99 ? 11 : 13}px;
      border:2px solid rgba(255,255,255,0.3);
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    ">${count}</div>`
  const size = Math.min(20 + count * 2, 56)
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

function ZonaMarker({ zona, onSelect }: { zona: Zona; onSelect: (z: Zona) => void }) {
  const activos = zona.corredores.filter(c => c.estado?.toLowerCase().includes('habilitado') || c.estado?.toLowerCase().includes('activo')).length
  return (
    <Marker
      position={[zona.lat, zona.lng]}
      icon={makeZonaIcon(zona.corredores.length, activos)}
      eventHandlers={{ click: () => onSelect(zona) }}
    >
      <Popup>
        <div style={{ fontFamily: 'Montserrat,sans-serif', minWidth: 160 }}>
          <strong style={{ fontSize: 13 }}>{zona.localidad}</strong>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            {zona.corredores.length} corredor{zona.corredores.length !== 1 ? 'es' : ''}
            {activos > 0 && ` · ${activos} habilitado${activos !== 1 ? 's' : ''}`}
          </div>
          <button
            onClick={() => onSelect(zona)}
            style={{ marginTop: 8, background: '#cc0000', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
          >
            Ver lista →
          </button>
        </div>
      </Popup>
    </Marker>
  )
}

function FitBounds({ zonas }: { zonas: Zona[] }) {
  const map = useMap()
  useEffect(() => {
    if (zonas.length === 0) return
    const bounds = L.latLngBounds(zonas.map(z => [z.lat, z.lng] as [number, number]))
    map.fitBounds(bounds.pad(0.1))
  }, [zonas, map])
  return null
}

export default function MapaPadron() {
  const [corredores, setCorredores] = useState<Corredor[]>([])
  const [cargando, setCargando] = useState(true)
  const [geocodificando, setGeocodificando] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')
  const [pendientes, setPendientes] = useState(0)
  const [zonaSeleccionada, setZonaSeleccionada] = useState<Zona | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [esAdmin, setEsAdmin] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase.from('perfiles').select('tipo').eq('id', user.id).single()
        setEsAdmin(perfil?.tipo === 'admin' || perfil?.tipo === 'master')
      }

      const { data } = await supabase
        .from('cocir_padron')
        .select('id,matricula,nombre,apellido,inmobiliaria,direccion,localidad,telefono,email,estado,latitud,longitud')
        .not('latitud', 'is', null)
        .not('longitud', 'is', null)
        .order('apellido', { ascending: true })
        .limit(2000)
      setCorredores((data as Corredor[]) ?? [])

      const { count } = await supabase
        .from('cocir_padron')
        .select('id', { count: 'exact', head: true })
        .is('latitud', null)
        .not('direccion', 'is', null)
      setPendientes(count ?? 0)

      setCargando(false)
    }
    cargar()
  }, [])

  const zonas = useMemo<Zona[]>(() => {
    const map = new Map<string, Corredor[]>()
    for (const c of corredores) {
      const key = c.localidad?.trim() || 'Sin localidad'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    const result: Zona[] = []
    map.forEach((cs, localidad) => {
      const lat = cs.reduce((s, c) => s + c.latitud, 0) / cs.length
      const lng = cs.reduce((s, c) => s + c.longitud, 0) / cs.length
      result.push({ localidad, corredores: cs, lat, lng })
    })
    return result.sort((a, b) => b.corredores.length - a.corredores.length)
  }, [corredores])

  const zonasFiltradas = useMemo(() => {
    if (!busqueda && !filtroEstado) return zonas
    return zonas.map(z => ({
      ...z,
      corredores: z.corredores.filter(c => {
        const texto = `${c.nombre} ${c.apellido} ${c.inmobiliaria} ${c.matricula}`.toLowerCase()
        if (busqueda && !texto.includes(busqueda.toLowerCase())) return false
        if (filtroEstado && !c.estado?.toLowerCase().includes(filtroEstado.toLowerCase())) return false
        return true
      }),
    })).filter(z => z.corredores.length > 0)
  }, [zonas, busqueda, filtroEstado])

  const triggearGeocodificacion = async () => {
    setGeocodificando(true)
    setGeoMsg('Geocodificando...')
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/admin/geocodificar-padron', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` },
      })
      const data = await res.json()
      if (data.ok) {
        setGeoMsg(`✓ ${data.geocodificados} geocodificados, ${data.fallidos} fallidos`)
        setPendientes(p => Math.max(0, p - data.procesados))
      } else {
        setGeoMsg(`Error: ${data.error}`)
      }
    } catch {
      setGeoMsg('Error de conexión')
    }
    setGeocodificando(false)
  }

  const s = {
    page: { minHeight: '100vh', color: '#fff', fontFamily: 'Inter,sans-serif' },
    topBar: { padding: '16px 20px 0', maxWidth: 1400, margin: '0 auto' },
    breadcrumb: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 },
    titulo: { margin: '0 0 12px', fontSize: 18, fontWeight: 800, fontFamily: 'Montserrat,sans-serif' },
    barra: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 12, alignItems: 'center' },
    input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '6px 12px', fontSize: 12, outline: 'none', flex: 1, minWidth: 160 },
    sel: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '6px 10px', fontSize: 12, outline: 'none' },
    mapWrap: { width: '100%', height: '55vh', minHeight: 340 },
    panel: { maxWidth: 1400, margin: '0 auto', padding: '16px 20px', display: 'grid', gridTemplateColumns: zonaSeleccionada ? '1fr 360px' : '1fr', gap: 16 },
    zonaCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '12px 16px', marginBottom: 8 },
    corrCard: { display: 'flex', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 6 },
  }

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.breadcrumb}>
          <a href="/padron-gfi" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Padrón COCIR</a>
          <span>/</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Mapa de zonas</span>
        </div>
        <h1 style={s.titulo}>📍 Mapa de corredores por zona</h1>

        <div style={s.barra}>
          <input
            style={s.input}
            placeholder="Buscar por nombre, matrícula, inmobiliaria..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select style={s.sel} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="habilitado">Habilitados</option>
            <option value="suspendido">Suspendidos</option>
          </select>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            {cargando ? 'Cargando…' : `${corredores.length} con ubicación · ${pendientes} sin geocodificar`}
          </span>
          {esAdmin && pendientes > 0 && (
            <button
              onClick={triggearGeocodificacion}
              disabled={geocodificando}
              style={{ background: 'rgba(204,0,0,0.15)', border: '1px solid rgba(204,0,0,0.3)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}
            >
              {geocodificando ? 'Geocodificando…' : `Geocodificar lote (${pendientes} pendientes)`}
            </button>
          )}
          {geoMsg && <span style={{ fontSize: 11, color: '#22c55e' }}>{geoMsg}</span>}
        </div>
      </div>

      <div style={s.mapWrap}>
        {!cargando && (
          <MapContainer center={ROSARIO} zoom={12} style={{ width: '100%', height: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {zonasFiltradas.length > 0 && <FitBounds zonas={zonasFiltradas} />}
            {zonasFiltradas.map(z => (
              <ZonaMarker key={z.localidad} zona={z} onSelect={setZonaSeleccionada} />
            ))}
          </MapContainer>
        )}
        {cargando && (
          <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Cargando mapa…
          </div>
        )}
      </div>

      <div style={s.panel}>
        {/* Lista de zonas */}
        <div>
          <div style={{ fontSize: 11, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            {zonasFiltradas.length} zona{zonasFiltradas.length !== 1 ? 's' : ''} con ubicación
          </div>
          {zonasFiltradas.slice(0, 20).map(z => (
            <div
              key={z.localidad}
              style={{ ...s.zonaCard, cursor: 'pointer', borderColor: zonaSeleccionada?.localidad === z.localidad ? 'rgba(204,0,0,0.4)' : 'rgba(255,255,255,0.07)' }}
              onClick={() => setZonaSeleccionada(zonaSeleccionada?.localidad === z.localidad ? null : z)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{z.localidad}</span>
                <span style={{ background: 'rgba(204,0,0,0.15)', border: '1px solid rgba(204,0,0,0.25)', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700, color: '#cc0000', fontFamily: 'Montserrat,sans-serif' }}>
                  {z.corredores.length}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                {z.corredores.filter(c => c.estado?.toLowerCase().includes('habilitado') || c.estado?.toLowerCase().includes('activo')).length} habilitados
              </div>
            </div>
          ))}
        </div>

        {/* Panel detalle zona */}
        {zonaSeleccionada && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: 15 }}>{zonaSeleccionada.localidad}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{zonaSeleccionada.corredores.length} corredores</div>
              </div>
              <button onClick={() => setZonaSeleccionada(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {zonaSeleccionada.corredores.map(c => (
                <div key={c.id} style={s.corrCard}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>
                      {c.apellido}, {c.nombre}
                      {c.matricula && <span style={{ marginLeft: 6, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Mat. {c.matricula}</span>}
                    </div>
                    {c.inmobiliaria && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{c.inmobiliaria}</div>}
                    {c.direccion && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>📍 {c.direccion}</div>}
                    {c.telefono && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>📞 {c.telefono}</div>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: c.estado?.toLowerCase().includes('habilitado') || c.estado?.toLowerCase().includes('activo')
                        ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                      color: c.estado?.toLowerCase().includes('habilitado') || c.estado?.toLowerCase().includes('activo')
                        ? '#22c55e' : 'rgba(255,255,255,0.3)',
                    }}>
                      {c.estado ?? 'Sin estado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
