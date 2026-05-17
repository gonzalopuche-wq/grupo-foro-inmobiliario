'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface Contacto {
  id: string
  nombre: string
  apellido: string | null
  dni: string | null
  domicilio: string | null
}
interface Propiedad {
  id: string
  titulo: string
  tipo: string
  direccion: string | null
  zona: string | null
  ciudad: string | null
  superficie_cubierta: number | null
  descripcion: string | null
}
interface Plantilla {
  id: string
  nombre: string
  tipo: string
  contenido: string
  created_at: string
}

type TipoContrato = 'compraventa' | 'alquiler' | 'autorización' | 'reserva' | 'cesion' | 'mandato'
type MainTab = 'ia' | 'plantillas'
type PlantillaTab = 'lista' | 'nueva'

const TIPOS: { key: TipoContrato; label: string; icon: string }[] = [
  { key: 'compraventa',  label: 'Boleto de Compraventa', icon: '🏠' },
  { key: 'alquiler',     label: 'Contrato de Locación',  icon: '🔑' },
  { key: 'autorización', label: 'Autorización de Venta', icon: '✍️' },
  { key: 'reserva',      label: 'Seña y Reserva',        icon: '💰' },
  { key: 'cesion',       label: 'Cesión de Derechos',    icon: '📋' },
  { key: 'mandato',      label: 'Mandato Inmobiliario',  icon: '🤝' },
]

const FORMAS_PAGO = [
  'Contado en efectivo',
  'Transferencia bancaria',
  'Cheque certificado',
  'Cuotas',
  'Permuta parcial',
]

const GARANTIAS = [
  'Sin garantía',
  'Propietario garante',
  'Seguro de caución',
  'Depósito en garantía',
  'Aval bancario',
]

const VARIABLES_REF = [
  '{{FECHA_HOY}}',
  '{{VENDEDOR_NOMBRE}}', '{{VENDEDOR_DNI}}', '{{VENDEDOR_DOMICILIO}}',
  '{{COMPRADOR_NOMBRE}}', '{{COMPRADOR_DNI}}', '{{COMPRADOR_DOMICILIO}}',
  '{{PROPIEDAD_TITULO}}', '{{PROPIEDAD_TIPO}}', '{{PROPIEDAD_DIRECCION}}',
  '{{PROPIEDAD_CIUDAD}}', '{{PROPIEDAD_SUPERFICIE}}',
  '{{PRECIO}}', '{{MONEDA}}', '{{FORMA_PAGO}}', '{{PLAZO}}',
  '{{CORREDOR_NOMBRE}}', '{{CORREDOR_MATRICULA}}',
  '{{HONORARIOS_PCT}}', '{{HONORARIOS_MONTO}}',
  '{{SEÑA_MONTO}}', '{{FECHA_ENTREGA}}', '{{GARANTIA_TIPO}}', '{{EXPENSAS}}',
]

export default function ContratosPage() {
  const [userId, setUserId]       = useState('')
  const [perfil, setPerfil]       = useState<any>(null)
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [propiedades, setPropiedades] = useState<Propiedad[]>([])

  // Pestaña principal
  const [tab, setTab] = useState<MainTab>('ia')

  // Campos compartidos (IA + plantillas)
  const [tipo, setTipo]               = useState<TipoContrato>('compraventa')
  const [vendedorId, setVendedorId]   = useState('')
  const [compradorId, setCompradorId] = useState('')
  const [propId, setPropId]           = useState('')
  const [precio, setPrecio]           = useState('')
  const [moneda, setMoneda]           = useState('USD')
  const [formaPago, setFormaPago]     = useState(FORMAS_PAGO[0])
  const [plazo, setPlazo]             = useState('')
  const [honorariosPct, setHonorariosPct] = useState('3')
  const [señaMonto, setSeñaMonto]     = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [garantiaTipo, setGarantiaTipo] = useState(GARANTIAS[0])
  const [expensasIncluidas, setExpensasIncluidas] = useState(false)
  const [clausulasExtra, setClausulasExtra] = useState('')

  // Resultado IA
  const [contrato, setContrato]   = useState('')
  const [generando, setGenerando] = useState(false)
  const contratoRef = useRef<HTMLDivElement>(null)

  // Plantillas
  const [plantillas, setPlantillas]       = useState<Plantilla[]>([])
  const [plantillaTab, setPlantillaTab]   = useState<PlantillaTab>('lista')
  const [plantillaNombre, setPlantillaNombre] = useState('')
  const [plantillaTipoSel, setPlantillaTipoSel] = useState('general')
  const [plantillaContenido, setPlantillaContenido] = useState('')
  const [plantillaSelId, setPlantillaSelId] = useState('')
  const [plantillaPreview, setPlantillaPreview] = useState('')
  const [guardando, setGuardando]         = useState(false)
  const [plantillaMsg, setPlantillaMsg]   = useState('')
  const [analizando, setAnalizando]       = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const uid = data.user.id
      setUserId(uid)

      const [{ data: p }, { data: c }, { data: props }, { data: plantas }] = await Promise.all([
        supabase.from('perfiles').select('nombre, apellido, matricula').eq('id', uid).single(),
        supabase.from('crm_contactos').select('id, nombre, apellido, dni, domicilio').eq('perfil_id', uid).order('nombre').limit(200),
        supabase.from('cartera_propiedades').select('id, titulo, tipo, direccion, zona, ciudad, superficie_cubierta, descripcion').eq('perfil_id', uid).eq('estado', 'activa').limit(100),
        supabase.from('contratos_plantillas').select('*').eq('perfil_id', uid).order('created_at', { ascending: false }),
      ])
      setPerfil(p)
      setContactos((c as unknown as Contacto[]) ?? [])
      setPropiedades((props as unknown as Propiedad[]) ?? [])
      setPlantillas((plantas as unknown as Plantilla[]) ?? [])
    })
  }, [])

  const precioNum = parseFloat(precio.replace(/[^\d.]/g, '')) || 0
  const honorariosMonto = precioNum > 0 && honorariosPct
    ? Math.round(precioNum * parseFloat(honorariosPct) / 100)
    : 0

  const fmt = (n: number) => new Intl.NumberFormat('es-AR').format(n)

  const buildVariables = (): Record<string, string> => {
    const vendedor  = contactos.find(c => c.id === vendedorId)
    const comprador = contactos.find(c => c.id === compradorId)
    const prop      = propiedades.find(p => p.id === propId)
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const fechaEntregaFmt = fechaEntrega
      ? new Date(fechaEntrega + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
      : ''

    return {
      '{{FECHA_HOY}}':           hoy,
      '{{VENDEDOR_NOMBRE}}':     vendedor  ? `${vendedor.nombre} ${vendedor.apellido ?? ''}`.trim() : '',
      '{{VENDEDOR_DNI}}':        vendedor?.dni      ?? '',
      '{{VENDEDOR_DOMICILIO}}':  vendedor?.domicilio ?? '',
      '{{COMPRADOR_NOMBRE}}':    comprador ? `${comprador.nombre} ${comprador.apellido ?? ''}`.trim() : '',
      '{{COMPRADOR_DNI}}':       comprador?.dni      ?? '',
      '{{COMPRADOR_DOMICILIO}}': comprador?.domicilio ?? '',
      '{{PROPIEDAD_TITULO}}':    prop?.titulo ?? '',
      '{{PROPIEDAD_TIPO}}':      prop?.tipo   ?? '',
      '{{PROPIEDAD_DIRECCION}}': prop?.direccion ?? '',
      '{{PROPIEDAD_CIUDAD}}':    [prop?.zona, prop?.ciudad].filter(Boolean).join(', '),
      '{{PROPIEDAD_SUPERFICIE}}': prop?.superficie_cubierta ? `${prop.superficie_cubierta} m²` : '',
      '{{PRECIO}}':              precioNum ? fmt(precioNum) : '',
      '{{MONEDA}}':              moneda,
      '{{FORMA_PAGO}}':          formaPago,
      '{{PLAZO}}':               plazo,
      '{{CORREDOR_NOMBRE}}':     perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : '',
      '{{CORREDOR_MATRICULA}}':  perfil?.matricula ?? '',
      '{{HONORARIOS_PCT}}':      honorariosPct ? `${honorariosPct}%` : '',
      '{{HONORARIOS_MONTO}}':    honorariosMonto ? `${moneda} ${fmt(honorariosMonto)}` : '',
      '{{SEÑA_MONTO}}':          señaMonto ? `${moneda} ${fmt(parseFloat(señaMonto.replace(/[^\d.]/g, '')) || 0)}` : '',
      '{{FECHA_ENTREGA}}':       fechaEntregaFmt,
      '{{GARANTIA_TIPO}}':       garantiaTipo,
      '{{EXPENSAS}}':            expensasIncluidas ? 'Expensas incluidas en el precio acordado' : 'Expensas a cargo del comprador/locatario',
    }
  }

  const fillTemplate = (contenido: string) => {
    const vars = buildVariables()
    let out = contenido
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(k).join(v || `[${k.replace(/\{\{|\}\}/g, '')}]`)
    }
    return out
  }

  const generar = async () => {
    setGenerando(true)
    setContrato('')
    const vendedor  = contactos.find(c => c.id === vendedorId)
    const comprador = contactos.find(c => c.id === compradorId)
    const prop      = propiedades.find(p => p.id === propId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ia-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          tipo,
          partes: {
            vendedor:  vendedor  ? { nombre: `${vendedor.nombre} ${vendedor.apellido ?? ''}`.trim(), dni: vendedor.dni, domicilio: vendedor.domicilio } : null,
            comprador: comprador ? { nombre: `${comprador.nombre} ${comprador.apellido ?? ''}`.trim(), dni: comprador.dni, domicilio: comprador.domicilio } : null,
            corredor:  perfil   ? { nombre: `${perfil.nombre} ${perfil.apellido}`.trim(), matricula: perfil.matricula } : null,
          },
          propiedad: prop ?? null,
          condiciones: {
            precio:             precioNum || null,
            moneda,
            forma_pago:         formaPago,
            plazo:              plazo || null,
            honorarios_pct:     honorariosPct ? parseFloat(honorariosPct) : null,
            honorarios_monto:   honorariosMonto || null,
            seña_monto:         señaMonto ? parseFloat(señaMonto.replace(/[^\d.]/g, '')) || null : null,
            fecha_entrega:      fechaEntrega || null,
            garantia_tipo:      garantiaTipo !== GARANTIAS[0] ? garantiaTipo : null,
            expensas_incluidas: expensasIncluidas,
          },
          clausulas_extra: clausulasExtra || null,
        }),
      })
      const { contrato: texto, error } = await res.json()
      setContrato(error ? `Error: ${error}` : texto)
    } catch {
      setContrato('Error al generar el contrato. Intentá de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  const guardarPlantilla = async () => {
    if (!plantillaNombre.trim() || !plantillaContenido.trim()) return
    setGuardando(true)
    const { error } = await supabase.from('contratos_plantillas').insert({
      perfil_id: userId,
      nombre:    plantillaNombre.trim(),
      tipo:      plantillaTipoSel,
      contenido: plantillaContenido.trim(),
    })
    if (error) {
      setPlantillaMsg('Error al guardar. Intentá de nuevo.')
    } else {
      const { data } = await supabase.from('contratos_plantillas').select('*').eq('perfil_id', userId).order('created_at', { ascending: false })
      setPlantillas((data as unknown as Plantilla[]) ?? [])
      setPlantillaNombre('')
      setPlantillaContenido('')
      setPlantillaTab('lista')
      setPlantillaMsg('✅ Plantilla guardada')
      setTimeout(() => setPlantillaMsg(''), 3000)
    }
    setGuardando(false)
  }

  const analizarConIA = async () => {
    if (!plantillaContenido.trim()) return
    setAnalizando(true)
    setPlantillaMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ia-plantilla-analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ contenido: plantillaContenido }),
      })
      const { contenido: procesado, variables_insertadas, error } = await res.json()
      if (error) {
        setPlantillaMsg(`Error: ${error}`)
      } else {
        setPlantillaContenido(procesado)
        setPlantillaMsg(`✅ IA detectó y aplicó ${variables_insertadas} variable${variables_insertadas !== 1 ? 's' : ''} distintas`)
        setTimeout(() => setPlantillaMsg(''), 5000)
      }
    } catch {
      setPlantillaMsg('Error al conectar con la IA. Intentá de nuevo.')
    } finally {
      setAnalizando(false)
    }
  }

  const eliminarPlantilla = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await supabase.from('contratos_plantillas').delete().eq('id', id)
    setPlantillas(prev => prev.filter(p => p.id !== id))
    if (plantillaSelId === id) { setPlantillaSelId(''); setPlantillaPreview('') }
  }

  const previsualizarPlantilla = (p: Plantilla) => {
    setPlantillaSelId(p.id)
    setPlantillaPreview(fillTemplate(p.contenido))
  }

  const actualizarPreview = () => {
    const p = plantillas.find(x => x.id === plantillaSelId)
    if (p) setPlantillaPreview(fillTemplate(p.contenido))
  }

  const copiar = (text: string) => navigator.clipboard.writeText(text)
  const imprimir = () => window.print()

  const panelSt: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 0 64px' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .contrato-texto { background: #fff !important; color: #000 !important; border: none !important; padding: 40px !important; font-size: 13px !important; }
        }
        .ci { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #fff; padding: 10px 12px; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .ci:focus { outline: none; border-color: rgba(204,0,0,0.4); }
        .cs { width: 100%; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #fff; padding: 10px 12px; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .cl { font-size: 11px; color: rgba(255,255,255,0.4); font-family: Montserrat,sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 6px; }
        .cf { margin-bottom: 14px; }
        .cr { display: flex; gap: 10px; }
        .cr .cf { flex: 1; }
        .cta { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #fff; padding: 10px 12px; font-size: 13px; font-family: inherit; box-sizing: border-box; resize: vertical; }
        .cta:focus { outline: none; border-color: rgba(204,0,0,0.4); }
        .sh { font-size: 11px; font-family: Montserrat,sans-serif; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 14px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Encabezado */}
      <div className="no-print" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulo 136 — LegalTech</div>
        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Contratos</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Generá contratos con IA o completá tus propias plantillas con los datos del CRM</p>
      </div>

      {/* Pestañas principales */}
      <div className="no-print" style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {([
          { key: 'ia'        as MainTab, label: '✨ Generar con IA' },
          { key: 'plantillas' as MainTab, label: `📁 Mis plantillas${plantillas.length > 0 ? ` (${plantillas.length})` : ''}` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.key ? '#cc0000' : 'transparent'}`, color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: 'pointer', marginBottom: -1 }}
          >{t.label}</button>
        ))}
      </div>

      {/* ═══ PESTAÑA IA ═══ */}
      {tab === 'ia' && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Columna izquierda: formulario */}
          <div className="no-print" style={{ flex: '0 0 360px', minWidth: 280 }}>

            {/* 1 — Tipo */}
            <div style={panelSt}>
              <div className="sh">1 — Tipo de contrato</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {TIPOS.map(t => (
                  <button key={t.key} onClick={() => setTipo(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', background: tipo === t.key ? 'rgba(204,0,0,0.12)' : 'rgba(255,255,255,0.03)', outline: tipo === t.key ? '1px solid rgba(204,0,0,0.3)' : 'none' }}>
                    <span style={{ fontSize: 18 }}>{t.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: tipo === t.key ? 600 : 400, color: tipo === t.key ? '#fff' : 'rgba(255,255,255,0.5)' }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2 — Partes */}
            <div style={panelSt}>
              <div className="sh">2 — Partes</div>
              <div className="cf">
                <label className="cl">Vendedor / Locador</label>
                <select className="cs" value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                  <option value="">— Seleccionar del CRM —</option>
                  {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido ?? ''}</option>)}
                </select>
              </div>
              <div className="cf">
                <label className="cl">{tipo === 'alquiler' ? 'Inquilino / Locatario' : 'Comprador'}</label>
                <select className="cs" value={compradorId} onChange={e => setCompradorId(e.target.value)}>
                  <option value="">— Seleccionar del CRM —</option>
                  {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido ?? ''}</option>)}
                </select>
              </div>
              <div className="cf" style={{ marginBottom: 0 }}>
                <label className="cl">Propiedad (de mi cartera)</label>
                <select className="cs" value={propId} onChange={e => setPropId(e.target.value)}>
                  <option value="">— Seleccionar propiedad —</option>
                  {propiedades.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                </select>
              </div>
            </div>

            {/* 3 — Condiciones económicas */}
            <div style={panelSt}>
              <div className="sh">3 — Condiciones económicas</div>
              <div className="cr">
                <div className="cf">
                  <label className="cl">Precio / Monto</label>
                  <input className="ci" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Ej: 120000" />
                </div>
                <div className="cf" style={{ flex: '0 0 88px' }}>
                  <label className="cl">Moneda</label>
                  <select className="cs" value={moneda} onChange={e => setMoneda(e.target.value)}>
                    <option>USD</option><option>ARS</option><option>EUR</option>
                  </select>
                </div>
              </div>

              <div className="cf">
                <label className="cl">Forma de pago</label>
                <select className="cs" value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                  {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>

              <div className="cr">
                <div className="cf">
                  <label className="cl">Honorarios (%)</label>
                  <input className="ci" type="number" min={0} max={100} step={0.5} value={honorariosPct} onChange={e => setHonorariosPct(e.target.value)} placeholder="3" />
                </div>
                <div className="cf">
                  <label className="cl">Honorarios (monto)</label>
                  <input
                    className="ci"
                    readOnly
                    value={honorariosMonto ? `${moneda} ${fmt(honorariosMonto)}` : ''}
                    placeholder="Auto"
                    style={{ opacity: 0.55 }}
                  />
                </div>
              </div>

              {(tipo === 'reserva' || tipo === 'compraventa') && (
                <div className="cf">
                  <label className="cl">Seña / Reserva (monto)</label>
                  <input className="ci" value={señaMonto} onChange={e => setSeñaMonto(e.target.value)} placeholder={`Ej: 5000 ${moneda}`} />
                </div>
              )}

              {tipo === 'alquiler' && (
                <div className="cf">
                  <label className="cl">Plazo del contrato</label>
                  <input className="ci" value={plazo} onChange={e => setPlazo(e.target.value)} placeholder="Ej: 2 años" />
                </div>
              )}
            </div>

            {/* 4 — Condiciones adicionales */}
            <div style={panelSt}>
              <div className="sh">4 — Condiciones adicionales</div>

              <div className="cf">
                <label className="cl">Fecha de entrega / escritura</label>
                <input className="ci" type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
              </div>

              <div className="cf">
                <label className="cl">Garantía</label>
                <select className="cs" value={garantiaTipo} onChange={e => setGarantiaTipo(e.target.value)}>
                  {GARANTIAS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>

              <div className="cf">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={expensasIncluidas} onChange={e => setExpensasIncluidas(e.target.checked)} style={{ accentColor: '#cc0000', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Expensas incluidas en el precio</span>
                </label>
              </div>

              <div className="cf" style={{ marginBottom: 18 }}>
                <label className="cl">Cláusulas adicionales (opcional)</label>
                <textarea className="cta" value={clausulasExtra} onChange={e => setClausulasExtra(e.target.value)} placeholder="Ej: El inmueble se entrega con todos los artefactos incluidos..." rows={3} />
              </div>

              <button
                onClick={generar}
                disabled={generando}
                style={{ width: '100%', padding: 12, background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: generando ? 0.6 : 1 }}
              >
                {generando ? '⏳ Generando contrato...' : '✨ Generar contrato con IA'}
              </button>
            </div>
          </div>

          {/* Columna derecha: resultado */}
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
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Redactando contrato con IA...</div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8 }}>Usando Claude Sonnet — puede tardar 15-30 segundos</div>
              </div>
            )}
            {contrato && !generando && (
              <div>
                <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
                  <button onClick={() => copiar(contrato)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, cursor: 'pointer' }}>📋 Copiar</button>
                  <button onClick={imprimir} style={{ padding: '8px 16px', background: '#cc0000', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: 'pointer' }}>🖨 Imprimir / PDF</button>
                  <button onClick={generar} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, cursor: 'pointer' }}>🔄 Regenerar</button>
                </div>
                <div className="contrato-texto" ref={contratoRef} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 32, fontFamily: "'Georgia', serif", fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {contrato}
                </div>
                <div className="no-print" style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 11, color: 'rgba(245,158,11,0.7)' }}>
                  ⚠️ Este contrato es un borrador generado por IA. Revisá todos los datos y consultá con tu asesor legal antes de firmar. Los campos entre [CORCHETES] requieren completarse.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ PESTAÑA PLANTILLAS ═══ */}
      {tab === 'plantillas' && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Columna izquierda */}
          <div style={{ flex: '0 0 360px', minWidth: 280 }}>

            {/* Sub-pestañas */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {([
                { key: 'lista' as PlantillaTab, label: '📋 Mis plantillas' },
                { key: 'nueva' as PlantillaTab, label: '＋ Nueva plantilla' },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setPlantillaTab(t.key)}
                  style={{ flex: 1, padding: '9px 10px', background: plantillaTab === t.key ? 'rgba(204,0,0,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${plantillaTab === t.key ? 'rgba(204,0,0,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: plantillaTab === t.key ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: 'pointer' }}
                >{t.label}</button>
              ))}
            </div>

            {/* Lista de plantillas */}
            {plantillaTab === 'lista' && (
              <div style={panelSt}>
                {plantillas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                    Todavía no tenés plantillas.<br />
                    <button onClick={() => setPlantillaTab('nueva')} style={{ marginTop: 12, padding: '8px 16px', background: '#cc0000', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: 'pointer' }}>Crear mi primera plantilla</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plantillas.map(p => (
                      <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${plantillaSelId === p.id ? 'rgba(204,0,0,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{p.tipo} · {p.contenido.length.toLocaleString('es-AR')} caracteres</div>
                          </div>
                          <button onClick={() => eliminarPlantilla(p.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.5)', fontSize: 15, cursor: 'pointer', flexShrink: 0, padding: '2px 4px' }}>✕</button>
                        </div>
                        <button
                          onClick={() => previsualizarPlantilla(p)}
                          style={{ marginTop: 10, width: '100%', padding: '8px', background: plantillaSelId === p.id ? '#cc0000' : 'rgba(204,0,0,0.12)', border: `1px solid rgba(204,0,0,${plantillaSelId === p.id ? 0 : 0.2})`, borderRadius: 6, color: '#fff', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {plantillaSelId === p.id ? '✓ Seleccionada' : 'Completar con datos →'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Nueva plantilla */}
            {plantillaTab === 'nueva' && (
              <div style={panelSt}>
                <div className="cf">
                  <label className="cl">Nombre de la plantilla</label>
                  <input className="ci" value={plantillaNombre} onChange={e => setPlantillaNombre(e.target.value)} placeholder="Ej: Boleto compraventa estándar" />
                </div>
                <div className="cf">
                  <label className="cl">Tipo</label>
                  <select className="cs" value={plantillaTipoSel} onChange={e => setPlantillaTipoSel(e.target.value)}>
                    <option value="general">General</option>
                    {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div className="cf" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="cl" style={{ marginBottom: 0 }}>Contenido de la plantilla</label>
                    {plantillaContenido.trim() && (
                      <button
                        onClick={analizarConIA}
                        disabled={analizando}
                        title="La IA detecta los datos variables y coloca las {{VARIABLES}} automáticamente"
                        style={{ padding: '5px 12px', background: analizando ? 'rgba(204,0,0,0.08)' : 'rgba(204,0,0,0.15)', border: '1px solid rgba(204,0,0,0.3)', borderRadius: 6, color: analizando ? 'rgba(255,255,255,0.4)' : '#fff', fontSize: 11, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: analizando ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        {analizando
                          ? <><span style={{ width: 10, height: 10, border: '2px solid rgba(204,0,0,0.2)', borderTopColor: '#cc0000', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Detectando...</>
                          : '✨ Detectar variables con IA'}
                      </button>
                    )}
                  </div>
                  <textarea
                    className="cta"
                    value={plantillaContenido}
                    onChange={e => setPlantillaContenido(e.target.value)}
                    rows={14}
                    placeholder={'Pegá tu contrato modelo tal cual lo tenés.\n\nLuego hacé clic en "Detectar variables con IA" y Claude reemplazará automáticamente los nombres, DNIs, montos, fechas, etc. con las variables correspondientes.\n\nTambién podés escribir las variables manualmente:\n{{VENDEDOR_NOMBRE}}, {{PRECIO}} {{MONEDA}}, {{FECHA_HOY}}, etc.'}
                  />
                </div>
                {plantillaMsg && (
                  <div style={{ fontSize: 12, color: plantillaMsg.startsWith('✅') ? '#4ade80' : '#f87171', marginBottom: 12 }}>{plantillaMsg}</div>
                )}
                <button
                  onClick={guardarPlantilla}
                  disabled={guardando || !plantillaNombre.trim() || !plantillaContenido.trim()}
                  style={{ width: '100%', padding: 11, background: '#cc0000', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: 'pointer', opacity: guardando || !plantillaNombre.trim() || !plantillaContenido.trim() ? 0.5 : 1 }}
                >
                  {guardando ? '⏳ Guardando...' : '💾 Guardar plantilla'}
                </button>
              </div>
            )}

            {/* Variables de referencia */}
            <div style={{ ...panelSt, marginBottom: 0 }}>
              <div className="sh" style={{ marginBottom: 10 }}>Variables disponibles</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {VARIABLES_REF.map(v => (
                  <span
                    key={v}
                    onClick={() => navigator.clipboard.writeText(v)}
                    title="Clic para copiar"
                    style={{ fontSize: 10, fontFamily: 'monospace', background: 'rgba(204,0,0,0.08)', border: '1px solid rgba(204,0,0,0.15)', borderRadius: 4, padding: '2px 6px', color: 'rgba(255,120,120,0.85)', cursor: 'pointer', userSelect: 'none' }}
                  >{v}</span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Clic en una variable para copiarla</div>
            </div>
          </div>

          {/* Columna derecha: datos + vista previa */}
          <div style={{ flex: 1, minWidth: 300 }}>

            {/* Formulario de datos para completar variables */}
            <div style={{ ...panelSt, marginBottom: 16 }}>
              <div className="sh">Datos para completar la plantilla</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <div className="cf">
                  <label className="cl">Vendedor / Locador</label>
                  <select className="cs" value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                    <option value="">— CRM —</option>
                    {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido ?? ''}</option>)}
                  </select>
                </div>
                <div className="cf">
                  <label className="cl">Comprador / Inquilino</label>
                  <select className="cs" value={compradorId} onChange={e => setCompradorId(e.target.value)}>
                    <option value="">— CRM —</option>
                    {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido ?? ''}</option>)}
                  </select>
                </div>
                <div className="cf">
                  <label className="cl">Propiedad</label>
                  <select className="cs" value={propId} onChange={e => setPropId(e.target.value)}>
                    <option value="">— Cartera —</option>
                    {propiedades.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                  </select>
                </div>
                <div className="cf">
                  <label className="cl">Precio y moneda</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="ci" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Monto" style={{ flex: 1 }} />
                    <select className="cs" value={moneda} onChange={e => setMoneda(e.target.value)} style={{ flex: '0 0 72px' }}>
                      <option>USD</option><option>ARS</option><option>EUR</option>
                    </select>
                  </div>
                </div>
                <div className="cf">
                  <label className="cl">Honorarios (%)</label>
                  <input className="ci" type="number" min={0} max={100} step={0.5} value={honorariosPct} onChange={e => setHonorariosPct(e.target.value)} placeholder="3" />
                </div>
                <div className="cf">
                  <label className="cl">Seña / Reserva</label>
                  <input className="ci" value={señaMonto} onChange={e => setSeñaMonto(e.target.value)} placeholder="Monto" />
                </div>
                <div className="cf">
                  <label className="cl">Fecha entrega</label>
                  <input className="ci" type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
                </div>
                <div className="cf">
                  <label className="cl">Garantía</label>
                  <select className="cs" value={garantiaTipo} onChange={e => setGarantiaTipo(e.target.value)}>
                    {GARANTIAS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="cf">
                  <label className="cl">Forma de pago</label>
                  <select className="cs" value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                    {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="cf">
                  <label className="cl">Plazo (alquiler)</label>
                  <input className="ci" value={plazo} onChange={e => setPlazo(e.target.value)} placeholder="Ej: 2 años" />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
                <input type="checkbox" checked={expensasIncluidas} onChange={e => setExpensasIncluidas(e.target.checked)} style={{ accentColor: '#cc0000', width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Expensas incluidas en el precio</span>
              </label>

              {plantillaSelId ? (
                <button
                  onClick={actualizarPreview}
                  style={{ width: '100%', padding: 10, background: '#cc0000', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: 'pointer' }}
                >
                  🔄 Actualizar vista previa
                </button>
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '8px 0' }}>
                  Seleccioná una plantilla para completarla con estos datos
                </div>
              )}
            </div>

            {/* Vista previa del contrato completado */}
            {plantillaPreview ? (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
                  <button onClick={() => copiar(plantillaPreview)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, cursor: 'pointer' }}>📋 Copiar</button>
                  <button onClick={imprimir} style={{ padding: '8px 16px', background: '#cc0000', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, cursor: 'pointer' }}>🖨 Imprimir / PDF</button>
                </div>
                <div className="contrato-texto" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 32, fontFamily: "'Georgia', serif", fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {plantillaPreview}
                </div>
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 11, color: 'rgba(245,158,11,0.7)' }}>
                  ⚠️ Las variables sin datos aparecen entre [CORCHETES]. Completá el formulario y hacé clic en "Actualizar vista previa".
                </div>
              </div>
            ) : (
              !plantillaSelId && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Seleccioná una plantilla de la lista<br />para previsualizarla con tus datos</div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
