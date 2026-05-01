'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface EventoItem {
  id: string
  titulo: string
  fecha: string
  hora: string | null
  tipo: 'recordatorio' | 'evento' | 'tarea' | 'visita'
  estado: string
  descripcion: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  fuente: 'crm_recordatorios' | 'eventos' | 'crm_tareas'
}

const TIPOS_COLOR: Record<string, { color: string; bg: string; icon: string }> = {
  recordatorio: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🔔' },
  evento:       { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '📅' },
  tarea:        { color: '#a855f7', bg: 'rgba(168,85,247,0.1)', icon: '✓' },
  visita:       { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '🏠' },
}

function esFuturo(fecha: string, hora?: string | null) {
  const d = hora ? new Date(`${fecha}T${hora}`) : new Date(fecha + 'T23:59:00')
  return d >= new Date()
}

function esHoy(fecha: string) {
  return fecha === new Date().toISOString().split('T')[0]
}

function diasDesde(fecha: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function labelFecha(fecha: string): string {
  const diff = diasDesde(fecha)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff < 0) return `Hace ${Math.abs(diff)} días`
  if (diff < 7) return `En ${diff} días`
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function AgendaPage() {
  const [userId, setUserId] = useState('')
  const [items, setItems] = useState<EventoItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<'semana' | 'mes' | 'lista'>('lista')
  const [filtro, setFiltro] = useState<string>('proximos')
  const [hoy] = useState(new Date())
  const [mesVista, setMesVista] = useState(new Date())

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)
      cargar(data.user.id)
    })
  }, [])

  const cargar = async (uid: string) => {
    setCargando(true)

    const [{ data: recordatorios }, { data: eventos }, { data: tareas }] = await Promise.all([
      supabase.from('crm_recordatorios').select('*, contacto:crm_contactos(nombre, apellido, telefono)').eq('perfil_id', uid).neq('estado', 'completado'),
      supabase.from('eventos_agenda').select('*').eq('usuario_id', uid),
      supabase.from('crm_tareas').select('*').eq('perfil_id', uid).neq('completada', true).not('fecha_vencimiento', 'is', null),
    ])

    const all: EventoItem[] = [
      ...((recordatorios ?? []).map((r: any) => ({
        id: `rec-${r.id}`,
        titulo: r.titulo,
        fecha: r.fecha_recordatorio?.split('T')[0] ?? '',
        hora: r.fecha_recordatorio?.split('T')[1]?.substring(0, 5) ?? null,
        tipo: 'recordatorio' as const,
        estado: r.estado,
        descripcion: r.notas ?? null,
        contacto_nombre: r.contacto ? `${r.contacto.nombre ?? ''} ${r.contacto.apellido ?? ''}`.trim() : null,
        contacto_telefono: r.contacto?.telefono ?? null,
        fuente: 'crm_recordatorios' as const,
      }))),
      ...((eventos ?? []).map((e: any) => ({
        id: `evt-${e.id}`,
        titulo: e.titulo ?? e.nombre ?? '',
        fecha: e.fecha?.split('T')[0] ?? '',
        hora: e.hora ?? null,
        tipo: 'evento' as const,
        estado: 'activo',
        descripcion: e.descripcion ?? null,
        contacto_nombre: null,
        contacto_telefono: null,
        fuente: 'eventos' as const,
      }))),
      ...((tareas ?? []).map((t: any) => ({
        id: `tar-${t.id}`,
        titulo: t.titulo,
        fecha: t.fecha_vencimiento?.split('T')[0] ?? '',
        hora: null,
        tipo: 'tarea' as const,
        estado: t.completada ? 'completada' : 'pendiente',
        descripcion: t.descripcion ?? null,
        contacto_nombre: null,
        contacto_telefono: null,
        fuente: 'crm_tareas' as const,
      }))),
    ]

    all.sort((a, b) => (a.fecha + (a.hora ?? '23:59')).localeCompare(b.fecha + (b.hora ?? '23:59')))
    setItems(all.filter(i => i.fecha))
    setCargando(false)
  }

  const filtrados = (() => {
    const hoyStr = hoy.toISOString().split('T')[0]
    if (filtro === 'hoy') return items.filter(i => i.fecha === hoyStr)
    if (filtro === 'proximos') {
      const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7)
      return items.filter(i => i.fecha >= hoyStr && i.fecha <= en7.toISOString().split('T')[0])
    }
    if (filtro === 'vencidos') return items.filter(i => i.fecha < hoyStr)
    return items
  })()

  const hoyItems = items.filter(i => esHoy(i.fecha))
  const proxItems = items.filter(i => {
    const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7)
    return i.fecha > hoy.toISOString().split('T')[0] && i.fecha <= en7.toISOString().split('T')[0]
  })
  const vencidos = items.filter(i => i.fecha < hoy.toISOString().split('T')[0])

  // Calendario mensual
  const primerDia = new Date(mesVista.getFullYear(), mesVista.getMonth(), 1)
  const ultimoDia = new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0)
  const diasMes: Date[] = []
  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    diasMes.push(new Date(mesVista.getFullYear(), mesVista.getMonth(), d))
  }
  const offsetInicio = primerDia.getDay()
  const totalCeldas = Math.ceil((offsetInicio + diasMes.length) / 7) * 7
  const celdas: (Date | null)[] = Array(offsetInicio).fill(null)
    .concat(diasMes)
    .concat(Array(totalCeldas - offsetInicio - diasMes.length).fill(null))

  const itemsEnDia = (fecha: Date) => {
    const str = fecha.toISOString().split('T')[0]
    return items.filter(i => i.fecha === str)
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 0 64px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Organización</div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Agenda</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            Recordatorios CRM + tareas + eventos · {hoyItems.length} para hoy
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['lista', 'mes'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 12, fontWeight: 700, background: vista === v ? '#cc0000' : 'rgba(255,255,255,0.06)', color: vista === v ? '#fff' : 'rgba(255,255,255,0.4)' }}>
              {v === 'lista' ? '≡ Lista' : '▦ Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Hoy', value: hoyItems.length, color: '#cc0000' },
          { label: 'Próximos 7 días', value: proxItems.length, color: '#f59e0b' },
          { label: 'Vencidos', value: vencidos.length, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.value > 0 ? `${s.color}30` : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer' }} onClick={() => setFiltro(s.label === 'Hoy' ? 'hoy' : s.label === 'Próximos 7 días' ? 'proximos' : 'vencidos')}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: s.value > 0 ? s.color : 'rgba(255,255,255,0.2)' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {vista === 'mes' ? (
        /* VISTA MENSUAL */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button onClick={() => setMesVista(new Date(mesVista.getFullYear(), mesVista.getMonth() - 1))} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 16 }}>‹</button>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {MESES[mesVista.getMonth()]} {mesVista.getFullYear()}
            </div>
            <button onClick={() => setMesVista(new Date(mesVista.getFullYear(), mesVista.getMonth() + 1))} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 16 }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', background: '#0a0a0a' }}>{d}</div>
            ))}
            {celdas.map((dia, i) => {
              if (!dia) return <div key={i} style={{ background: '#0a0a0a', minHeight: 72 }} />
              const diaItems = itemsEnDia(dia)
              const esHoyDia = dia.toDateString() === hoy.toDateString()
              return (
                <div key={i} style={{ background: esHoyDia ? 'rgba(204,0,0,0.08)' : '#0a0a0a', padding: '6px 4px', minHeight: 72, border: esHoyDia ? '1px solid rgba(204,0,0,0.3)' : undefined }}>
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: esHoyDia ? 800 : 400, color: esHoyDia ? '#cc0000' : 'rgba(255,255,255,0.4)', marginBottom: 4, fontFamily: 'Montserrat,sans-serif' }}>{dia.getDate()}</div>
                  {diaItems.slice(0, 3).map((item, j) => {
                    const tc = TIPOS_COLOR[item.tipo]
                    return (
                      <div key={j} style={{ fontSize: 9, color: tc.color, background: tc.bg, padding: '2px 4px', borderRadius: 3, marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {item.titulo}
                      </div>
                    )
                  })}
                  {diaItems.length > 3 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>+{diaItems.length - 3}</div>}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* VISTA LISTA */
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { k: 'proximos', label: 'Próximos 7 días' },
              { k: 'hoy', label: 'Hoy' },
              { k: 'vencidos', label: 'Vencidos' },
              { k: 'todos', label: 'Todos' },
            ].map(f => (
              <button key={f.k} onClick={() => setFiltro(f.k)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: filtro === f.k ? '#cc0000' : 'rgba(255,255,255,0.06)', color: filtro === f.k ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                {f.label}
              </button>
            ))}
          </div>

          {cargando ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0' }}>Cargando agenda...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginBottom: 8 }}>
                {filtro === 'hoy' ? 'Sin compromisos para hoy' : filtro === 'proximos' ? 'Sin eventos próximos' : filtro === 'vencidos' ? '¡Todo al día!' : 'Sin eventos'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Los recordatorios CRM y tareas aparecen automáticamente aquí</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtrados.map((item, i) => {
                const tc = TIPOS_COLOR[item.tipo]
                const vencido = item.fecha < hoy.toISOString().split('T')[0]
                const esHoyItem = esHoy(item.fecha)
                const prevFecha = i > 0 ? filtrados[i - 1].fecha : null
                const mostrarSeparador = item.fecha !== prevFecha

                return (
                  <div key={item.id}>
                    {mostrarSeparador && (
                      <div style={{ fontSize: 11, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: esHoyItem ? '#cc0000' : vencido ? '#ef4444' : 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '12px 0 6px' }}>
                        {labelFecha(item.fecha)}
                        {esHoyItem && <span style={{ marginLeft: 8, background: '#cc0000', color: '#fff', padding: '1px 7px', borderRadius: 10, fontSize: 9 }}>HOY</span>}
                        {vencido && <span style={{ marginLeft: 8, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '1px 7px', borderRadius: 10, fontSize: 9 }}>VENCIDO</span>}
                      </div>
                    )}
                    <div style={{ background: `${vencido ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.03)'}`, border: `1px solid ${vencido ? 'rgba(239,68,68,0.15)' : esHoyItem ? 'rgba(204,0,0,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: tc.bg, border: `1px solid ${tc.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                        {tc.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: vencido ? 'rgba(255,255,255,0.5)' : '#fff', marginBottom: 2 }}>{item.titulo}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: tc.color, background: tc.bg, padding: '2px 7px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{item.tipo}</span>
                          {item.hora && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>🕐 {item.hora}</span>}
                          {item.contacto_nombre && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{item.contacto_nombre}</span>}
                          {item.descripcion && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{item.descripcion}</span>}
                        </div>
                      </div>
                      {item.contacto_telefono && (
                        <a href={`https://wa.me/${item.contacto_telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 7, color: '#22c55e', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat,sans-serif', flexShrink: 0 }}>
                          💬
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
