'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Meta {
  id: string
  titulo: string
  descripcion: string | null
  categoria: string
  tipo: 'numero' | 'porcentaje' | 'binario'
  objetivo: number
  actual: number
  unidad: string | null
  fecha_limite: string | null
  completada: boolean
  created_at: string
}

const CATEGORIAS = ['Ventas', 'Captaciones', 'Facturación', 'Formación', 'Personal', 'Networking']
const TIPOS: Record<string, string> = { numero: 'Número', porcentaje: 'Porcentaje', binario: 'Sí/No' }
type TipoMeta = 'numero' | 'porcentaje' | 'binario'

const FORM_VACIO: { titulo: string; descripcion: string; categoria: string; tipo: TipoMeta; objetivo: string; actual: string; unidad: string; fecha_limite: string } = {
  titulo: '', descripcion: '', categoria: 'Ventas', tipo: 'numero', objetivo: '', actual: '0', unidad: '', fecha_limite: ''
}

function progreso(meta: Meta): number {
  if (meta.tipo === 'binario') return meta.completada ? 100 : 0
  if (meta.objetivo === 0) return 0
  return Math.min(100, Math.round((meta.actual / meta.objetivo) * 100))
}

function colorProgreso(p: number): string {
  if (p >= 100) return '#22c55e'
  if (p >= 60) return '#3b82f6'
  if (p >= 30) return '#f59e0b'
  return '#ef4444'
}

export default function MetasPage() {
  const [userId, setUserId] = useState('')
  const [metas, setMetas] = useState<Meta[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [editando, setEditando] = useState<Meta | null>(null)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)

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
      .from('metas_personales')
      .select('*')
      .eq('usuario_id', uid)
      .order('created_at', { ascending: false })
    setMetas((data as Meta[]) ?? [])
    setCargando(false)
  }

  const guardar = async () => {
    if (!form.titulo.trim() || !form.objetivo) return
    setGuardando(true)
    const payload = {
      usuario_id: userId,
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      categoria: form.categoria,
      tipo: form.tipo,
      objetivo: parseFloat(form.objetivo) || 0,
      actual: parseFloat(form.actual) || 0,
      unidad: form.unidad.trim() || null,
      fecha_limite: form.fecha_limite || null,
      completada: false,
    }
    if (editando) {
      await supabase.from('metas_personales').update(payload).eq('id', editando.id)
      mostrarToast('✅ Meta actualizada')
    } else {
      await supabase.from('metas_personales').insert(payload)
      mostrarToast('🎯 Meta creada')
    }
    setModal(false)
    setForm(FORM_VACIO)
    setEditando(null)
    setGuardando(false)
    cargar(userId)
  }

  const actualizarProgreso = async (meta: Meta, nuevoActual: number) => {
    setActualizandoId(meta.id)
    const completada = nuevoActual >= meta.objetivo
    await supabase.from('metas_personales').update({ actual: nuevoActual, completada }).eq('id', meta.id)
    setActualizandoId(null)
    cargar(userId)
  }

  const toggleBinario = async (meta: Meta) => {
    setActualizandoId(meta.id)
    await supabase.from('metas_personales').update({ completada: !meta.completada, actual: meta.completada ? 0 : 1 }).eq('id', meta.id)
    setActualizandoId(null)
    cargar(userId)
  }

  const eliminar = async (id: string) => {
    await supabase.from('metas_personales').delete().eq('id', id)
    cargar(userId)
  }

  const abrirEditar = (m: Meta) => {
    setEditando(m)
    setForm({
      titulo: m.titulo, descripcion: m.descripcion ?? '', categoria: m.categoria,
      tipo: m.tipo, objetivo: String(m.objetivo), actual: String(m.actual),
      unidad: m.unidad ?? '', fecha_limite: m.fecha_limite ?? ''
    })
    setModal(true)
  }

  const completadas = metas.filter(m => m.completada).length
  const enCurso = metas.filter(m => !m.completada && progreso(m) > 0).length

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '24px 0 64px' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulo 113</div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Metas y Objetivos</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            {metas.length} meta{metas.length !== 1 ? 's' : ''} · {completadas} completada{completadas !== 1 ? 's' : ''} · {enCurso} en curso
          </p>
        </div>
        <button onClick={() => { setEditando(null); setForm(FORM_VACIO); setModal(true) }} style={{ padding: '10px 20px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Nueva meta
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total', value: metas.length, color: '#fff' },
          { label: 'Completadas', value: completadas, color: '#22c55e' },
          { label: 'En curso', value: enCurso, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
      ) : metas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginBottom: 8 }}>Todavía no cargaste metas</div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Definí objetivos para el mes, trimestre o año y seguí tu progreso</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {metas.map(m => {
            const p = progreso(m)
            const col = colorProgreso(p)
            return (
              <div key={m.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${m.completada ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: m.completada ? '#22c55e' : '#fff' }}>{m.completada ? '✓ ' : ''}{m.titulo}</span>
                      <span style={{ fontSize: 10, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{m.categoria}</span>
                    </div>
                    {m.descripcion && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{m.descripcion}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => abrirEditar(m)} style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>✏️</button>
                    <button onClick={() => eliminar(m.id)} style={{ padding: '4px 10px', background: 'rgba(255,0,0,0.08)', border: 'none', borderRadius: 6, color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>

                {m.tipo === 'binario' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => toggleBinario(m)} disabled={actualizandoId === m.id} style={{ padding: '6px 16px', background: m.completada ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${m.completada ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: m.completada ? '#22c55e' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                      {m.completada ? '✓ Completada' : 'Marcar como completada'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                        {m.actual}{m.unidad ? ` ${m.unidad}` : ''} / {m.objetivo}{m.unidad ? ` ${m.unidad}` : ''}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: 'Montserrat,sans-serif' }}>{p}%</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                      <div style={{ height: '100%', width: `${p}%`, background: col, borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="number"
                        defaultValue={m.actual}
                        onBlur={e => {
                          const v = parseFloat(e.target.value)
                          if (!isNaN(v) && v !== m.actual) actualizarProgreso(m, v)
                        }}
                        style={{ width: 80, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', padding: '5px 8px', fontSize: 13, fontFamily: 'inherit' }}
                      />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>actualizar progreso</span>
                    </div>
                  </>
                )}

                {m.fecha_limite && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                    Límite: {new Date(m.fecha_limite).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) { setModal(false); setEditando(null) } }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 }}>
              {editando ? 'Editar meta' : 'Nueva meta'}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Título *</label>
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Cerrar 3 ventas este mes" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Detalle opcional..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Categoría</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }}>
                  {CATEGORIAS.map(c => <option key={c} value={c} style={{ background: '#141414' }}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoMeta }))} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }}>
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k} style={{ background: '#141414' }}>{v}</option>)}
                </select>
              </div>
            </div>

            {form.tipo !== 'binario' && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Objetivo *</label>
                  <input type="number" value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="10" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Unidad</label>
                  <input value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} placeholder="ventas, captaciones, %" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Fecha límite</label>
              <input type="date" value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setModal(false); setEditando(null) }} style={{ padding: '10px 20px', background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando || !form.titulo.trim() || (form.tipo !== 'binario' && !form.objetivo)} style={{ padding: '10px 24px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.5 : 1 }}>
                {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
