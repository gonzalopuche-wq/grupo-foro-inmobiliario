'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

interface Topic {
  id: string
  title: string
  body: string
  status: string
  is_urgent: boolean
  replies_count: number
  last_activity_at: string
  created_at: string
  forum_categories?: { name: string; slug: string }
  perfiles?: { nombre: string; apellido: string | null; matricula: string | null }
}

interface SavedRow {
  topic_id: string
  created_at: string
  topic: Topic
}

const STATUS_COLOR: Record<string, string> = {
  open:     '#3b82f6',
  resolved: '#22c55e',
  closed:   '#6b7280',
}
const STATUS_LABEL: Record<string, string> = {
  open:     'Abierto',
  resolved: 'Resuelto',
  closed:   'Cerrado',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

export default function GuardadosPage() {
  const [userId, setUserId] = useState('')
  const [saved, setSaved] = useState<SavedRow[]>([])
  const [cargando, setCargando] = useState(true)
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
      .from('forum_saved_topics')
      .select('topic_id, created_at, topic:forum_topics(id, title, body, status, is_urgent, replies_count, last_activity_at, created_at, forum_categories(name, slug), perfiles(nombre, apellido, matricula))')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    setSaved((data as unknown as SavedRow[]) ?? [])
    setCargando(false)
  }

  const unsave = async (topicId: string) => {
    await supabase.from('forum_saved_topics').delete().eq('topic_id', topicId).eq('user_id', userId)
    setSaved(prev => prev.filter(r => r.topic_id !== topicId))
    mostrarToast('Guardado eliminado')
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 0 64px' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Link href="/foro" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.1em', textDecoration: 'none' }}>
            ← FORO
          </Link>
        </div>
        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
          Temas Guardados
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          {cargando ? '' : `${saved.length} tema${saved.length !== 1 ? 's' : ''} guardado${saved.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '48px 0', textAlign: 'center' }}>Cargando...</div>
      ) : saved.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔖</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginBottom: 8 }}>No tenés temas guardados</div>
          <Link href="/foro" style={{ fontSize: 12, color: '#cc0000', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textDecoration: 'none' }}>
            Ir al foro →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {saved.map(row => {
            const t = row.topic
            if (!t) return null
            const c = t.forum_categories
            const autor = t.perfiles
            return (
              <div key={row.topic_id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Meta top */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    {c && (
                      <span style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {c.name}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700,
                      color: STATUS_COLOR[t.status] ?? '#fff',
                      background: (STATUS_COLOR[t.status] ?? '#fff') + '18',
                      padding: '2px 8px', borderRadius: 10,
                      letterSpacing: '0.06em',
                    }}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                    {t.is_urgent && (
                      <span style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                        URGENTE
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <Link href="/foro" style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 5, lineHeight: 1.35 }}>
                      {t.title}
                    </div>
                  </Link>

                  {/* Body excerpt */}
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, marginBottom: 8, margin: 0 }}>
                    {t.body.length > 120 ? t.body.slice(0, 120) + '…' : t.body}
                  </p>

                  {/* Footer meta */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                    {autor && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat,sans-serif' }}>
                        👤 {autor.nombre}{autor.apellido ? ` ${autor.apellido}` : ''}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'Montserrat,sans-serif' }}>
                      💬 {t.replies_count ?? 0} respuesta{(t.replies_count ?? 0) !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'Montserrat,sans-serif' }}>
                      {timeAgo(t.last_activity_at ?? t.created_at)}
                    </span>
                  </div>
                </div>

                {/* Unsave button */}
                <button
                  onClick={() => unsave(row.topic_id)}
                  title="Quitar de guardados"
                  style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 6,
                    background: 'rgba(255,200,0,0.08)', border: '1px solid rgba(255,200,0,0.2)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: '#f59e0b',
                  }}
                >
                  🔖
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
