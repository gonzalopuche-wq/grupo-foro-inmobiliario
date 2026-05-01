'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface Contacto { id: string; nombre: string; apellido: string | null; dni: string | null; domicilio?: string | null }
interface Propiedad { id: string; titulo: string; tipo: string; direccion: string | null; zona: string | null; ciudad: string | null; superficie_cubierta: number | null; descripcion: string | null }

type TipoContrato = 'compraventa' | 'alquiler' | 'autorización' | 'reserva' | 'cesion' | 'mandato'

const TIPOS: { key: TipoContrato; label: string; icon: string }[] = [
  { key: 'compraventa',  label: 'Boleto de Compraventa', icon: '🏠' },
  { key: 'alquiler',     label: 'Contrato de Locación',  icon: '🔑' },
  { key: 'autorización', label: 'Autorización de Venta', icon: '✍️' },
  { key: 'reserva',      label: 'Seña y Reserva',        icon: '💰' },
  { key: 'cesion',       label: 'Cesión de Derechos',    icon: '📋' },
  { key: 'mandato',      label: 'Mandato Inmobiliario',   icon: '🤝' },
]

const FORMAS_PAGO = ['Contado en efectivo', 'Transferencia bancaria', 'Cheque certificado', 'Cuotas', 'Permuta parcial']

export default function ContratosPage() {
  const [userId, setUserId] = useState('')
  const [perfil, setPerfil] = useState<any>(null)
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [propiedades, setPropiedades] = useState<Propiedad[]>([])

  // Formulario
  const [tipo, setTipo] = useState<TipoContrato>('compraventa')
  const [vendedorId, setVendedorId] = useState('')
  const [compradorId, setCompradorId] = useState('')
  const [propId, setPropId] = useState('')
  const [precio, setPrecio] = useState('')
  const [moneda, setMoneda] = useState('USD')
  const [formaPago, setFormaPago] = useState(FORMAS_PAGO[0])
  const [plazo, setPlazo] = useState('')
  const [clausulasExtra, setClausulasExtra] = useState('')

  // Resultado
  const [contrato, setContrato] = useState('')
  const [generando, setGenerando] = useState(false)
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const contratoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)

      const [{ data: p }, { data: c }, { data: props }] = await Promise.all([
        supabase.from('perfiles').select('nombre, apellido, matricula').eq('id', data.user.id).single(),
        supabase.from('crm_contactos').select('id, nombre, apellido, dni:notas').eq('perfil_id', data.user.id).order('nombre').limit(200),
        supabase.from('cartera_propiedades').select('id, titulo, tipo, direccion, zona, ciudad, superficie_cubierta, descripcion').eq('perfil_id', data.user.id).eq('estado', 'activa').limit(100),
      ])
      setPerfil(p)
      setContactos((c as unknown as Contacto[]) ?? [])
      setPropiedades((props as unknown as Propiedad[]) ?? [])
    })
  }, [])

  const generar = async () => {
    setGenerando(true)
    setContrato('')
    setPaso(3)

    const vendedor = contactos.find(c => c.id === vendedorId)
    const comprador = contactos.find(c => c.id === compradorId)
    const prop = propiedades.find(p => p.id === propId)

    try {
      const res = await fetch('/api/ia-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          partes: {
            vendedor: vendedor ? { nombre: `${vendedor.nombre} ${vendedor.apellido ?? ''}`.trim(), dni: vendedor.dni } : null,
            comprador: comprador ? { nombre: `${comprador.nombre} ${comprador.apellido ?? ''}`.trim(), dni: comprador.dni } : null,
            corredor: perfil ? { nombre: `${perfil.nombre} ${perfil.apellido}`, matricula: perfil.matricula } : null,
          },
          propiedad: prop ?? null,
          condiciones: {
            precio: precio ? parseFloat(precio.replace(/\D/g, '')) : null,
            moneda,
            forma_pago: formaPago,
            plazo: plazo || null,
            honorarios: null,
          },
          clausulas_extra: clausulasExtra || null,
        }),
      })
      const { contrato: texto, error } = await res.json()
      if (error) setContrato(`Error: ${error}`)
      else setContrato(texto)
    } catch {
      setContrato('Error al generar el contrato. Intentá de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  const imprimir = () => window.print()

  const copiar = () => {
    navigator.clipboard.writeText(contrato)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 0 64px' }}>
      <style>{`
        @media print {
          .contratos-no-print { display: none !important; }
          .contrato-texto { background: #fff !important; color: #000 !important; border: none !important; padding: 40px !important; font-size: 13px !important; }
        }
        .cont-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #fff; padding: 10px 12px; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .cont-input:focus { outline: none; border-color: rgba(204,0,0,0.4); }
        .cont-select { width: 100%; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #fff; padding: 10px 12px; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .cont-label { font-size: 11px; color: rgba(255,255,255,0.4); font-family: Montserrat,sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 6px; }
        .cont-field { margin-bottom: 16px; }
        .cont-row { display: flex; gap: 12px; }
        .cont-row .cont-field { flex: 1; }
      `}</style>

      {/* Header */}
      <div className="contratos-no-print" style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulo 136 — LegalTech</div>
        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Generador de Contratos</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Generá contratos inmobiliarios profesionales con IA en segundos</p>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Panel izquierdo: formulario */}
        <div className="contratos-no-print" style={{ flex: '0 0 340px', minWidth: 280 }}>

          {/* Paso 1: Tipo */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>1 — Tipo de contrato</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TIPOS.map(t => (
                <button key={t.key} onClick={() => setTipo(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', background: tipo === t.key ? 'rgba(204,0,0,0.12)' : 'rgba(255,255,255,0.03)', outline: tipo === t.key ? '1px solid rgba(204,0,0,0.3)' : 'none' }}>
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: tipo === t.key ? 600 : 400, color: tipo === t.key ? '#fff' : 'rgba(255,255,255,0.5)' }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Paso 2: Datos */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 14 }}>2 — Datos del contrato</div>

            <div className="cont-field">
              <label className="cont-label">Vendedor / Locador</label>
              <select className="cont-select" value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                <option value="">— Seleccionar del CRM —</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido ?? ''}</option>)}
              </select>
            </div>

            <div className="cont-field">
              <label className="cont-label">{tipo === 'alquiler' ? 'Inquilino / Locatario' : 'Comprador'}</label>
              <select className="cont-select" value={compradorId} onChange={e => setCompradorId(e.target.value)}>
                <option value="">— Seleccionar del CRM —</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido ?? ''}</option>)}
              </select>
            </div>

            <div className="cont-field">
              <label className="cont-label">Propiedad (de mi cartera)</label>
              <select className="cont-select" value={propId} onChange={e => setPropId(e.target.value)}>
                <option value="">— Seleccionar propiedad —</option>
                {propiedades.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>

            <div className="cont-row">
              <div className="cont-field">
                <label className="cont-label">Precio / Monto</label>
                <input className="cont-input" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Ej: 120000" type="text" />
              </div>
              <div className="cont-field" style={{ flex: '0 0 90px' }}>
                <label className="cont-label">Moneda</label>
                <select className="cont-select" value={moneda} onChange={e => setMoneda(e.target.value)}>
                  <option>USD</option><option>ARS</option><option>EUR</option>
                </select>
              </div>
            </div>

            <div className="cont-field">
              <label className="cont-label">Forma de pago</label>
              <select className="cont-select" value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>

            {tipo === 'alquiler' && (
              <div className="cont-field">
                <label className="cont-label">Plazo del contrato</label>
                <input className="cont-input" value={plazo} onChange={e => setPlazo(e.target.value)} placeholder="Ej: 2 años" />
              </div>
            )}

            <div className="cont-field">
              <label className="cont-label">Cláusulas adicionales (opcional)</label>
              <textarea value={clausulasExtra} onChange={e => setClausulasExtra(e.target.value)} placeholder="Ej: El inmueble se entrega con todos los artefactos incluidos..." rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            <button onClick={generar} disabled={generando} style={{ width: '100%', padding: '12px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: generando ? 0.6 : 1 }}>
              {generando ? '⏳ Generando contrato...' : '✨ Generar contrato con IA'}
            </button>
          </div>
        </div>

        {/* Panel derecho: resultado */}
        <div style={{ flex: 1, minWidth: 300 }}>
          {!contrato && !generando && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, padding: '56px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Completá el formulario y generá el contrato</div>
              <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12, marginTop: 8 }}>El texto generado es un borrador profesional. Revisalo con tu asesor legal antes de firmar.</div>
            </div>
          )}

          {generando && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '56px 32px', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(204,0,0,0.2)', borderTopColor: '#cc0000', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Redactando contrato con IA...</div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8 }}>Usando Claude Sonnet — puede tardar 15-30 segundos</div>
            </div>
          )}

          {contrato && !generando && (
            <div>
              <div className="contratos-no-print" style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
                <button onClick={copiar} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, cursor: 'pointer' }}>
                  📋 Copiar
                </button>
                <button onClick={imprimir} style={{ padding: '8px 16px', background: '#cc0000', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: 'pointer' }}>
                  🖨 Imprimir / PDF
                </button>
                <button onClick={generar} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, cursor: 'pointer' }}>
                  🔄 Regenerar
                </button>
              </div>
              <div className="contrato-texto" ref={contratoRef} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '32px', fontFamily: "'Georgia', serif", fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {contrato}
              </div>
              <div className="contratos-no-print" style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 11, color: 'rgba(245,158,11,0.7)' }}>
                ⚠️ Este contrato es un borrador generado por IA. Revisá todos los datos y consultá con tu asesor legal antes de firmar. Los campos entre [CORCHETES] requieren completarse.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
