'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

interface Recordatorio {
  id: string
  contacto_id: string
  descripcion: string
  fecha_recordatorio: string
  completado: boolean
  created_at: string
  contacto?: { nombre: string; apellido: string | null; telefono: string | null }
}

type Filtro = 'todos' | 'pendientes' | 'vencidos' | 'completados'

function isVencido(fecha: string) {
  return !isNaN(Date.parse(fecha)) && new Date(fecha) < new Date()
}

function fmtFecha(fecha: string) {
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return fecha
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtHora(fecha: string) {
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function RecordatoriosPage() {
  const [userId, setUserId] = useState('')
  const [items, setItems] = useState<Recordatorio[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
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
      .from('crm_recordatorios')
      .select('*, contacto:crm_contactos(nombre, apellido, telefono)')
      .eq('perfil_id', uid)
      .order('fecha_recordatorio', { ascending: true })
    setItems((data as Recordatorio[]) ?? [])
    setCargando(false)
  }

  const toggleCompletar = async (r: Recordatorio) => {
    await supabase.from('crm_recordatorios').update({ completado: !r.completado }).eq('id', r.id)
    setItems(prev => prev.map(x => x.id === r.id ? { ...x, completado: !x.completado } : x))
    mostrarToast(r.completado ? 'Marcado como pendiente' : '✅ Completado')
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este recordatorio?')) return
    await supabase.from('crm_recordatorios').delete().eq('id', id)
    setItems(prev => prev.filter(x => x.id !== id))
    mostrarToast('Recordatorio eliminado')
  }

  const filtrados = items.filter(r => {
    if (filtro === 'completados') return r.completado
    if (filtro === 'pendientes') return !r.completado
    if (filtro === 'vencidos') return !r.completado && isVencido(r.fecha_recordatorio)
    return true
  })

  const counts = {
    todos: items.length,
    pendientes: items.filter(r => !r.completado).length,
    vencidos: items.filter(r => !r.completado && isVencido(r.fecha_recordatorio)).length,
    completados: items.filter(r => r.completado).length,
  }

  const FILTROS: { key: Filtro; label: string; color: string }[] = [
    { key: 'pendientes', label: 'Pendientes', color: '#f59e0b' },
    { key: 'vencidos',   label: 'Vencidos',   color: '#ef4444' },
    { key: 'completados',label: 'Completados', color: '#22c55e' },
    { key: 'todos',      label: 'Todos',       color: 'rgba(255,255,255,0.5)' },
  ]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 0 64px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>
          CRM GFI®
        </div>
        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
          Recordatorios
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4, margin: 0 }}>
          Todos tus recordatorios de seguimiento en un solo lugar
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700,
              background: filtro === f.key ? f.color + '22' : 'rgba(255,255,255,0.04)',
              color: filtro === f.key ? f.color : 'rgba(255,255,255,0.35)',
              outline: filtro === f.key ? `1px solid ${f.color}44` : 'none',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
            <span style={{ marginLeft: 6, opacity: 0.6 }}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '48px 0', textAlign: 'center' }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
          {filtro === 'vencidos' ? '✅ Sin recordatorios vencidos' : 'No hay recordatorios en esta categoría'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map(r => {
            const vencido = !r.completado && isVencido(r.fecha_recordatorio)
            const contacto = r.contacto
            return (
              <div key={r.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${r.completado ? 'rgba(34,197,94,0.12)' : vencido ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
                opacity: r.completado ? 0.55 : 1,
                transition: 'opacity 0.2s',
              }}>
                {/* Checkbox */}
                <button
                  onClick={() => toggleCompletar(r)}
                  title={r.completado ? 'Marcar como pendiente' : 'Marcar como completado'}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    border: `2px solid ${r.completado ? '#22c55e' : vencido ? '#ef4444' : 'rgba(255,255,255,0.2)'}`,
                    background: r.completado ? 'rgba(34,197,94,0.15)' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: r.completado ? '#22c55e' : 'transparent',
                  }}
                >
                  ✓
                </button>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, color: r.completado ? 'rgba(255,255,255,0.4)' : '#fff',
                    fontWeight: 500, lineHeight: 1.4,
                    textDecoration: r.completado ? 'line-through' : 'none',
                    marginBottom: 6,
                  }}>
                    {r.descripcion}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Fecha */}
                    <span style={{
                      fontSize: 11, fontFamily: 'Montserrat,sans-serif', fontWeight: 700,
                      color: r.completado ? 'rgba(255,255,255,0.25)' : vencido ? '#ef4444' : 'rgba(255,255,255,0.4)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {vencido ? '⚠️' : '📅'} {fmtFecha(r.fecha_recordatorio)} {fmtHora(r.fecha_recordatorio)}
                    </span>

                    {/* Contacto */}
                    {contacto && (
                      <Link
                        href={`/crm?contacto=${r.contacto_id}`}
                        style={{
                          fontSize: 11, color: 'rgba(200,0,0,0.8)', fontWeight: 600,
                          fontFamily: 'Montserrat,sans-serif',
                          display: 'flex', alignItems: 'center', gap: 4,
                          textDecoration: 'none',
                        }}
                      >
                        👤 {contacto.nombre}{contacto.apellido ? ` ${contacto.apellido}` : ''}
                      </Link>
                    )}

                    {/* Badge vencido */}
                    {vencido && (
                      <span style={{
                        fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700,
                        background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                        padding: '2px 8px', borderRadius: 10,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                      }}>
                        Vencido
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {contacto?.telefono && !r.completado && (
                    <a
                      href={`https://wa.me/${(contacto.telefono as string).replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                      style={{
                        width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                        fontSize: 13, textDecoration: 'none', cursor: 'pointer',
                      }}
                    >
                      💬
                    </a>
                  )}
                  <button
                    onClick={() => eliminar(r.id)}
                    title="Eliminar"
                    style={{
                      width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
                      fontSize: 13, cursor: 'pointer', color: 'rgba(255,255,255,0.25)',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tip */}
      {!cargando && (
        <p style={{ marginTop: 32, fontSize: 11, color: 'rgba(255,255,255,0.18)', textAlign: 'center', fontFamily: 'Montserrat,sans-serif' }}>
          Los recordatorios se crean desde la ficha de cada contacto en CRM.
        </p>
      )}
    </div>
  )
}
