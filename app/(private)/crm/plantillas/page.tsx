'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

interface Plantilla {
  id: string
  titulo: string
  contenido: string
  tipo: string
  created_at: string
}

const TIPOS: Record<string, { label: string; color: string; bg: string }> = {
  llamada:     { label: 'Llamada',    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  whatsapp:    { label: 'WhatsApp',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  email:       { label: 'Email',      color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  visita:      { label: 'Visita',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  reunion:     { label: 'Reunión',    color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  nota:        { label: 'Nota',       color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)' },
}

const TIPO_LIST = ['whatsapp', 'email', 'llamada', 'visita', 'reunion', 'nota']

const VARIABLES = ['{nombre}', '{apellido}', '{propiedad}', '{precio}', '{fecha}', '{telefono}']

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [cargando, setCargando] = useState(true)
  const [userId, setUserId] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ titulo: '', contenido: '', tipo: 'whatsapp' })
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
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
      .from('crm_plantillas')
      .select('id,titulo,contenido,tipo,created_at')
      .eq('perfil_id', uid)
      .order('tipo')
      .order('titulo')
    setPlantillas((data as Plantilla[]) ?? [])
    setCargando(false)
  }

  const abrirNueva = () => {
    setForm({ titulo: '', contenido: '', tipo: 'whatsapp' })
    setEditId(null)
    setModal(true)
  }

  const abrirEditar = (p: Plantilla) => {
    setForm({ titulo: p.titulo, contenido: p.contenido, tipo: p.tipo })
    setEditId(p.id)
    setModal(true)
  }

  const guardar = async () => {
    if (!form.titulo.trim() || !form.contenido.trim()) return
    setGuardando(true)
    if (editId) {
      await supabase.from('crm_plantillas').update({ titulo: form.titulo.trim(), contenido: form.contenido.trim(), tipo: form.tipo }).eq('id', editId)
    } else {
      await supabase.from('crm_plantillas').insert({ perfil_id: userId, titulo: form.titulo.trim(), contenido: form.contenido.trim(), tipo: form.tipo })
    }
    setGuardando(false)
    setModal(false)
    cargar(userId)
    mostrarToast(editId ? 'Plantilla actualizada ✓' : 'Plantilla creada ✓')
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await supabase.from('crm_plantillas').delete().eq('id', id)
    setPlantillas(prev => prev.filter(p => p.id !== id))
    mostrarToast('Eliminada')
  }

  const copiar = (contenido: string, id: string) => {
    navigator.clipboard.writeText(contenido)
    setCopiado(id)
    setTimeout(() => setCopiado(null), 2000)
  }

  const insertarVariable = (v: string) => {
    setForm(f => ({ ...f, contenido: f.contenido + v }))
  }

  const filtradas = filtro === 'todos' ? plantillas : plantillas.filter(p => p.tipo === filtro)

  const s = {
    page: { color: '#fff', fontFamily: 'Inter,sans-serif' } as React.CSSProperties,
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 12 },
    titulo: { margin: 0, fontSize: 18, fontWeight: 800, fontFamily: 'Montserrat,sans-serif' },
    sub: { margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
    btnNuevo: { display: 'flex', alignItems: 'center', gap: 8, background: '#cc0000', border: 'none', color: '#fff', padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer' },
    filtros: { display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 20 },
    chip: (activo: boolean) => ({ padding: '6px 14px', borderRadius: 20, border: `1px solid ${activo ? '#cc0000' : 'rgba(255,255,255,0.1)'}`, background: activo ? 'rgba(200,0,0,0.1)' : 'transparent', color: activo ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer' } as React.CSSProperties),
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '16px 20px', marginBottom: 10 } as React.CSSProperties,
    badge: (tipo: string) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 10, fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.08em', background: TIPOS[tipo]?.bg ?? 'rgba(255,255,255,0.06)', color: TIPOS[tipo]?.color ?? 'rgba(255,255,255,0.4)' } as React.CSSProperties),
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>📝 Plantillas de mensajes</h1>
          <p style={s.sub}>Textos reutilizables para WhatsApp, email y llamadas</p>
        </div>
        <button style={s.btnNuevo} onClick={abrirNueva}>+ Nueva plantilla</button>
      </div>

      {/* Filtros */}
      <div style={s.filtros}>
        <button style={s.chip(filtro === 'todos')} onClick={() => setFiltro('todos')}>
          Todas ({plantillas.length})
        </button>
        {TIPO_LIST.map(t => {
          const cnt = plantillas.filter(p => p.tipo === t).length
          if (cnt === 0) return null
          return (
            <button key={t} style={s.chip(filtro === t)} onClick={() => setFiltro(t)}>
              {TIPOS[t]?.label} ({cnt})
            </button>
          )
        })}
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.3)' }}>Cargando…</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'rgba(255,255,255,0.25)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {plantillas.length === 0 ? 'No tenés plantillas todavía' : 'Sin plantillas de ese tipo'}
          </div>
          {plantillas.length === 0 && (
            <p style={{ fontSize: 12, marginBottom: 16 }}>
              Creá mensajes predefinidos para usar rápido desde el CRM
            </p>
          )}
          <button style={s.btnNuevo} onClick={abrirNueva}>+ Crear primera plantilla</button>
        </div>
      ) : (
        filtradas.map(p => (
          <div key={p.id} style={s.card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div>
                <span style={s.badge(p.tipo)}>{TIPOS[p.tipo]?.label ?? p.tipo}</span>
                <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'Montserrat,sans-serif' }}>{p.titulo}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => copiar(p.contenido, p.id)}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}
                >
                  {copiado === p.id ? '¡Copiado!' : 'Copiar'}
                </button>
                <button onClick={() => abrirEditar(p)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', padding: '5px 8px' }}>Editar</button>
                <button onClick={() => eliminar(p.id)} style={{ background: 'none', border: 'none', color: 'rgba(200,0,0,0.5)', fontSize: 12, cursor: 'pointer', padding: '5px 8px' }}>Eliminar</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 6 }}>
              {p.contenido}
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 540 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', color: '#fff' }}>
              {editId ? 'Editar plantilla' : 'Nueva plantilla'}
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 5, fontFamily: 'Montserrat,sans-serif' }}>Tipo</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TIPO_LIST.map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${form.tipo === t ? '#cc0000' : 'rgba(255,255,255,0.1)'}`, background: form.tipo === t ? 'rgba(200,0,0,0.12)' : 'transparent', color: form.tipo === t ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                    {TIPOS[t]?.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 5, fontFamily: 'Montserrat,sans-serif' }}>Título</label>
              <input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej: Seguimiento post-visita"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif' }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat,sans-serif' }}>Mensaje</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {VARIABLES.map(v => (
                    <button key={v} onClick={() => insertarVariable(v)}
                      style={{ padding: '2px 7px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 9, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={form.contenido}
                onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                placeholder="Escribí el mensaje. Usá {nombre}, {apellido}, {propiedad}, etc. para personalizarlo."
                rows={5}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif', lineHeight: 1.6 }}
              />
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginBottom: 20 }}>
              Las variables entre llaves se reemplazan automáticamente al usar la plantilla desde el CRM.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '9px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando || !form.titulo.trim() || !form.contenido.trim()}
                style={{ background: '#cc0000', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', opacity: guardando ? 0.6 : 1 }}>
                {guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
            </div>
          </div>
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
