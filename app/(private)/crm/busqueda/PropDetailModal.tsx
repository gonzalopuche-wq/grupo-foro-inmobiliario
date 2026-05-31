'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink, MapPin, BedDouble, Bath, Square, Home } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface PropDetail {
  id: string
  fuente: string
  titulo: string
  operacion: string
  tipo: string | null
  precio: number | null
  moneda: string | null
  barrio: string | null
  ciudad: string | null
  provincia: string | null
  direccion: string | null
  dormitorios: number | null
  banos: number | null
  superficie_cubierta: number | null
  descripcion: string | null
  imagenes: string[]
  url: string | null
  datos_raw: any
}

const FUENTE_LABEL: Record<string, string> = {
  gfi: 'Red GFI', zonaprop: 'ZonaProp', argenprop: 'Argenprop',
  mercadolibre: 'MercadoLibre', kiteprop: 'Kiteprop', tokko: 'Tokko', propia: 'Propia',
}
const FUENTE_COLOR: Record<string, string> = {
  gfi: '#cc0000', zonaprop: '#e60000', argenprop: '#f5a623',
  mercadolibre: '#ffe600', kiteprop: '#3b82f6', tokko: '#8b5cf6', propia: '#10b981',
}

interface Props {
  propId: string
  fuente: string
  onClose: () => void
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

  // Cerrar con Escape
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

  const precioStr = prop?.precio
    ? `${prop.moneda === 'ARS' ? '$' : 'U$D'} ${prop.precio.toLocaleString('es-AR')}`
    : null

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, width: '100%', maxWidth: 860, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
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
            <div style={{ height: 340, background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
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
                      <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                        {fotos.map((_, i) => (
                          <button key={i} onClick={() => setFotoIdx(i)}
                            style={{ width: i === fotoIdx ? 20 : 8, height: 8, borderRadius: 4, background: i === fotoIdx ? '#fff' : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }} />
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
            <div style={{ padding: '20px 24px' }}>
              {/* Título y precio */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'Montserrat,sans-serif', lineHeight: 1.3, flex: 1 }}>
                  {prop.titulo}
                </h2>
                {precioStr && (
                  <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' }}>
                    {precioStr}
                  </div>
                )}
              </div>

              {/* Ubicación */}
              {(prop.direccion || prop.barrio || prop.ciudad) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
                  <MapPin style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {[prop.direccion, prop.barrio, prop.ciudad, prop.provincia].filter(Boolean).join(', ')}
                </div>
              )}

              {/* Chips de características */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                {prop.operacion && (
                  <span style={{ padding: '5px 12px', borderRadius: 20, background: `${color}20`, border: `1px solid ${color}40`, color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {prop.operacion}
                  </span>
                )}
                {prop.tipo && (
                  <span style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600 }}>
                    {prop.tipo}
                  </span>
                )}
                {prop.dormitorios != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600 }}>
                    <BedDouble style={{ width: 13, height: 13 }} /> {prop.dormitorios} dorm.
                  </span>
                )}
                {prop.banos != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600 }}>
                    <Bath style={{ width: 13, height: 13 }} /> {prop.banos} baños
                  </span>
                )}
                {prop.superficie_cubierta != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600 }}>
                    <Square style={{ width: 13, height: 13 }} /> {prop.superficie_cubierta} m²
                  </span>
                )}
              </div>

              {/* Descripción */}
              {prop.descripcion && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Descripción
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                    {prop.descripcion}
                  </p>
                </div>
              )}

              {/* Botón portal externo o ficha GFI */}
              {prop.url && (
                <a
                  href={prop.url}
                  target={fuente === 'gfi' ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: color, color: fuente === 'mercadolibre' ? '#000' : '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', textDecoration: 'none' }}
                >
                  {fuente === 'gfi' ? 'Ver ficha completa en CRM' : `Ver en ${label}`}
                  {fuente !== 'gfi' && <ExternalLink style={{ width: 14, height: 14 }} />}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
