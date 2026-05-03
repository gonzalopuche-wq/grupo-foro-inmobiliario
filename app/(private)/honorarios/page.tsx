'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

/* ── Tipos ─────────────────────────────────────────────────────────── */
type EstadoHon = 'pendiente' | 'parcial' | 'cobrado' | 'incobrable'
type TipoOp = 'venta' | 'alquiler' | 'intermediacion' | 'captacion' | 'tasacion' | 'otro'
type Moneda = 'ARS' | 'USD' | 'EUR'

interface Honorario {
  id: string
  descripcion: string
  tipo_operacion: TipoOp
  fecha_operacion: string
  cliente_nombre: string | null
  propiedad_ref: string | null
  monto_operacion: number | null
  moneda_operacion: Moneda
  porcentaje: number
  monto_bruto: number
  iva_incluido: boolean
  tasa_iva: number
  monto_neto: number
  monto_iva: number
  compartido: boolean
  porcentaje_propio: number
  monto_propio: number
  socio_nombre: string | null
  estado: EstadoHon
  monto_cobrado: number
  fecha_cobro: string | null
  notas: string | null
  created_at: string
}

const TIPOS: Record<TipoOp, { label: string; icon: string; color: string }> = {
  venta:          { label: 'Venta',          icon: '🏠', color: '#3b82f6' },
  alquiler:       { label: 'Alquiler',       icon: '🔑', color: '#f59e0b' },
  intermediacion: { label: 'Intermediación', icon: '🤝', color: '#8b5cf6' },
  captacion:      { label: 'Captación',      icon: '📋', color: '#22c55e' },
  tasacion:       { label: 'Tasación',       icon: '📊', color: '#f97316' },
  otro:           { label: 'Otro',           icon: '📄', color: '#6b7280' },
}

const ESTADOS: Record<EstadoHon, { label: string; color: string; bg: string }> = {
  pendiente:   { label: 'Pendiente',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  parcial:     { label: 'Cobro parcial', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  cobrado:     { label: 'Cobrado',     color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  incobrable:  { label: 'Incobrable', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
}

const MONEDAS: Moneda[] = ['ARS', 'USD', 'EUR']
const TASA_IVA_DEFAULT = 21
const PORC_DEFAULT = 3

const FORM_VACIO = {
  descripcion: '', tipo_operacion: 'venta' as TipoOp, fecha_operacion: new Date().toISOString().split('T')[0],
  cliente_nombre: '', propiedad_ref: '', monto_operacion: '', moneda_operacion: 'USD' as Moneda,
  porcentaje: String(PORC_DEFAULT), monto_bruto: '', iva_incluido: true, tasa_iva: String(TASA_IVA_DEFAULT),
  compartido: false, porcentaje_propio: '100', socio_nombre: '',
  estado: 'pendiente' as EstadoHon, monto_cobrado: '0', fecha_cobro: '', notas: '',
}

function fmt(n: number, moneda: Moneda = 'ARS') {
  const v = n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return moneda === 'ARS' ? `$${v}` : `${moneda} ${v}`
}

function calcularMontos(monto_op: string, porc: string, iva_inc: boolean, tasa_iva: string, porc_propio: string, compartido: boolean) {
  const base = parseFloat(monto_op) || 0
  const p = parseFloat(porc) || 0
  const iva = parseFloat(tasa_iva) || 21
  const pp = parseFloat(porc_propio) || 100

  const bruto = (base * p) / 100
  const iva_monto = iva_inc ? bruto - bruto / (1 + iva / 100) : bruto * (iva / 100)
  const neto = iva_inc ? bruto / (1 + iva / 100) : bruto
  const propio = compartido ? (bruto * pp) / 100 : bruto

  return { bruto, iva_monto, neto, propio }
}

export default function HonorariosPage() {
  const [uid, setUid] = useState('')
  const [items, setItems] = useState<Honorario[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [expandido, setExpandido] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }:any) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUid(data.user.id)
      cargar(data.user.id)
    })
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }

  const cargar = async (id: string) => {
    setCargando(true)
    const { data } = await supabase
      .from('honorarios')
      .select('*')
      .eq('perfil_id', id)
      .order('fecha_operacion', { ascending: false })
    setItems((data ?? []) as Honorario[])
    setCargando(false)
  }

  const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  // Recalcular montos al cambiar campos numéricos
  const recalcular = (override?: Partial<typeof form>) => {
    const f = { ...form, ...override }
    if (!f.monto_operacion) return
    const { bruto, iva_monto, neto, propio } = calcularMontos(
      f.monto_operacion, f.porcentaje, f.iva_incluido, f.tasa_iva, f.porcentaje_propio, f.compartido
    )
    setForm(prev => ({
      ...prev,
      ...override,
      monto_bruto: bruto.toFixed(2),
    }))
    return { bruto, iva_monto, neto, propio }
  }

  const abrirNuevo = () => {
    setForm(FORM_VACIO); setEditId(null); setModal(true)
  }

  const abrirEditar = (h: Honorario) => {
    setForm({
      descripcion: h.descripcion, tipo_operacion: h.tipo_operacion,
      fecha_operacion: h.fecha_operacion, cliente_nombre: h.cliente_nombre ?? '',
      propiedad_ref: h.propiedad_ref ?? '', monto_operacion: h.monto_operacion ? String(h.monto_operacion) : '',
      moneda_operacion: h.moneda_operacion, porcentaje: String(h.porcentaje),
      monto_bruto: String(h.monto_bruto), iva_incluido: h.iva_incluido,
      tasa_iva: String(h.tasa_iva), compartido: h.compartido,
      porcentaje_propio: String(h.porcentaje_propio), socio_nombre: h.socio_nombre ?? '',
      estado: h.estado, monto_cobrado: String(h.monto_cobrado),
      fecha_cobro: h.fecha_cobro ?? '', notas: h.notas ?? '',
    })
    setEditId(h.id); setModal(true)
  }

  const guardar = async () => {
    if (!form.descripcion.trim()) { showToast('Completá la descripción'); return }
    if (!form.monto_bruto) { showToast('Calculá el monto de honorarios'); return }
    setGuardando(true)
    const { bruto, iva_monto, neto, propio } = calcularMontos(
      form.monto_operacion, form.porcentaje, form.iva_incluido, form.tasa_iva, form.porcentaje_propio, form.compartido
    )
    const payload: any = {
      perfil_id: uid,
      descripcion: form.descripcion.trim(),
      tipo_operacion: form.tipo_operacion,
      fecha_operacion: form.fecha_operacion,
      cliente_nombre: form.cliente_nombre || null,
      propiedad_ref: form.propiedad_ref || null,
      monto_operacion: form.monto_operacion ? parseFloat(form.monto_operacion) : null,
      moneda_operacion: form.moneda_operacion,
      porcentaje: parseFloat(form.porcentaje) || 0,
      monto_bruto: bruto,
      iva_incluido: form.iva_incluido,
      tasa_iva: parseFloat(form.tasa_iva) || 21,
      monto_neto: neto,
      monto_iva: iva_monto,
      compartido: form.compartido,
      porcentaje_propio: parseFloat(form.porcentaje_propio) || 100,
      monto_propio: propio,
      socio_nombre: form.compartido ? (form.socio_nombre || null) : null,
      estado: form.estado,
      monto_cobrado: parseFloat(form.monto_cobrado) || 0,
      fecha_cobro: form.fecha_cobro || null,
      notas: form.notas || null,
    }
    if (editId) {
      await supabase.from('honorarios').update(payload).eq('id', editId)
      showToast('Honorario actualizado')
    } else {
      await supabase.from('honorarios').insert(payload)
      showToast('Honorario registrado')
    }
    setGuardando(false); setModal(false)
    cargar(uid)
  }

  const marcarCobrado = async (h: Honorario) => {
    await supabase.from('honorarios').update({
      estado: 'cobrado',
      monto_cobrado: h.monto_propio,
      fecha_cobro: new Date().toISOString().split('T')[0],
    }).eq('id', h.id)
    showToast('Marcado como cobrado')
    cargar(uid)
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este honorario?')) return
    await supabase.from('honorarios').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    showToast('Eliminado')
  }

  // Filtros
  const filtrados = items.filter(i => {
    if (filtroEstado !== 'todos' && i.estado !== filtroEstado) return false
    if (filtroTipo !== 'todos' && i.tipo_operacion !== filtroTipo) return false
    return true
  })

  // Totales
  const totalBruto = filtrados.reduce((s, i) => s + (i.monto_bruto || 0), 0)
  const totalNeto = filtrados.reduce((s, i) => s + (i.monto_neto || 0), 0)
  const totalCobrado = filtrados.reduce((s, i) => s + (i.monto_cobrado || 0), 0)
  const totalPendiente = filtrados.filter(i => i.estado === 'pendiente' || i.estado === 'parcial').reduce((s, i) => s + (i.monto_propio - i.monto_cobrado), 0)

  // Cálculo en tiempo real en el modal
  const calcLive = form.monto_operacion ? calcularMontos(
    form.monto_operacion, form.porcentaje, form.iva_incluido, form.tasa_iva, form.porcentaje_propio, form.compartido
  ) : null

  const S = {
    page: { maxWidth: 900, margin: '0 auto', padding: '24px 0 64px', fontFamily: 'Inter,sans-serif', color: '#fff' },
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px', marginBottom: 10, cursor: 'pointer' },
    label: { fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: 6 },
    input: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const },
    btn: (primary?: boolean) => ({ background: primary ? '#cc0000' : 'rgba(255,255,255,0.07)', border: primary ? 'none' : '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer' }),
  }

  return (
    <div style={S.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap');
        .hon-row:hover { background: rgba(255,255,255,0.05) !important; }
        select option { background: #1a1a1a; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: 10, fontSize: 13, color: '#fff', zIndex: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Gestión financiera</div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Honorarios y Liquidaciones</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4, margin: '4px 0 0' }}>Registrá y controlá tus honorarios por operación · IVA · Distribución</p>
        </div>
        <button onClick={abrirNuevo} style={S.btn(true)}>+ Nuevo honorario</button>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total bruto', valor: fmt(totalBruto), color: '#fff' },
          { label: 'Total neto (sin IVA)', valor: fmt(totalNeto), color: '#3b82f6' },
          { label: 'Cobrado', valor: fmt(totalCobrado), color: '#22c55e' },
          { label: 'Pendiente de cobro', valor: fmt(totalPendiente), color: '#f59e0b' },
        ].map(c => (
          <div key={c.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={S.label}>{c.label}</div>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 800, color: c.color }}>{c.valor}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ ...S.input, width: 'auto', paddingRight: 28 }}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...S.input, width: 'auto', paddingRight: 28 }}>
          <option value="todos">Todos los tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filtroEstado !== 'todos' || filtroTipo !== 'todos') && (
          <button onClick={() => { setFiltroEstado('todos'); setFiltroTipo('todos') }} style={{ ...S.btn(), fontSize: 11 }}>✕ Limpiar filtros</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>{filtrados.length} operación{filtrados.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.3)' }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'rgba(255,255,255,0.25)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <p style={{ fontSize: 14 }}>No hay honorarios registrados</p>
          <button onClick={abrirNuevo} style={S.btn(true)}>Registrar primer honorario</button>
        </div>
      ) : filtrados.map(h => {
        const tipo = TIPOS[h.tipo_operacion] ?? TIPOS.otro
        const estado = ESTADOS[h.estado] ?? ESTADOS.pendiente
        const abierto = expandido === h.id
        return (
          <div key={h.id} className="hon-row" style={S.card} onClick={() => setExpandido(abierto ? null : h.id)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{tipo.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.descripcion}</span>
                  <span style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tipo.color, background: `${tipo.color}18`, padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>{tipo.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  {h.cliente_nombre && <span>👤 {h.cliente_nombre}</span>}
                  {h.propiedad_ref && <span>🏠 {h.propiedad_ref}</span>}
                  <span>{h.fecha_operacion ? new Date(h.fecha_operacion + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                  {h.compartido && <span style={{ color: '#8b5cf6' }}>🤝 Compartido {h.porcentaje_propio}%</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 800, color: '#fff' }}>{fmt(h.monto_propio, h.moneda_operacion)}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                  Bruto: {fmt(h.monto_bruto, h.moneda_operacion)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: estado.color, background: estado.bg, padding: '2px 8px', borderRadius: 10 }}>{estado.label}</span>
                </div>
              </div>
            </div>

            {/* Detalle expandible */}
            {abierto && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 14 }}>
                  {[
                    { label: 'Monto operación', valor: h.monto_operacion ? fmt(h.monto_operacion, h.moneda_operacion) : '—' },
                    { label: `Honorario ${h.porcentaje}%`, valor: fmt(h.monto_bruto, h.moneda_operacion) },
                    { label: `IVA ${h.tasa_iva}%${h.iva_incluido ? ' (incl.)' : ''}`, valor: fmt(h.monto_iva, h.moneda_operacion) },
                    { label: 'Neto s/IVA', valor: fmt(h.monto_neto, h.moneda_operacion) },
                    { label: 'Cobrado', valor: fmt(h.monto_cobrado, h.moneda_operacion) },
                    { label: 'Pendiente', valor: fmt(h.monto_propio - h.monto_cobrado, h.moneda_operacion) },
                  ].map(d => (
                    <div key={d.label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 7, padding: '10px 12px' }}>
                      <div style={{ ...S.label, marginBottom: 4 }}>{d.label}</div>
                      <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 700, color: '#fff' }}>{d.valor}</div>
                    </div>
                  ))}
                </div>
                {h.notas && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 12px', fontStyle: 'italic' }}>📝 {h.notas}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(h.estado === 'pendiente' || h.estado === 'parcial') && (
                    <button onClick={() => marcarCobrado(h)} style={{ ...S.btn(), background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: 11 }}>
                      ✓ Marcar cobrado
                    </button>
                  )}
                  <button onClick={() => abrirEditar(h)} style={{ ...S.btn(), fontSize: 11 }}>Editar</button>
                  <button onClick={() => eliminar(h.id)} style={{ ...S.btn(), color: 'rgba(200,0,0,0.7)', fontSize: 11 }}>Eliminar</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }} onClick={() => setModal(false)}>
          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 20 }}>
              {editId ? 'Editar honorario' : 'Nuevo honorario'}
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {/* Descripción */}
              <div>
                <div style={S.label}>Descripción *</div>
                <input value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} placeholder="Ej: Venta Depto Alberdi — García/López" style={S.input} />
              </div>

              {/* Tipo + Fecha */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={S.label}>Tipo de operación</div>
                  <select value={form.tipo_operacion} onChange={e => setF('tipo_operacion', e.target.value)} style={S.input}>
                    {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={S.label}>Fecha operación</div>
                  <input type="date" value={form.fecha_operacion} onChange={e => setF('fecha_operacion', e.target.value)} style={S.input} />
                </div>
              </div>

              {/* Cliente + Propiedad */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={S.label}>Cliente</div>
                  <input value={form.cliente_nombre} onChange={e => setF('cliente_nombre', e.target.value)} placeholder="Nombre del cliente" style={S.input} />
                </div>
                <div>
                  <div style={S.label}>Referencia propiedad</div>
                  <input value={form.propiedad_ref} onChange={e => setF('propiedad_ref', e.target.value)} placeholder="Ej: Av. Corrientes 1234 3°A" style={S.input} />
                </div>
              </div>

              {/* Monto operación + Moneda */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <div style={S.label}>Monto de operación</div>
                  <input type="number" value={form.monto_operacion} onChange={e => { setF('monto_operacion', e.target.value); recalcular({ monto_operacion: e.target.value }) }} placeholder="Ej: 120000" style={S.input} />
                </div>
                <div>
                  <div style={S.label}>Moneda</div>
                  <select value={form.moneda_operacion} onChange={e => setF('moneda_operacion', e.target.value)} style={S.input}>
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Porcentaje + IVA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={S.label}>Honorario %</div>
                  <input type="number" step="0.5" value={form.porcentaje} onChange={e => { setF('porcentaje', e.target.value); recalcular({ porcentaje: e.target.value }) }} style={S.input} />
                </div>
                <div>
                  <div style={S.label}>IVA %</div>
                  <input type="number" value={form.tasa_iva} onChange={e => { setF('tasa_iva', e.target.value); recalcular({ tasa_iva: e.target.value }) }} style={S.input} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.6)', paddingBottom: 9 }}>
                    <input type="checkbox" checked={form.iva_incluido} onChange={e => { setF('iva_incluido', e.target.checked); recalcular({ iva_incluido: e.target.checked }) }} />
                    IVA incluido en honorario
                  </label>
                </div>
              </div>

              {/* Cálculo en vivo */}
              {calcLive && (
                <div style={{ background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.2)', borderRadius: 10, padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    { label: 'Bruto', valor: fmt(calcLive.bruto, form.moneda_operacion) },
                    { label: `IVA ${form.tasa_iva}%`, valor: fmt(calcLive.iva_monto, form.moneda_operacion) },
                    { label: 'Neto s/IVA', valor: fmt(calcLive.neto, form.moneda_operacion) },
                  ].map(d => (
                    <div key={d.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{d.label}</div>
                      <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 15, fontWeight: 800, color: '#fff' }}>{d.valor}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Compartido */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: form.compartido ? 12 : 0 }}>
                  <input type="checkbox" checked={form.compartido} onChange={e => setF('compartido', e.target.checked)} />
                  Honorario compartido con otro profesional
                </label>
                {form.compartido && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={S.label}>Mi porcentaje %</div>
                      <input type="number" value={form.porcentaje_propio} onChange={e => setF('porcentaje_propio', e.target.value)} style={S.input} />
                    </div>
                    <div>
                      <div style={S.label}>Nombre del socio</div>
                      <input value={form.socio_nombre} onChange={e => setF('socio_nombre', e.target.value)} placeholder="Nombre del colega" style={S.input} />
                    </div>
                  </div>
                )}
              </div>

              {/* Estado + Cobro */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={S.label}>Estado</div>
                  <select value={form.estado} onChange={e => setF('estado', e.target.value)} style={S.input}>
                    {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={S.label}>Monto cobrado</div>
                  <input type="number" value={form.monto_cobrado} onChange={e => setF('monto_cobrado', e.target.value)} style={S.input} />
                </div>
                <div>
                  <div style={S.label}>Fecha cobro</div>
                  <input type="date" value={form.fecha_cobro} onChange={e => setF('fecha_cobro', e.target.value)} style={S.input} />
                </div>
              </div>

              {/* Notas */}
              <div>
                <div style={S.label}>Notas internas</div>
                <textarea value={form.notas} onChange={e => setF('notas', e.target.value)} rows={2} placeholder="Observaciones, forma de pago, etc." style={{ ...S.input, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={S.btn()}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={S.btn(true)}>{guardando ? 'Guardando...' : editId ? 'Actualizar' : 'Registrar honorario'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
