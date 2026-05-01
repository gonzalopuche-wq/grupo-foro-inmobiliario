'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'

interface Lista {
  id: string
  nombre: string
  descripcion?: string
  slug: string
  email_cliente?: string
  notificar_cliente: boolean
  created_at: string
  contacto?: { id: string; nombre: string; apellido: string; email?: string }
}

interface Propiedad {
  id: string
  url_original: string
  titulo?: string
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
  disponible: boolean
  orden?: number
  created_at: string
}

const fmtPrecio = (n?: number, m?: string) => {
  if (!n) return 'Sin precio'
  return `${m ?? 'USD'} ${n.toLocaleString('es-AR')}`
}

export default function ListaDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [lista, setLista] = useState<Lista | null>(null)
  const [propiedades, setPropiedades] = useState<Propiedad[]>([])
  const [cargando, setCargando] = useState(true)
  const [token, setToken] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  const mostrarToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)
      await cargar(session.access_token)
    }
    init()
  }, [id])

  const cargar = async (tok: string) => {
    setCargando(true)
    const [listaRes, propsRes] = await Promise.all([
      fetch(`/api/listas`, { headers: { Authorization: `Bearer ${tok}` } }),
      fetch(`/api/listas/${id}/propiedades`, { headers: { Authorization: `Bearer ${tok}` } }),
    ])
    const todasListas = await listaRes.json()
    const listaData = (todasListas || []).find((l: Lista) => l.id === id)
    if (!listaData) { router.push('/crm/listas'); return }
    setLista(listaData)
    const propsData = await propsRes.json()
    setPropiedades(propsData || [])
    setCargando(false)
  }

  const copiarLink = () => {
    if (!lista) return
    navigator.clipboard.writeText(`https://foroinmobiliario.com.ar/b/${lista.slug}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  const importarUrl = async () => {
    if (!urlInput.trim()) return
    setImportando(true)
    setImportError('')
    try {
      // Try to scrape via importar-url route
      const scrapeRes = await fetch('/api/cartera/importar-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const scraped = await scrapeRes.json()

      const body: Record<string, any> = {
        url_original: urlInput.trim(),
        titulo: scraped.titulo ?? urlInput.trim(),
        descripcion: scraped.descripcion ?? null,
        tipo: scraped.tipo ?? null,
        operacion: scraped.operacion ?? null,
        barrio: scraped.zona ?? null,
        ciudad: scraped.ciudad ?? null,
        precio_actual: scraped.precio ?? null,
        moneda: scraped.moneda ?? 'USD',
        superficie_total: scraped.superficie_total ?? scraped.superficie_cubierta ?? null,
        dormitorios: scraped.dormitorios ?? null,
        banos: scraped.banos ?? null,
        imagen_principal: scraped.fotos?.[0] ?? null,
        disponible: true,
      }

      const addRes = await fetch(`/api/listas/${id}/propiedades`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (addRes.status === 409) { setImportError('Esta propiedad ya está en la lista.'); setImportando(false); return }
      if (!addRes.ok) { setImportError('No se pudo agregar la propiedad.'); setImportando(false); return }
      const nueva = await addRes.json()
      setPropiedades(prev => [nueva, ...prev])
      setUrlInput('')
      setAgregando(false)
      mostrarToast('Propiedad agregada ✓')
    } catch {
      setImportError('Error al importar la URL.')
    }
    setImportando(false)
  }

  const eliminarPropiedad = async (propId: string) => {
    if (!confirm('¿Eliminar esta propiedad de la lista?')) return
    setEliminandoId(propId)
    const { error } = await supabase
      .from('crm_propiedades_guardadas')
      .delete()
      .eq('id', propId)
    if (!error) {
      setPropiedades(prev => prev.filter(p => p.id !== propId))
      mostrarToast('Eliminada ✓')
    }
    setEliminandoId(null)
  }

  const whatsappLink = () => {
    if (!lista) return '#'
    const url = `https://foroinmobiliario.com.ar/b/${lista.slug}`
    const nombre = lista.contacto ? lista.contacto.nombre : 'cliente'
    const msg = `Hola ${nombre}, te comparto las propiedades que seleccioné para vos: ${url}`
    return `https://wa.me/?text=${encodeURIComponent(msg)}`
  }

  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', color: '#fff', padding: 24, fontFamily: 'Inter,sans-serif' },
    header: { maxWidth: 900, marginBottom: 24 },
    breadcrumb: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 },
    titulo: { margin: 0, fontSize: 20, fontWeight: 800, fontFamily: 'Montserrat,sans-serif', color: '#fff' },
    subtitulo: { margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
    linkBar: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, maxWidth: 900 },
    linkText: { flex: 1, fontSize: 12, color: '#cc0000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    btnCopiar: { background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' },
    btnWa: { background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366', padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', textDecoration: 'none', whiteSpace: 'nowrap' },
    btnVista: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '5px 12px', borderRadius: 5, fontSize: 11, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' },
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden', maxWidth: 900, marginBottom: 12, display: 'flex', alignItems: 'stretch' },
    cardImg: { width: 140, flexShrink: 0, objectFit: 'cover' as const, background: 'rgba(255,255,255,0.04)' },
    cardImgPlaceholder: { width: 140, flexShrink: 0, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 },
    cardBody: { flex: 1, padding: '14px 18px', minWidth: 0 },
    cardTitulo: { fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    chip: { display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', marginRight: 5, marginBottom: 5 },
    cardAcciones: { display: 'flex', flexDirection: 'column' as const, gap: 6, padding: '14px 14px 14px 0', flexShrink: 0, justifyContent: 'center' },
    btnEliminar: { background: 'none', border: 'none', color: 'rgba(200,0,0,0.5)', fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: 5 },
    btnAgregar: { display: 'flex', alignItems: 'center', gap: 8, background: '#cc0000', border: 'none', color: '#fff', padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer', maxWidth: 900, marginBottom: 16 },
    importBox: { maxWidth: 900, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 },
    urlInput: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'Inter,sans-serif' },
    btnImportar: { background: '#cc0000', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' },
  }

  if (cargando) return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>Cargando lista…</span>
    </div>
  )

  if (!lista) return null

  const urlPublica = `https://foroinmobiliario.com.ar/b/${lista.slug}`

  return (
    <div style={s.page}>
      {/* Breadcrumb */}
      <div style={s.breadcrumb}>
        <Link href="/crm/listas" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Listas</Link>
        <span>/</span>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{lista.nombre}</span>
      </div>

      {/* Header */}
      <div style={s.header}>
        <h1 style={s.titulo}>🔖 {lista.nombre}</h1>
        {lista.descripcion && <p style={s.subtitulo}>{lista.descripcion}</p>}
        {lista.contacto && (
          <p style={{ ...s.subtitulo, marginTop: 4 }}>
            👤 {lista.contacto.nombre} {lista.contacto.apellido}
            {lista.contacto.email && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.2)' }}>{lista.contacto.email}</span>}
          </p>
        )}
      </div>

      {/* Link bar */}
      <div style={s.linkBar}>
        <span style={s.linkText}>{urlPublica}</span>
        <button style={s.btnCopiar} onClick={copiarLink}>
          {copiado ? '¡Copiado!' : 'Copiar link'}
        </button>
        <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={s.btnWa}>
          WhatsApp
        </a>
        <a href={urlPublica} target="_blank" rel="noopener noreferrer" style={s.btnVista}>
          Vista cliente ↗
        </a>
      </div>

      {/* Separador */}
      <div style={{ maxWidth: 900, borderTop: '1px solid rgba(255,255,255,0.06)', margin: '20px 0' }} />

      {/* Agregar propiedad */}
      {!agregando ? (
        <button style={s.btnAgregar} onClick={() => setAgregando(true)}>
          + Agregar propiedad
        </button>
      ) : (
        <div style={s.importBox}>
          <div style={{ fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Pegar URL de portal inmobiliario
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={s.urlInput}
              placeholder="https://www.zonaprop.com.ar/..."
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setImportError('') }}
              onKeyDown={e => e.key === 'Enter' && importarUrl()}
              autoFocus
            />
            <button style={s.btnImportar} onClick={importarUrl} disabled={importando}>
              {importando ? 'Importando…' : 'Agregar'}
            </button>
            <button
              onClick={() => { setAgregando(false); setUrlInput(''); setImportError('') }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}
            >
              ✕
            </button>
          </div>
          {importError && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f87171' }}>{importError}</p>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            Portales soportados: ZonaProp, Argenprop, MercadoLibre, Red Propia y otros
          </p>
        </div>
      )}

      {/* Lista de propiedades */}
      {propiedades.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.2)', maxWidth: 900, fontFamily: 'Inter,sans-serif', fontSize: 13, fontStyle: 'italic' }}>
          Esta lista no tiene propiedades todavía. Agregá una con el botón de arriba.
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', maxWidth: 900, marginBottom: 12 }}>
            {propiedades.length} propiedad{propiedades.length !== 1 ? 'es' : ''} en esta lista
          </div>
          {propiedades.map(prop => (
            <div key={prop.id} style={s.card}>
              {prop.imagen_principal ? (
                <img src={prop.imagen_principal} alt={prop.titulo ?? ''} style={s.cardImg} />
              ) : (
                <div style={s.cardImgPlaceholder}>🏠</div>
              )}
              <div style={s.cardBody}>
                <div style={s.cardTitulo}>{prop.titulo ?? prop.url_original}</div>
                <div style={{ marginBottom: 6 }}>
                  {prop.tipo && (
                    <span style={{ ...s.chip, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                      {prop.tipo}
                    </span>
                  )}
                  {prop.operacion && (
                    <span style={{ ...s.chip, background: prop.operacion === 'Venta' ? 'rgba(204,0,0,0.12)' : 'rgba(59,130,246,0.12)', border: `1px solid ${prop.operacion === 'Venta' ? 'rgba(204,0,0,0.3)' : 'rgba(59,130,246,0.3)'}`, color: prop.operacion === 'Venta' ? '#cc0000' : '#60a5fa' }}>
                      {prop.operacion}
                    </span>
                  )}
                  {!prop.disponible && (
                    <span style={{ ...s.chip, background: 'rgba(100,100,100,0.12)', border: '1px solid rgba(100,100,100,0.3)', color: '#888' }}>
                      No disponible
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  <span style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, color: '#22c55e', fontSize: 14 }}>
                    {fmtPrecio(prop.precio_actual, prop.moneda)}
                  </span>
                  {(prop.barrio || prop.ciudad) && <span>📍 {[prop.barrio, prop.ciudad].filter(Boolean).join(', ')}</span>}
                  {prop.superficie_total && <span>📐 {prop.superficie_total} m²</span>}
                  {prop.dormitorios && <span>🛏 {prop.dormitorios} dorm.</span>}
                  {prop.banos && <span>🚿 {prop.banos} baños</span>}
                </div>
              </div>
              <div style={s.cardAcciones}>
                <a href={prop.url_original} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', padding: '4px 10px', textAlign: 'center' }}>
                  Ver ↗
                </a>
                <button
                  onClick={() => eliminarPropiedad(prop.id)}
                  disabled={eliminandoId === prop.id}
                  style={s.btnEliminar}
                >
                  {eliminandoId === prop.id ? '…' : 'Quitar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, padding: '12px 20px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#22c55e', fontFamily: 'Montserrat,sans-serif', fontSize: 12, fontWeight: 700, zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
