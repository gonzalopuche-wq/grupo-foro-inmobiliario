'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

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
  { key: 'evento', label: 'Nuevo evento GFI', bloque: 'Comunidad' },
  { key: 'noticia', label: 'Noticias del sector', bloque: 'Comunidad' },
  { key: 'suscripcion', label: 'Aviso de vencimiento', bloque: 'Sistema' },
]

const BLOQUES = ['MIR', 'CRM', 'Mi Web', 'Foro', 'Comunidad', 'Sistema']

type ConfigMap = Record<string, Record<string, boolean>>

const defaultConfig = (): ConfigMap => {
  const cfg: ConfigMap = {}
  for (const m of MODULOS_CONFIG) {
    cfg[m.key] = { push: true, email: false, whatsapp: false }
  }
  return cfg
}

export default function NotificacionesPage() {
  const [userId, setUserId] = useState('')
  const [config, setConfig] = useState<ConfigMap>(defaultConfig())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pushActivo, setPushActivo] = useState(false)

  const mostrarToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)

      // Check push permission
      if ('Notification' in window) {
        setPushActivo(Notification.permission === 'granted')
      }

      // Load config from perfil or use defaults
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('notif_config')
        .eq('id', data.user.id)
        .single()
      if (perfil?.notif_config) setConfig(perfil.notif_config as ConfigMap)
      setCargando(false)
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

  const solicitarPush = async () => {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setPushActivo(perm === 'granted')
    if (perm === 'granted') mostrarToast('✅ Notificaciones push activadas')
    else mostrarToast('⚠️ Permiso denegado por el navegador')
  }

  const guardar = async () => {
    setGuardando(true)
    await supabase.from('perfiles').update({ notif_config: config }).eq('id', userId)
    setGuardando(false)
    mostrarToast('✅ Preferencias guardadas')
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0 64px' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulo 112</div>
        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Notificaciones</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Configurá qué alertas recibís y por qué canal</p>
      </div>

      {/* Push banner */}
      {!pushActivo && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>🔔 Notificaciones push desactivadas</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Activá las notificaciones del navegador para recibir alertas en tiempo real</div>
          </div>
          <button onClick={solicitarPush} style={{ padding: '8px 16px', background: '#f59e0b', color: '#000', borderRadius: 6, border: 'none', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Activar push
          </button>
        </div>
      )}

      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
      ) : (
        <>
          {/* Cabecera canales */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                Módulo
              </div>
              {CANALES.map(c => (
                <div key={c.key} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14 }}>{c.icon}</div>
                  <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>{c.label}</div>
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
                  <div style={{ padding: '8px 16px 4px', fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)' }}>
                    {bloque}
                  </div>
                  {items.map((m, idx) => (
                    <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px', padding: '10px 16px', borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{m.label}</div>
                      {CANALES.map(c => (
                        <div key={c.key} style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            onClick={() => toggle(m.key, c.key)}
                            style={{
                              width: 36, height: 20, borderRadius: 10,
                              background: config[m.key]?.[c.key] ? '#cc0000' : 'rgba(255,255,255,0.08)',
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
              style={{ padding: '10px 28px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}
            >
              {guardando ? 'Guardando...' : 'Guardar preferencias'}
            </button>
          </div>

          <p style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', fontFamily: 'Montserrat,sans-serif' }}>
            Los canales Email y WhatsApp se envían al correo y teléfono de tu perfil.
          </p>
        </>
      )}
    </div>
  )
}
