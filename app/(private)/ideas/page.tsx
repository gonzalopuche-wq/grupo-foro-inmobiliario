'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Idea {
  id: string
  titulo: string
  descripcion: string
  categoria: string
  votos: number
  estado: 'pendiente' | 'evaluando' | 'aprobada' | 'implementada' | 'descartada'
  autor_id: string
  autor_nombre: string | null
  ya_vote: boolean
  created_at: string
}

const CATEGORIAS = ['Plataforma', 'CRM', 'Capacitación', 'Comunidad', 'Legal', 'Otro']
const ESTADOS: Record<string, { label: string; color: string }> = {
  pendiente:    { label: 'Pendiente',    color: 'rgba(255,255,255,0.3)' },
  evaluando:    { label: 'Evaluando',    color: '#f59e0b' },
  aprobada:     { label: 'Aprobada',     color: '#22c55e' },
  implementada: { label: 'Implementada', color: '#3b82f6' },
  descartada:   { label: 'Descartada',   color: '#ef4444' },
}

const FORM_VACIO = { titulo: '', descripcion: '', categoria: 'Plataforma' }

export default function IdeasPage() {
  const [userId, setUserId] = useState('')
  const [userNombre, setUserNombre] = useState('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [filtro, setFiltro] = useState<string>('todas')
  const [toast, setToast] = useState<string | null>(null)
  const [votando, setVotando] = useState<string | null>(null)

  const mostrarToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)
      supabase.from('perfiles').select('nombre, apellido').eq('id', data.user.id).single().then(({ data: p }) => {
        if (p) setUserNombre(`${p.nombre ?? ''} ${p.apellido ?? ''}`.trim())
      })
      cargar(data.user.id)
    })
  }, [])

  const cargar = async (uid: string) => {
    setCargando(true)
    const { data } = await supabase
      .from('ideas')
      .select('*, votos_ideas(usuario_id)')
      .order('votos', { ascending: false })
    if (data) {
      setIdeas(data.map((i: any) => ({
        ...i,
        ya_vote: Array.isArray(i.votos_ideas) && i.votos_ideas.some((v: any) => v.usuario_id === uid),
      })))
    }
    setCargando(false)
  }

  const votar = async (idea: Idea) => {
    if (votando) return
    setVotando(idea.id)
    if (idea.ya_vote) {
      await supabase.from('votos_ideas').delete().eq('idea_id', idea.id).eq('usuario_id', userId)
      await supabase.from('ideas').update({ votos: Math.max(0, idea.votos - 1) }).eq('id', idea.id)
    } else {
      await supabase.from('votos_ideas').insert({ idea_id: idea.id, usuario_id: userId })
      await supabase.from('ideas').update({ votos: idea.votos + 1 }).eq('id', idea.id)
    }
    setVotando(null)
    cargar(userId)
  }

  const guardar = async () => {
    if (!form.titulo.trim() || !form.descripcion.trim()) return
    setGuardando(true)
    await supabase.from('ideas').insert({
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      categoria: form.categoria,
      autor_id: userId,
      autor_nombre: userNombre || null,
      votos: 0,
      estado: 'pendiente',
    })
    setModal(false)
    setForm(FORM_VACIO)
    setGuardando(false)
    mostrarToast('💡 Idea enviada — gracias por aportar!')
    cargar(userId)
  }

  const ideasFiltradas = filtro === 'todas' ? ideas : ideas.filter(i => i.estado === filtro)

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
          <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulo 06</div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Sistema de Ideas</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            Proponé mejoras · votá las mejores · ganá reputación
          </p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding: '10px 20px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Nueva idea
        </button>
      </div>

      {/* Banner recompensa */}
      <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
        <strong style={{ color: '#22c55e' }}>IDEAS QUE SUMAN</strong> — Las ideas con más de 10 votos son evaluadas por el equipo GFI. Si tu idea se implementa, recibís <strong style={{ color: '#fff' }}>+50 puntos de reputación</strong> y una mención especial en la plataforma.
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['todas', 'pendiente', 'evaluando', 'aprobada', 'implementada'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: filtro === f ? '#cc0000' : 'rgba(255,255,255,0.06)', color: filtro === f ? '#fff' : 'rgba(255,255,255,0.4)' }}>
            {f === 'todas' ? 'Todas' : ESTADOS[f]?.label}
            {f !== 'todas' && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                {ideas.filter(i => i.estado === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
      ) : ideasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>💡</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            {filtro === 'todas' ? 'Todavía no hay ideas — ¡sé el primero!' : `No hay ideas en estado "${ESTADOS[filtro]?.label}"`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ideasFiltradas.map(idea => {
            const est = ESTADOS[idea.estado]
            return (
              <div key={idea.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {/* Votos */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => votar(idea)}
                    disabled={votando === idea.id}
                    style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${idea.ya_vote ? '#cc0000' : 'rgba(255,255,255,0.1)'}`, background: idea.ya_vote ? 'rgba(204,0,0,0.12)' : 'rgba(255,255,255,0.04)', color: idea.ya_vote ? '#cc0000' : 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ▲
                  </button>
                  <div style={{ fontSize: 16, fontWeight: 800, color: idea.ya_vote ? '#cc0000' : '#fff', fontFamily: 'Montserrat,sans-serif' }}>{idea.votos}</div>
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{idea.titulo}</span>
                    <span style={{ fontSize: 10, color: est.color, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>● {est.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 8 }}>{idea.descripcion}</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{idea.categoria}</span>
                    {idea.autor_nombre && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>por {idea.autor_nombre}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                      {new Date(idea.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva idea */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Nueva idea</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Título *</label>
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Integración con portal inmobiliario X" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Descripción *</label>
              <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Explicá el problema que resuelve y cómo funcionaría..." rows={4} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Categoría</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CATEGORIAS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, categoria: c }))} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: form.categoria === c ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', color: form.categoria === c ? '#3b82f6' : 'rgba(255,255,255,0.4)', outline: form.categoria === c ? '1px solid rgba(59,130,246,0.4)' : 'none' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '10px 20px', background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando || !form.titulo.trim() || !form.descripcion.trim()} style={{ padding: '10px 24px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: guardando || !form.titulo.trim() || !form.descripcion.trim() ? 0.5 : 1 }}>
                {guardando ? 'Enviando...' : '💡 Enviar idea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
