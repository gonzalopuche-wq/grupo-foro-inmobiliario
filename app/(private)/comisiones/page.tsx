'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Comision {
  id: string
  descripcion: string
  tipo_operacion: 'venta' | 'alquiler' | 'tasacion' | 'administracion' | 'otro'
  monto_operacion: number | null
  moneda_operacion: string
  porcentaje: number | null
  monto_comision: number
  moneda_comision: string
  estado: 'pendiente' | 'cobrada' | 'parcial'
  monto_cobrado: number
  fecha_operacion: string
  fecha_cobro: string | null
  cliente_nombre: string | null
  notas: string | null
  created_at: string
}

const TIPOS: Record<string, { label: string; color: string; icon: string }> = {
  venta:          { label: 'Venta',          color: '#22c55e', icon: '🏠' },
  alquiler:       { label: 'Alquiler',       color: '#3b82f6', icon: '🔑' },
  tasacion:       { label: 'Tasación',       color: '#f59e0b', icon: '📊' },
  administracion: { label: 'Administración', color: '#a855f7', icon: '🏢' },
  otro:           { label: 'Otro',           color: 'rgba(255,255,255,0.4)', icon: '📄' },
}
const ESTADOS: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#f59e0b' },
  cobrada:   { label: 'Cobrada',   color: '#22c55e' },
  parcial:   { label: 'Parcial',   color: '#3b82f6' },
}

type TipoComision = 'venta' | 'alquiler' | 'tasacion' | 'administracion' | 'otro'
type EstadoComision = 'pendiente' | 'cobrada' | 'parcial'

const FORM_VACIO: {
  descripcion: string; tipo_operacion: TipoComision; monto_operacion: string; moneda_operacion: string;
  porcentaje: string; monto_comision: string; moneda_comision: string; estado: EstadoComision;
  monto_cobrado: string; fecha_operacion: string; fecha_cobro: string; cliente_nombre: string; notas: string;
} = {
  descripcion: '', tipo_operacion: 'venta', monto_operacion: '', moneda_operacion: 'USD',
  porcentaje: '3', monto_comision: '', moneda_comision: 'ARS', estado: 'pendiente',
  monto_cobrado: '0', fecha_operacion: new Date().toISOString().split('T')[0], fecha_cobro: '', cliente_nombre: '', notas: ''
}

function calcularComision(monto: string, pct: string, monedaOp: string, monedaCom: string): string {
  const m = parseFloat(monto)
  const p = parseFloat(pct)
  if (isNaN(m) || isNaN(p)) return ''
  return (m * p / 100).toFixed(0)
}

export default function ComisionesPage() {
  const [userId, setUserId] = useState('')
  const [items, setItems] = useState<Comision[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [toast, setToast] = useState<string | null>(null)

  const mostrarToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)
      cargar(data.user.id)
    })
  }, [])

  const cargar = async (uid: string) => {
    setCargando(true)
    const { data } = await supabase
      .from('comisiones')
      .select('*')
      .eq('usuario_id', uid)
      .order('fecha_operacion', { ascending: false })
    setItems((data as Comision[]) ?? [])
    setCargando(false)
  }

  const guardar = async () => {
    if (!form.descripcion.trim() || !form.monto_comision) return
    setGuardando(true)
    await supabase.from('comisiones').insert({
      usuario_id: userId,
      descripcion: form.descripcion.trim(),
      tipo_operacion: form.tipo_operacion,
      monto_operacion: form.monto_operacion ? parseFloat(form.monto_operacion) : null,
      moneda_operacion: form.moneda_operacion,
      porcentaje: form.porcentaje ? parseFloat(form.porcentaje) : null,
      monto_comision: parseFloat(form.monto_comision),
      moneda_comision: form.moneda_comision,
      estado: form.estado,
      monto_cobrado: parseFloat(form.monto_cobrado) || 0,
      fecha_operacion: form.fecha_operacion,
      fecha_cobro: form.estado === 'cobrada' ? (form.fecha_cobro || new Date().toISOString().split('T')[0]) : (form.fecha_cobro || null),
      cliente_nombre: form.cliente_nombre.trim() || null,
      notas: form.notas.trim() || null,
    })
    setModal(false)
    setForm(FORM_VACIO)
    setGuardando(false)
    mostrarToast('✅ Comisión registrada')
    cargar(userId)
  }

  const marcarCobrada = async (item: Comision) => {
    await supabase.from('comisiones').update({ estado: 'cobrada', monto_cobrado: item.monto_comision, fecha_cobro: new Date().toISOString().split('T')[0] }).eq('id', item.id)
    cargar(userId)
    mostrarToast('💰 Marcada como cobrada')
  }

  const filtrados = items.filter(i => {
    const matchEst = filtroEstado === 'todos' || i.estado === filtroEstado
    const matchTipo = filtroTipo === 'todos' || i.tipo_operacion === filtroTipo
    return matchEst && matchTipo
  })

  const totalPendiente = items.filter(i => i.estado === 'pendiente' || i.estado === 'parcial').reduce((acc, i) => acc + (i.monto_comision - i.monto_cobrado), 0)
  const totalCobrado = items.filter(i => i.estado === 'cobrada').reduce((acc, i) => acc + i.monto_cobrado, 0)
  const totalEsteAno = items.filter(i => i.estado === 'cobrada' && new Date(i.fecha_operacion).getFullYear() === new Date().getFullYear()).reduce((acc, i) => acc + i.monto_cobrado, 0)

  // Auto-calcular comisión cuando cambian monto u porcentaje
  const handleMontoChange = (monto: string) => {
    setF('monto_operacion', monto)
    const calc = calcularComision(monto, form.porcentaje, form.moneda_operacion, form.moneda_comision)
    if (calc) setF('monto_comision', calc)
  }
  const handlePctChange = (pct: string) => {
    setF('porcentaje', pct)
    const calc = calcularComision(form.monto_operacion, pct, form.moneda_operacion, form.moneda_comision)
    if (calc) setF('monto_comision', calc)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 0 64px' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Finanzas</div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Comisiones</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            Registro de honorarios por operación inmobiliaria
          </p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding: '10px 20px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Nueva comisión
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'A cobrar', value: `ARS ${totalPendiente.toLocaleString('es-AR')}`, color: '#f59e0b' },
          { label: 'Cobrado total', value: `ARS ${totalCobrado.toLocaleString('es-AR')}`, color: '#22c55e' },
          { label: `Cobrado ${new Date().getFullYear()}`, value: `ARS ${totalEsteAno.toLocaleString('es-AR')}`, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 800, color: s.color, wordBreak: 'break-all' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setFiltroEstado('todos')} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: filtroEstado === 'todos' ? '#cc0000' : 'rgba(255,255,255,0.06)', color: filtroEstado === 'todos' ? '#fff' : 'rgba(255,255,255,0.4)' }}>
          Todas
        </button>
        {Object.entries(ESTADOS).map(([k, v]) => (
          <button key={k} onClick={() => setFiltroEstado(k)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: filtroEstado === k ? `${v.color}22` : 'rgba(255,255,255,0.06)', color: filtroEstado === k ? v.color : 'rgba(255,255,255,0.4)' }}>
            {v.label} ({items.filter(i => i.estado === k).length})
          </button>
        ))}
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>💰</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginBottom: 8 }}>
            {filtroEstado === 'todos' ? 'Todavía no registraste comisiones' : `Sin comisiones ${ESTADOS[filtroEstado]?.label.toLowerCase()}s`}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Registrá cada operación para tener seguimiento de tus honorarios</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map(item => {
            const tipo = TIPOS[item.tipo_operacion]
            const est = ESTADOS[item.estado]
            return (
              <div key={item.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: `${tipo.color}15`, border: `1px solid ${tipo.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {tipo.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{item.descripcion}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: tipo.color, background: `${tipo.color}15`, padding: '2px 8px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{tipo.label}</span>
                    <span style={{ fontSize: 11, color: est.color, fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>● {est.label}</span>
                    {item.cliente_nombre && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{item.cliente_nombre}</span>}
                    {item.porcentaje && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{item.porcentaje}%</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: item.estado === 'cobrada' ? '#22c55e' : '#fff', fontFamily: 'Montserrat,sans-serif' }}>
                    {item.moneda_comision} {item.monto_comision.toLocaleString('es-AR')}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                    {new Date(item.fecha_operacion).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </div>
                  {item.estado !== 'cobrada' && (
                    <button onClick={() => marcarCobrada(item)} style={{ marginTop: 4, padding: '3px 8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, color: '#22c55e', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                      ✓ Cobrada
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Nueva comisión</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Descripción *</label>
              <input value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} placeholder="Ej: Venta depto Alberdi — García/López" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Tipo</label>
                <select value={form.tipo_operacion} onChange={e => setF('tipo_operacion', e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }}>
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k} style={{ background: '#141414' }}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Cliente</label>
                <input value={form.cliente_nombre} onChange={e => setF('cliente_nombre', e.target.value)} placeholder="Nombre del cliente" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Monto operación + % */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Cálculo de comisión</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Valor operación</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select value={form.moneda_operacion} onChange={e => setF('moneda_operacion', e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '9px 6px', fontSize: 12, width: 60 }}>
                      <option value="USD" style={{ background: '#141414' }}>USD</option>
                      <option value="ARS" style={{ background: '#141414' }}>ARS</option>
                    </select>
                    <input type="number" value={form.monto_operacion} onChange={e => handleMontoChange(e.target.value)} placeholder="150000" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '9px 10px', fontSize: 13, fontFamily: 'inherit' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>%</label>
                  <input type="number" step="0.5" value={form.porcentaje} onChange={e => handlePctChange(e.target.value)} placeholder="3" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '9px 10px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Mi comisión *</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select value={form.moneda_comision} onChange={e => setF('moneda_comision', e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '9px 6px', fontSize: 12, width: 60 }}>
                      <option value="ARS" style={{ background: '#141414' }}>ARS</option>
                      <option value="USD" style={{ background: '#141414' }}>USD</option>
                    </select>
                    <input type="number" value={form.monto_comision} onChange={e => setF('monto_comision', e.target.value)} placeholder="0" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '9px 10px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700 }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Estado</label>
                <select value={form.estado} onChange={e => setF('estado', e.target.value as EstadoComision)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }}>
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k} style={{ background: '#141414' }}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Fecha operación</label>
                <input type="date" value={form.fecha_operacion} onChange={e => setF('fecha_operacion', e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Notas</label>
              <textarea value={form.notas} onChange={e => setF('notas', e.target.value)} placeholder="Observaciones adicionales..." rows={2} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '10px 20px', background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando || !form.descripcion.trim() || !form.monto_comision} style={{ padding: '10px 24px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: guardando || !form.descripcion.trim() || !form.monto_comision ? 0.5 : 1 }}>
                {guardando ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
