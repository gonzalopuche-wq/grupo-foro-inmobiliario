'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Periodo = 'semana' | 'mes' | 'anio'

interface Stats {
  propiedades: number
  propiedades_activas: number
  contactos: number
  contactos_nuevos: number
  negocios: number
  negocios_cerrados: number
  tareas: number
  tareas_completadas: number
  busquedas_mir: number
  matches_mir: number
  tasaciones: number
  interacciones: number
}

interface NegocioPorEtapa { etapa: string; count: number }

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes',    label: 'Este mes' },
  { key: 'anio',   label: 'Este año' },
]

function fechaDesde(p: Periodo): string {
  const now = new Date()
  if (p === 'semana') { now.setDate(now.getDate() - 7) }
  else if (p === 'mes') { now.setMonth(now.getMonth() - 1) }
  else { now.setFullYear(now.getFullYear() - 1) }
  return now.toISOString()
}

const ETAPAS_COLOR: Record<string, string> = {
  prospecto: '#6b7280', contactado: '#3b82f6', visita: '#f59e0b',
  oferta: '#f97316', negociacion: '#8b5cf6', cerrado: '#22c55e', perdido: '#ef4444',
}

export default function ReportesPage() {
  const [userId, setUserId] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [stats, setStats] = useState<Stats | null>(null)
  const [etapas, setEtapas] = useState<NegocioPorEtapa[]>([])
  const [tiposContacto, setTiposContacto] = useState<{ tipo: string; count: number }[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)
      cargar(data.user.id, 'mes')
    })
  }, [])

  const cargar = async (uid: string, p: Periodo) => {
    setCargando(true)
    const desde = fechaDesde(p)

    const [
      { data: props },
      { data: contactos },
      { data: negocios },
      { data: tareas },
      { data: busquedas },
      { data: interacciones },
      { data: tasaciones },
    ] = await Promise.all([
      supabase.from('cartera_propiedades').select('id, estado').eq('perfil_id', uid),
      supabase.from('crm_contactos').select('id, tipo, created_at').eq('perfil_id', uid),
      supabase.from('crm_negocios').select('id, etapa, created_at').eq('perfil_id', uid),
      supabase.from('crm_tareas').select('id, completada, created_at').eq('perfil_id', uid),
      supabase.from('mir_busquedas').select('id, created_at').eq('perfil_id', uid),
      supabase.from('crm_interacciones').select('id, created_at').eq('perfil_id', uid),
      supabase.from('tasaciones_historial').select('id, created_at').eq('perfil_id', uid),
    ])

    const propList = props ?? []
    const contactList = contactos ?? []
    const negocioList = negocios ?? []
    const tareaList = tareas ?? []
    const busqList = busquedas ?? []
    const intList = interacciones ?? []
    const tasacionList = tasaciones ?? []

    setStats({
      propiedades: propList.length,
      propiedades_activas: propList.filter((p: any) => p.estado === 'activa' || p.estado === 'disponible').length,
      contactos: contactList.length,
      contactos_nuevos: contactList.filter((c: any) => c.created_at >= desde).length,
      negocios: negocioList.length,
      negocios_cerrados: negocioList.filter((n: any) => n.etapa === 'cerrado').length,
      tareas: tareaList.length,
      tareas_completadas: tareaList.filter((t: any) => t.completada).length,
      busquedas_mir: busqList.filter((b: any) => b.created_at >= desde).length,
      matches_mir: 0,
      tasaciones: tasacionList.filter((t: any) => t.created_at >= desde).length,
      interacciones: intList.filter((i: any) => i.created_at >= desde).length,
    })

    // Negocios por etapa
    const etapaMap: Record<string, number> = {}
    for (const n of negocioList as any[]) {
      etapaMap[n.etapa] = (etapaMap[n.etapa] || 0) + 1
    }
    setEtapas(Object.entries(etapaMap).map(([etapa, count]) => ({ etapa, count })).sort((a, b) => b.count - a.count))

    // Contactos por tipo
    const tipoMap: Record<string, number> = {}
    for (const c of contactList as any[]) {
      const t = c.tipo || 'otro'
      tipoMap[t] = (tipoMap[t] || 0) + 1
    }
    setTiposContacto(Object.entries(tipoMap).map(([tipo, count]) => ({ tipo, count })).sort((a, b) => b.count - a.count))

    setCargando(false)
  }

  const cambiarPeriodo = (p: Periodo) => {
    setPeriodo(p)
    if (userId) cargar(userId, p)
  }

  const METRICAS_PRINCIPALES = stats ? [
    { label: 'Propiedades en cartera', valor: stats.propiedades, sub: `${stats.propiedades_activas} activas`, color: '#3b82f6', icon: '🏠' },
    { label: 'Contactos CRM', valor: stats.contactos, sub: `+${stats.contactos_nuevos} en el período`, color: '#22c55e', icon: '👥' },
    { label: 'Negocios', valor: stats.negocios, sub: `${stats.negocios_cerrados} cerrados`, color: '#f59e0b', icon: '🤝' },
    { label: 'Interacciones', valor: stats.interacciones, sub: 'en el período', color: '#8b5cf6', icon: '💬' },
    { label: 'Tasaciones IA', valor: stats.tasaciones, sub: 'en el período', color: '#cc0000', icon: '📊' },
    { label: 'Búsquedas MIR', valor: stats.busquedas_mir, sub: 'en el período', color: '#f97316', icon: '🔄' },
  ] : []

  const maxEtapa = etapas.reduce((m, e) => Math.max(m, e.count), 1)

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 0 64px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulo 62</div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Panel de Reportes</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Métricas de tu actividad como corredor GFI</p>
        </div>
        {/* Selector de período */}
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => cambiarPeriodo(p.key)} style={{ padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: periodo === p.key ? 'rgba(204,0,0,0.15)' : 'rgba(255,255,255,0.04)', color: periodo === p.key ? '#ff6666' : 'rgba(255,255,255,0.4)', outline: periodo === p.key ? '1px solid rgba(204,0,0,0.35)' : 'none' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '56px 0' }}>Cargando métricas...</div>
      ) : (
        <>
          {/* Grid métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
            {METRICAS_PRINCIPALES.map(m => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</span>
                </div>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 32, fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.valor}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Pipeline por etapas */}
          {etapas.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 16 }}>Pipeline de negocios por etapa</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {etapas.map(e => {
                  const color = ETAPAS_COLOR[e.etapa] ?? '#6b7280'
                  const pct = Math.round((e.count / maxEtapa) * 100)
                  return (
                    <div key={e.etapa}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>{e.etapa}</span>
                        <span style={{ fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color }}>{e.count}</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contactos por tipo */}
          {tiposContacto.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 14 }}>Contactos CRM por tipo</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {tiposContacto.map(t => (
                  <div key={t.tipo} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 800, color: '#fff' }}>{t.count}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{t.tipo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tareas */}
          {stats && stats.tareas > 0 && (
            <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>Tareas CRM</div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 28, fontWeight: 800, color: '#22c55e' }}>{stats.tareas_completadas}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Completadas</div>
                </div>
                <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.15)' }}>·</div>
                <div>
                  <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{stats.tareas - stats.tareas_completadas}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Pendientes</div>
                </div>
                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginLeft: 8 }}>
                  <div style={{ height: '100%', width: `${Math.round((stats.tareas_completadas / stats.tareas) * 100)}%`, background: '#22c55e', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: '#22c55e', minWidth: 36 }}>
                  {Math.round((stats.tareas_completadas / stats.tareas) * 100)}%
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
