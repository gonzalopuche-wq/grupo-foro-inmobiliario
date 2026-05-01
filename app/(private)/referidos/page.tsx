'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Referido {
  id: string
  referido_nombre: string
  referido_email: string | null
  referido_telefono: string | null
  tipo: 'corredor' | 'cliente' | 'proveedor'
  estado: 'pendiente' | 'activo' | 'inactivo'
  recompensa_aplicada: boolean
  created_at: string
}

const TIPOS = {
  corredor:   { label: 'Corredor', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  cliente:    { label: 'Cliente',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  proveedor:  { label: 'Proveedor', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
}
const ESTADOS = {
  pendiente: { label: 'Pendiente', color: 'rgba(255,255,255,0.4)' },
  activo:    { label: 'Activo',    color: '#22c55e' },
  inactivo:  { label: 'Inactivo',  color: '#ef4444' },
}

type TipoReferido = 'corredor' | 'cliente' | 'proveedor'
const FORM_VACIO: { referido_nombre: string; referido_email: string; referido_telefono: string; tipo: TipoReferido } = { referido_nombre: '', referido_email: '', referido_telefono: '', tipo: 'corredor' }

export default function ReferidosPage() {
  const [userId, setUserId] = useState('')
  const [items, setItems] = useState<Referido[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const mostrarToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

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
      .from('referidos')
      .select('*')
      .eq('referente_id', uid)
      .order('created_at', { ascending: false })
    setItems((data as Referido[]) ?? [])
    setCargando(false)
  }

  const guardar = async () => {
    if (!form.referido_nombre.trim()) return
    setGuardando(true)
    await supabase.from('referidos').insert({
      referente_id: userId,
      referido_nombre: form.referido_nombre.trim(),
      referido_email: form.referido_email.trim() || null,
      referido_telefono: form.referido_telefono.trim() || null,
      tipo: form.tipo,
      estado: 'pendiente',
      recompensa_aplicada: false,
    })
    setModal(false)
    setForm(FORM_VACIO)
    setGuardando(false)
    mostrarToast('✅ Referido registrado')
    cargar(userId)
  }

  const activos = items.filter(r => r.estado === 'activo').length
  const pendientes = items.filter(r => r.estado === 'pendiente').length

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0 64px' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulo 109</div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Gestión de Referidos</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            {items.length} referido{items.length !== 1 ? 's' : ''} · {activos} activo{activos !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding: '10px 20px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Nuevo referido
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total', value: items.length, color: '#fff' },
          { label: 'Activos', value: activos, color: '#22c55e' },
          { label: 'Pendientes', value: pendientes, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info recompensa */}
      <div style={{ background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
        <strong style={{ color: '#cc0000' }}>EL QUE APORTA, GANA</strong> — Cada referido que se suscribe aplica un descuento en tu abono mensual + puntos de reputación. El admin verifica y activa la recompensa.
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🤝</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginBottom: 8 }}>Todavía no registraste referidos</div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Referí colegas, clientes o proveedores y ganá descuentos en tu suscripción</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(r => {
            const tipo = TIPOS[r.tipo]
            const estado = ESTADOS[r.estado]
            return (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: tipo.bg, border: `1px solid ${tipo.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {r.tipo === 'corredor' ? '🏠' : r.tipo === 'cliente' ? '👤' : '🏢'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{r.referido_nombre}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: tipo.color, background: tipo.bg, padding: '2px 8px', borderRadius: 10 }}>
                      {tipo.label}
                    </span>
                    <span style={{ fontSize: 11, color: estado.color, fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>
                      {estado.label}
                    </span>
                    {r.recompensa_aplicada && (
                      <span style={{ fontSize: 10, color: '#22c55e', fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>✓ Recompensa aplicada</span>
                    )}
                    {r.referido_email && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{r.referido_email}</span>}
                    {r.referido_telefono && (
                      <a href={`https://wa.me/${r.referido_telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'rgba(34,197,94,0.7)', textDecoration: 'none' }}>
                        💬 {r.referido_telefono}
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'Montserrat,sans-serif', flexShrink: 0 }}>
                  {new Date(r.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460 }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Nuevo referido</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Nombre y apellido *</label>
              <input value={form.referido_nombre} onChange={e => setForm(f => ({ ...f, referido_nombre: e.target.value }))} placeholder="Ej: María González" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Email</label>
                <input value={form.referido_email} onChange={e => setForm(f => ({ ...f, referido_email: e.target.value }))} placeholder="email@ejemplo.com" type="email" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Teléfono</label>
                <input value={form.referido_telefono} onChange={e => setForm(f => ({ ...f, referido_telefono: e.target.value }))} placeholder="+54 341 ..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Tipo de referido</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['corredor', 'cliente', 'proveedor'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 12, fontWeight: 700, background: form.tipo === t ? TIPOS[t].color + '22' : 'rgba(255,255,255,0.04)', color: form.tipo === t ? TIPOS[t].color : 'rgba(255,255,255,0.4)', outline: form.tipo === t ? `1px solid ${TIPOS[t].color}44` : 'none' }}>
                    {TIPOS[t].label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '10px 20px', background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando || !form.referido_nombre.trim()} style={{ padding: '10px 24px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: guardando || !form.referido_nombre.trim() ? 0.5 : 1 }}>
                {guardando ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
