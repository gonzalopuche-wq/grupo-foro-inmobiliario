'use client'

import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink, MapPin, BedDouble, Bath, Square, Home, Phone, Mail, Play, Globe } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface PropDetail {
  id: string
  fuente: string
  titulo: string
  operacion: string
  tipo: string | null
  precio: number | null
  precio_anterior: number | null
  moneda: string | null
  barrio: string | null
  ciudad: string | null
  provincia: string | null
  direccion: string | null
  dormitorios: number | null
  banos: number | null
  ambientes: number | null
  superficie_cubierta: number | null
  sup_terreno: number | null
  sup_semicubierta: number | null
  sup_descubierta: number | null
  expensas: number | null
  orientacion: string | null
  piso: number | string | null
  cocheras: number | null
  baulera: boolean
  antiguedad: string | null
  amoblado: boolean
  acepta_mascotas: boolean
  apto_credito: boolean
  com_pileta: boolean
  com_gimnasio: boolean
  com_sum: boolean
  com_ascensor: boolean
  com_seguridad: boolean
  com_parrilla: boolean
  com_quincho: boolean
  com_solarium: boolean
  com_laundry: boolean
  com_cowork: boolean
  com_juegos_ninos: boolean
  amb_balcon: boolean
  amb_terraza: boolean
  amb_jardin: boolean
  amb_patio: boolean
  video_url: string | null
  tour_virtual_url: string | null
  agente_nombre: string | null
  agente_telefono: string | null
  agente_email: string | null
  descripcion: string | null
  imagenes: string[]
  url: string | null
}

const FUENTE_LABEL: Record<string, string> = {
  gfi: 'Red GFI', zonaprop: 'ZonaProp', argenprop: 'Argenprop',
  mercadolibre: 'MercadoLibre', kiteprop: 'Kiteprop', tokko: 'Tokko',
  propia: 'Propia', propia_red: 'Propia Red', gfi_red: 'Red GFI', gfi_portal: 'Portal GFI',
}
const FUENTE_COLOR: Record<string, string> = {
  gfi: '#cc0000', gfi_red: '#cc0000', gfi_portal: '#cc0000',
  zonaprop: '#e60000', argenprop: '#f5a623',
  mercadolibre: '#ffe600', kiteprop: '#3b82f6', tokko: '#8b5cf6',
  propia: '#10b981', propia_red: '#10b981',
}

interface Props {
  propId: string
  fuente: string
  onClose: () => void
}

function Chip({ label, icon }: { label: string; icon?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>
      {icon && <span>{icon}</span>}{label}
    </span>
  )
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10, marginTop: 20 }}>
      {label}
    </div>
  )
}

export default function PropDetailModal({ propId, fuente, onClose }: Props) {
  const [prop, setProp] = useState<PropDetail | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fotoIdx, setFotoIdx] = useState(0)
  const [imgError, setImgError] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      setCargando(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const res = await fetch(`/api/propiedades/mercado/${propId}?fuente=${fuente}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok || cancelled) { setCargando(false); return }
      const data = await res.json()
      if (!cancelled) { setProp(data); setCargando(false) }
    }
    load()
    return () => { cancelled = true }
  }, [propId, fuente])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && prop?.imagenes.length) setFotoIdx(i => (i + 1) % prop.imagenes.length)
      if (e.key === 'ArrowLeft' && prop?.imagenes.length) setFotoIdx(i => (i - 1 + prop.imagenes.length) % prop.imagenes.length)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, prop])

  const color = FUENTE_COLOR[fuente] ?? '#cc0000'
  const label = FUENTE_LABEL[fuente] ?? fuente
  const fotos = prop?.imagenes?.filter((_, i) => !imgError.has(i)) ?? []

  const fmtPrecio = (p: number | null, m: string | null) =>
    p ? `${m === 'ARS' ? '$' : 'U$D'} ${p.toLocaleString('es-AR')}` : null

  const precioStr = fmtPrecio(prop?.precio ?? null, prop?.moneda ?? null)
  const precioAntStr = fmtPrecio(prop?.precio_anterior ?? null, prop?.moneda ?? null)

  // Amenities: solo los que son true
  const amenitiesEdificio = prop ? [
    prop.com_pileta && { k: 'Pileta', i: '🏊' },
    prop.com_gimnasio && { k: 'Gimnasio', i: '🏋️' },
    prop.com_sum && { k: 'SUM', i: '🎉' },
    prop.com_ascensor && { k: 'Ascensor', i: '🛗' },
    prop.com_seguridad && { k: 'Seguridad 24h', i: '🔒' },
    prop.com_parrilla && { k: 'Parrilla', i: '🔥' },
    prop.com_quincho && { k: 'Quincho', i: '🏠' },
    prop.com_solarium && { k: 'Solarium', i: '☀️' },
    prop.com_laundry && { k: 'Lavandería', i: '👕' },
    prop.com_cowork && { k: 'Coworking', i: '💻' },
    prop.com_juegos_ninos && { k: 'Juegos infantiles', i: '🎠' },
  ].filter(Boolean) as { k: string; i: string }[] : []

  const ambientes = prop ? [
    prop.amb_balcon && { k: 'Balcón', i: '🌅' },
    prop.amb_terraza && { k: 'Terraza', i: '🌿' },
    prop.amb_jardin && { k: 'Jardín', i: '🌳' },
    prop.amb_patio && { k: 'Patio', i: '🌻' },
  ].filter(Boolean) as { k: string; i: string }[] : []

  const condiciones = prop ? [
    prop.apto_credito && { k: 'Apto crédito', i: '🏦' },
    prop.amoblado && { k: 'Amoblado', i: '🛋️' },
    prop.acepta_mascotas && { k: 'Permite mascotas', i: '🐾' },
  ].filter(Boolean) as { k: string; i: string }[] : []

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, width: '100%', maxWidth: 920, maxHeight: '94vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: color, color: fuente === 'mercadolibre' ? '#000' : '#fff', fontFamily: 'Montserrat,sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {label}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {cargando ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Cargando...
          </div>
        ) : !prop ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            No se pudo cargar la propiedad.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* Carrusel de fotos */}
            <div style={{ height: 320, background: '#0a0a0a', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              {fotos.length > 0 ? (
                <>
                  <img
                    key={fotoIdx}
                    src={fotos[fotoIdx]}
                    alt={prop.titulo}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setImgError(prev => new Set([...prev, fotoIdx]))}
                  />
                  {fotos.length > 1 && (
                    <>
                      <button onClick={() => setFotoIdx(i => (i - 1 + fotos.length) % fotos.length)}
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <ChevronLeft style={{ width: 20, height: 20 }} />
                      </button>
                      <button onClick={() => setFotoIdx(i => (i + 1) % fotos.length)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <ChevronRight style={{ width: 20, height: 20 }} />
                      </button>
                      <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, maxWidth: '80%', overflow: 'hidden' }}>
                        {fotos.slice(0, 20).map((_, i) => (
                          <button key={i} onClick={() => setFotoIdx(i)}
                            style={{ width: i === fotoIdx ? 20 : 7, height: 7, borderRadius: 4, background: i === fotoIdx ? '#fff' : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0, flexShrink: 0 }} />
                        ))}
                      </div>
                      <div style={{ position: 'absolute', bottom: 12, right: 16, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                        {fotoIdx + 1} / {fotos.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 48, color: 'rgba(255,255,255,0.06)' }}>
                  <Home style={{ width: 64, height: 64 }} />
                </div>
              )}
            </div>

            {/* Contenido */}
            <div style={{ padding: '20px 24px 28px' }}>

              {/* Precio y título */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 6, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'Montserrat,sans-serif', lineHeight: 1.3, flex: 1 }}>
                  {prop.titulo}
                </h2>
                <div style={{ textAlign: 'right' }}>
                  {precioStr && (
                    <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' }}>
                      {precioStr}
                    </div>
                  )}
                  {precioAntStr && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through', fontFamily: 'Montserrat,sans-serif' }}>
                      {precioAntStr}
                    </div>
                  )}
                  {prop.expensas && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter,sans-serif' }}>
                      + exp. $ {prop.expensas.toLocaleString('es-AR')}
                    </div>
                  )}
                </div>
              </div>

              {/* Ubicación */}
              {(prop.direccion || prop.barrio || prop.ciudad) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
                  <MapPin style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {[prop.direccion, prop.barrio, prop.ciudad, prop.provincia].filter(Boolean).join(', ')}
                </div>
              )}

              {/* Chips principales */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {prop.operacion && (
                  <span style={{ padding: '5px 12px', borderRadius: 20, background: `${color}20`, border: `1px solid ${color}40`, color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {prop.operacion === 'alquiler_temporal' ? 'Alq. temporal' : prop.operacion}
                  </span>
                )}
                {prop.tipo && <Chip label={prop.tipo} />}
                {prop.dormitorios != null && <Chip label={`${prop.dormitorios} dorm.`} icon="🛏️" />}
                {prop.ambientes != null && <Chip label={`${prop.ambientes} amb.`} icon="🏠" />}
                {prop.banos != null && <Chip label={`${prop.banos} baños`} icon="🚿" />}
              </div>

              {/* Superficies */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {prop.superficie_cubierta != null && (
                  <Chip label={`${prop.superficie_cubierta} m² cubiertos`} icon="📐" />
                )}
                {prop.sup_semicubierta != null && (
                  <Chip label={`${prop.sup_semicubierta} m² semicub.`} icon="⬜" />
                )}
                {prop.sup_descubierta != null && (
                  <Chip label={`${prop.sup_descubierta} m² desc.`} icon="🌿" />
                )}
                {prop.sup_terreno != null && (
                  <Chip label={`${prop.sup_terreno} m² terreno`} icon="📏" />
                )}
              </div>

              {/* Detalles físicos */}
              {(prop.orientacion || prop.piso != null || prop.cocheras != null || prop.baulera || prop.antiguedad) && (
                <>
                  <SectionTitle label="Detalles" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 4 }}>
                    {prop.orientacion && (
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Orientación</div>
                        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>🧭 {prop.orientacion}</div>
                      </div>
                    )}
                    {prop.piso != null && (
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Piso</div>
                        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>🏢 {prop.piso}</div>
                      </div>
                    )}
                    {prop.cocheras != null && prop.cocheras > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Cocheras</div>
                        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>🚗 {prop.cocheras}</div>
                      </div>
                    )}
                    {prop.baulera && (
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Baulera</div>
                        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>📦 Sí</div>
                      </div>
                    )}
                    {prop.antiguedad && (
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Antigüedad</div>
                        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>🏛️ {prop.antiguedad}</div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Condiciones */}
              {condiciones.length > 0 && (
                <>
                  <SectionTitle label="Condiciones" />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {condiciones.map(c => <Chip key={c.k} label={c.k} icon={c.i} />)}
                  </div>
                </>
              )}

              {/* Ambientes propios */}
              {ambientes.length > 0 && (
                <>
                  <SectionTitle label="Ambientes" />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ambientes.map(a => <Chip key={a.k} label={a.k} icon={a.i} />)}
                  </div>
                </>
              )}

              {/* Amenities del edificio */}
              {amenitiesEdificio.length > 0 && (
                <>
                  <SectionTitle label="Amenities del edificio" />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {amenitiesEdificio.map(a => <Chip key={a.k} label={a.k} icon={a.i} />)}
                  </div>
                </>
              )}

              {/* Descripción */}
              {prop.descripcion && (
                <>
                  <SectionTitle label="Descripción" />
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
                    {prop.descripcion}
                  </p>
                </>
              )}

              {/* Video */}
              {prop.video_url && (
                <>
                  <SectionTitle label="Video" />
                  <a href={prop.video_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    <Play style={{ width: 14, height: 14 }} /> Ver video
                  </a>
                </>
              )}

              {/* Tour virtual */}
              {prop.tour_virtual_url && (
                <>
                  <SectionTitle label="Tour virtual" />
                  <a href={prop.tour_virtual_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#818cf8', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    <Globe style={{ width: 14, height: 14 }} /> Recorrido 360°
                  </a>
                </>
              )}

              {/* Agente */}
              {(prop.agente_nombre || prop.agente_telefono || prop.agente_email) && (
                <>
                  <SectionTitle label="Contacto del corredor" />
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {prop.agente_nombre && (
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'Montserrat,sans-serif' }}>
                        👤 {prop.agente_nombre}
                      </div>
                    )}
                    {prop.agente_telefono && (
                      <a href={`tel:${prop.agente_telefono}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
                        <Phone style={{ width: 14, height: 14 }} /> {prop.agente_telefono}
                      </a>
                    )}
                    {prop.agente_email && (
                      <a href={`mailto:${prop.agente_email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#60a5fa', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
                        <Mail style={{ width: 14, height: 14 }} /> {prop.agente_email}
                      </a>
                    )}
                  </div>
                </>
              )}

              {/* CTA */}
              <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {prop.url && (
                  <a
                    href={prop.url}
                    target={fuente === 'gfi' ? '_self' : '_blank'}
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: color, color: fuente === 'mercadolibre' ? '#000' : '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', textDecoration: 'none' }}
                  >
                    {fuente === 'gfi' ? 'Ver ficha completa en CRM' : `Ver en ${label}`}
                    {fuente !== 'gfi' && <ExternalLink style={{ width: 14, height: 14 }} />}
                  </a>
                )}
                {prop.agente_telefono && (
                  <a
                    href={`https://wa.me/${prop.agente_telefono.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#25d366', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', textDecoration: 'none' }}
                  >
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
