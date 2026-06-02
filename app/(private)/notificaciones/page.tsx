'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import ActivarNotificaciones from '../../components/ActivarNotificaciones'

interface Notificacion {
  id: string
  titulo: string
  mensaje: string | null
  tipo: string | null
  url: string | null
  leida: boolean
  created_at: string
}

const TIPO_ICON: Record<string, string> = {
  cartera: '🏘️', mir: '🔗', crm: '👥', web_lead: '📬', suscripcion: '💳',
  foro: '💬', evento: '📅', smart: '🎯', sistema: '⚙️',
}
const TIPO_COLOR: Record<string, string> = {
  cartera: '#4ab8d8', mir: '#34d399', crm: '#a78bfa', web_lead: '#fb923c',
  suscripcion: '#f87171', foro: '#d4960c', evento: '#38bdf8', smart: '#f472b6', sistema: 'var(--gfi-text-muted)',
}

function tipoIcon(tipo: string | null) { return TIPO_ICON[tipo ?? ''] ?? '🔔' }
function tipoColor(tipo: string | null) { return TIPO_COLOR[tipo ?? ''] ?? 'var(--gfi-text-secondary)' }

function fmtFecha(iso: string) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'Ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

interface NotifConfig {
  canal: 'push' | 'email' | 'whatsapp'
  modulo: string
  activo: boolean
}

const CANALES = [
  { key: 'push', label: 'Push', icon: '🔔', desc: 'Notificaciones en el navegador' },
  { key: 'email', label: 'Email', icon: '✉️', desc: 'Al correo registrado' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬', desc: 'Al número de perfil' },
] as const

const MODULOS_CONFIG = [
  { key: 'mir_match', label: 'Nuevos matches MIR', bloque: 'MIR' },
  { key: 'mir_ofrecido', label: 'Nuevo ofrecido en tu zona', bloque: 'MIR' },
  { key: 'smart_prospecting', label: 'Smart Prospecting: propiedad compatible', bloque: 'CRM' },
  { key: 'crm_recordatorio', label: 'Recordatorios de seguimiento', bloque: 'CRM' },
  { key: 'crm_tarea', label: 'Tareas vencidas', bloque: 'CRM' },
  { key: 'web_lead', label: 'Nuevo lead desde tu web', bloque: 'Mi Web' },
  { key: 'foro_respuesta', label: 'Respuesta en el foro', bloque: 'Foro' },
  { key: 'networking_nuevo', label: 'Nueva publicación en Networking', bloque: 'Networking' },
  { key: 'evento', label: 'Nuevo evento GFI', bloque: 'Comunidad' },
  { key: 'noticia', label: 'Noticias del sector', bloque: 'Comunidad' },
  { key: 'canal_en_vivo', label: 'Transmisión en vivo — Canal del Foro', bloque: 'Comunidad' },
  { key: 'suscripcion', label: 'Aviso de vencimiento', bloque: 'Sistema' },
]

const BLOQUES = ['MIR', 'CRM', 'Mi Web', 'Foro', 'Networking', 'Comunidad', 'Sistema']

type ConfigMap = Record<string, Record<string, boolean>>

const defaultConfig = (): ConfigMap => {
  const cfg: ConfigMap = {}
  for (const m of MODULOS_CONFIG) {
    cfg[m.key] = { push: true, email: false, whatsapp: false }
  }
  return cfg
}

export default function NotificacionesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [tab, setTab] = useState<'bandeja' | 'config'>('bandeja')
  const [config, setConfig] = useState<ConfigMap>(defaultConfig())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const [cargandoNotifs, setCargandoNotifs] = useState(true)
  const mostrarToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const cargarNotifs = async (uid: string) => {
    const { data } = await supabase
      .from('notificaciones')
      .select('id, titulo, mensaje, tipo, url, leida, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifs((data as Notificacion[]) ?? [])
    setCargandoNotifs(false)
  }

  const marcarLeida = async (id: string, url: string | null) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    if (url) router.push(url)
  }

  const marcarTodasLeidas = async () => {
    if (!userId) return
    await supabase.from('notificaciones').update({ leida: true }).eq('user_id', userId).eq('leida', false)
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
    mostrarToast('Todas marcadas como leídas')
  }

  const eliminar = async (id: string) => {
    await supabase.from('notificaciones').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const uid = data.user.id
      setUserId(uid)
      await Promise.all([
        cargarNotifs(uid),
        (async () => {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('notif_config')
            .eq('id', uid)
            .single()
          if (perfil?.notif_config) setConfig(perfil.notif_config as ConfigMap)
          setCargando(false)
        })(),
      ])
    })
  }, [])

  const toggle = (modulo: string, canal: string) => {
    setConfig(prev => ({
      ...prev,
      [modulo]: { ...prev[modulo], [canal]: !prev[modulo]?.[canal] }
    }))
  }

  const toggleTodoCanal = (canal: string, valor: boolean) => {
    setConfig(prev => {
      const next = { ...prev }
      for (const m of MODULOS_CONFIG) next[m.key] = { ...next[m.key], [canal]: valor }
      return next
    })
  }

  const guardar = async () => {
    setGuardando(true)
    await supabase.from('perfiles').update({ notif_config: config }).eq('id', userId)
    setGuardando(false)
    mostrarToast('✅ Preferencias guardadas')
  }

  const noLeidas = notifs.filter(n => !n.leida).length

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0 64px' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--gfi-bg-secondary)', border: '1px solid var(--gfi-border)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Notificaciones</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--gfi-border-subtle)', paddingBottom: 0 }}>
        {([['bandeja', '🔔 Bandeja', noLeidas], ['config', '⚙️ Configuración', 0]] as const).map(([t, label, badge]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? '#990000' : 'transparent'}`, color: tab === t ? '#fff' : 'var(--gfi-text-muted)', fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer', transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 }}>
            {label}
            {badge > 0 && <span style={{ background: '#990000', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif' }}>{badge}</span>}
          </button>
        ))}
      </div>

      {/* BANDEJA */}
      {tab === 'bandeja' && (
        <div>
          {noLeidas > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={marcarTodasLeidas} style={{ background: 'none', border: '1px solid var(--gfi-border)', borderRadius: 6, color: 'var(--gfi-text-muted)', fontSize: 11, fontWeight: 600, padding: '5px 14px', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                Marcar todas como leídas
              </button>
            </div>
          )}
          {cargandoNotifs ? (
            <div style={{ color: 'var(--gfi-text-muted)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
          ) : notifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 14, color: 'var(--gfi-text-muted)' }}>No tenés notificaciones todavía</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {notifs.map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: n.leida ? 'var(--gfi-bg-secondary)' : 'var(--gfi-bg-elevated)', border: `1px solid ${n.leida ? 'var(--gfi-border-subtle)' : 'var(--gfi-border)'}`, borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onClick={() => marcarLeida(n.id, n.url)}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${tipoColor(n.tipo)}15`, border: `1px solid ${tipoColor(n.tipo)}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {tipoIcon(n.tipo)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: n.leida ? 500 : 700, color: n.leida ? 'var(--gfi-text-secondary)' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.titulo}</span>
                      {!n.leida && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#990000', flexShrink: 0 }} />}
                    </div>
                    {n.mensaje && <div style={{ fontSize: 12, color: 'var(--gfi-text-muted)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.mensaje}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--gfi-text-dim)', fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' }}>{fmtFecha(n.created_at)}</span>
                    <button onClick={e => { e.stopPropagation(); eliminar(n.id) }} style={{ background: 'none', border: 'none', color: 'var(--gfi-text-dim)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px' }} title="Eliminar">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONFIG */}
      {tab === 'config' && <>
      {/* Push — activar en este dispositivo */}
      <div style={{ background: 'var(--gfi-bg-card)', border: '1px solid var(--gfi-border-subtle)', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gfi-text-primary)', marginBottom: 8 }}>🔔 Push en este dispositivo</div>
        {userId && <ActivarNotificaciones userId={userId} />}
      </div>

      {cargando ? (
        <div style={{ color: 'var(--gfi-text-muted)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
      ) : (
        <>
          {/* Cabecera canales */}
          <div style={{ background: 'var(--gfi-bg-card)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--gfi-bg-secondary)' }}>
              <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--gfi-text-muted)', textTransform: 'uppercase' }}>
                Módulo
              </div>
              {CANALES.map(c => (
                <div key={c.key} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14 }}>{c.icon}</div>
                  <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: 'var(--gfi-text-muted)', letterSpacing: '0.08em' }}>{c.label}</div>
                  <button
                    onClick={() => {
                      const allOn = MODULOS_CONFIG.every(m => config[m.key]?.[c.key])
                      toggleTodoCanal(c.key, !allOn)
                    }}
                    style={{ fontSize: 9, color: 'rgba(200,0,0,0.7)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}
                  >
                    {MODULOS_CONFIG.every(m => config[m.key]?.[c.key]) ? 'Desact. todo' : 'Act. todo'}
                  </button>
                </div>
              ))}
            </div>

            {/* Rows by bloque */}
            {BLOQUES.map(bloque => {
              const items = MODULOS_CONFIG.filter(m => m.bloque === bloque)
              return (
                <div key={bloque}>
                  <div style={{ padding: '8px 16px 4px', fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gfi-text-dim)', background: 'rgba(0,0,0,0.2)' }}>
                    {bloque}
                  </div>
                  {items.map((m, idx) => (
                    <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px', padding: '10px 16px', borderBottom: idx < items.length - 1 ? '1px solid var(--gfi-bg-card)' : 'none', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, color: 'var(--gfi-text-primary)' }}>{m.label}</div>
                      {CANALES.map(c => (
                        <div key={c.key} style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            onClick={() => toggle(m.key, c.key)}
                            style={{
                              width: 36, height: 20, borderRadius: 10,
                              background: config[m.key]?.[c.key] ? '#990000' : 'var(--gfi-border)',
                              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                            }}
                          >
                            <div style={{
                              width: 14, height: 14, borderRadius: '50%', background: '#fff',
                              position: 'absolute', top: 3,
                              left: config[m.key]?.[c.key] ? 19 : 3,
                              transition: 'left 0.2s',
                            }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={guardar}
              disabled={guardando}
              style={{ padding: '10px 28px', background: '#990000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}
            >
              {guardando ? 'Guardando...' : 'Guardar preferencias'}
            </button>
          </div>

          <p style={{ marginTop: 20, fontSize: 11, color: 'var(--gfi-text-dim)', textAlign: 'center', fontFamily: 'Montserrat,sans-serif' }}>
            Los canales Email y WhatsApp se envían al correo y teléfono de tu perfil.
          </p>
        </>
      )}
      </>}

    </div>
  )
}
