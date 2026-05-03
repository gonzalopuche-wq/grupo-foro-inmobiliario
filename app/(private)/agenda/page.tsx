'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

/* ─── Tipos ─────────────────────────────────────────────────────────── */
type TipoEvento = 'cita' | 'recordatorio' | 'evento' | 'tarea' | 'visita'

interface EventoItem {
  id: string
  titulo: string
  fecha: string
  hora: string | null
  hora_fin: string | null
  tipo: TipoEvento
  estado: string
  descripcion: string | null
  lugar: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  fuente: 'agenda' | 'crm_recordatorios' | 'crm_tareas' | 'gcal'
  gcal_event_id?: string | null
}

const TIPOS_COLOR: Record<TipoEvento, { color: string; bg: string; icon: string; label: string }> = {
  cita:         { color: '#cc0000', bg: 'rgba(204,0,0,0.1)',    icon: '📌', label: 'Cita' },
  recordatorio: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🔔', label: 'Recordatorio' },
  evento:       { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '📅', label: 'Evento' },
  tarea:        { color: '#a855f7', bg: 'rgba(168,85,247,0.1)', icon: '✓',  label: 'Tarea' },
  visita:       { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  icon: '🏠', label: 'Visita' },
}

const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const GCAL_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar'

const FORM_VACIO = {
  titulo: '', fecha: new Date().toISOString().split('T')[0],
  hora: '10:00', hora_fin: '11:00', tipo: 'cita' as TipoEvento,
  descripcion: '', lugar: '',
}

function diasDesde(fecha: string): number {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const d = new Date(fecha); d.setHours(0,0,0,0)
  return Math.round((d.getTime() - hoy.getTime()) / 86400000)
}

function labelFecha(fecha: string): string {
  const diff = diasDesde(fecha)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff < 0) return `Hace ${Math.abs(diff)} días`
  if (diff < 7) return `En ${diff} días`
  return new Date(fecha+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})
}

function gcalUrl(ev: { titulo:string; fecha:string; hora:string|null; hora_fin:string|null; descripcion:string|null; lugar:string|null }) {
  const fmt = (d: string, h: string) => `${d.replace(/-/g,'')}T${h.replace(':','')}00`
  const start = ev.hora ? fmt(ev.fecha, ev.hora) : ev.fecha.replace(/-/g,'')
  const end   = ev.hora_fin ? fmt(ev.fecha, ev.hora_fin) : (ev.hora ? fmt(ev.fecha, ev.hora) : ev.fecha.replace(/-/g,''))
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.titulo,
    dates: `${start}/${end}`,
    ...(ev.descripcion ? { details: ev.descripcion } : {}),
    ...(ev.lugar       ? { location: ev.lugar } : {}),
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

export default function AgendaPage() {
  const [uid, setUid] = useState('')
  const [items, setItems] = useState<EventoItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<'lista'|'mes'>('lista')
  const [filtro, setFiltro] = useState('proximos')
  const [hoy] = useState(new Date())
  const [mesVista, setMesVista] = useState(new Date())

  // Modal nueva cita
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [agregarGcal, setAgregarGcal] = useState(false)

  // Google Calendar OAuth
  const [gcalToken, setGcalToken] = useState<string|null>(null)
  const [gcalConectando, setGcalConectando] = useState(false)
  const [gcalError, setGcalError] = useState<string|null>(null)
  const tokenClientRef = useRef<any>(null)

  const [toast, setToast] = useState<string|null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), 3500)
  }

  /* ── Auth + carga inicial ─────────────────────────────────────────── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }:any) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUid(data.user.id)
      cargar(data.user.id)
    })
    // Restaurar token GCal si quedó en sessionStorage
    const tok = sessionStorage.getItem('gcal_token')
    if (tok) setGcalToken(tok)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  /* ── Cargar GCal cuando se obtiene token ──────────────────────────── */
  useEffect(() => {
    if (gcalToken && uid) cargarEventosGcal(gcalToken)
  }, [gcalToken, uid])

  /* ── Carga de datos ──────────────────────────────────────────────── */
  const cargar = async (id: string) => {
    setCargando(true)
    const [{ data: citasData }, { data: recData }, { data: tarData }] = await Promise.all([
      supabase.from('eventos_agenda').select('*').eq('usuario_id', id).order('fecha'),
      supabase.from('crm_recordatorios').select('*, contacto:crm_contactos(nombre,apellido,telefono)').eq('perfil_id', id).neq('estado','completado'),
      supabase.from('crm_tareas').select('*').eq('perfil_id', id).eq('completada', false).not('fecha_vencimiento','is',null),
    ])
    const all: EventoItem[] = [
      ...((citasData ?? []).map((e:any) => ({
        id: `ag-${e.id}`, titulo: e.titulo, fecha: e.fecha?.split('T')[0]??'',
        hora: e.hora??null, hora_fin: e.hora_fin??null,
        tipo: (e.tipo??'cita') as TipoEvento, estado: 'activo',
        descripcion: e.descripcion??null, lugar: e.lugar??null,
        contacto_nombre: null, contacto_telefono: null,
        fuente: 'agenda' as const, gcal_event_id: e.gcal_event_id??null,
      }))),
      ...((recData ?? []).map((r:any) => ({
        id: `rec-${r.id}`, titulo: r.titulo, fecha: r.fecha_recordatorio?.split('T')[0]??'',
        hora: r.fecha_recordatorio?.split('T')[1]?.slice(0,5)??null, hora_fin: null,
        tipo: 'recordatorio' as TipoEvento, estado: r.estado,
        descripcion: r.notas??null, lugar: null,
        contacto_nombre: r.contacto ? `${r.contacto.nombre??''} ${r.contacto.apellido??''}`.trim() : null,
        contacto_telefono: r.contacto?.telefono??null,
        fuente: 'crm_recordatorios' as const,
      }))),
      ...((tarData ?? []).map((t:any) => ({
        id: `tar-${t.id}`, titulo: t.titulo, fecha: t.fecha_vencimiento?.split('T')[0]??'',
        hora: null, hora_fin: null,
        tipo: 'tarea' as TipoEvento, estado: t.completada ? 'completada' : 'pendiente',
        descripcion: t.descripcion??null, lugar: null,
        contacto_nombre: null, contacto_telefono: null,
        fuente: 'crm_tareas' as const,
      }))),
    ]
    all.sort((a,b) => (a.fecha+(a.hora??'23:59')).localeCompare(b.fecha+(b.hora??'23:59')))
    setItems(prev => {
      // Mantener eventos GCal que ya estaban
      const gcalItems = prev.filter(i => i.fuente === 'gcal')
      return mergeItems([...all.filter(i=>i.fecha), ...gcalItems])
    })
    setCargando(false)
  }

  /* ── Google Calendar ─────────────────────────────────────────────── */
  const cargarGsiScript = (): Promise<void> =>
    new Promise(resolve => {
      if ((window as any).google?.accounts) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true; s.defer = true
      s.onload = () => resolve()
      document.head.appendChild(s)
    })

  const conectarGcal = async () => {
    if (!GCAL_CLIENT_ID) {
      setGcalError('Configurá NEXT_PUBLIC_GOOGLE_CLIENT_ID en las variables de entorno')
      return
    }
    setGcalConectando(true); setGcalError(null)
    try {
      await cargarGsiScript()
      const g = (window as any).google
      tokenClientRef.current = g.accounts.oauth2.initTokenClient({
        client_id: GCAL_CLIENT_ID,
        scope: GCAL_SCOPE,
        callback: (resp: any) => {
          if (resp.error) { setGcalError(`Error: ${resp.error}`); setGcalConectando(false); return }
          sessionStorage.setItem('gcal_token', resp.access_token)
          setGcalToken(resp.access_token)
          setGcalConectando(false)
          showToast('Google Calendar conectado')
        },
      })
      tokenClientRef.current.requestAccessToken()
    } catch (e: any) {
      setGcalError(e.message ?? 'Error al conectar')
      setGcalConectando(false)
    }
  }

  const desconectarGcal = () => {
    sessionStorage.removeItem('gcal_token')
    setGcalToken(null)
    setItems(prev => prev.filter(i => i.fuente !== 'gcal'))
    showToast('Google Calendar desconectado')
  }

  const cargarEventosGcal = async (token: string) => {
    try {
      const now = new Date(); now.setMonth(now.getMonth() - 1)
      const future = new Date(); future.setMonth(future.getMonth() + 3)
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.status === 401) { desconectarGcal(); return }
      const data = await res.json()
      const gcalEvs: EventoItem[] = (data.items ?? []).map((e: any) => ({
        id: `gcal-${e.id}`,
        titulo: e.summary ?? '(Sin título)',
        fecha: (e.start?.dateTime ?? e.start?.date ?? '').slice(0, 10),
        hora: e.start?.dateTime ? e.start.dateTime.slice(11, 16) : null,
        hora_fin: e.end?.dateTime ? e.end.dateTime.slice(11, 16) : null,
        tipo: 'evento' as TipoEvento,
        estado: 'activo',
        descripcion: e.description ?? null,
        lugar: e.location ?? null,
        contacto_nombre: null, contacto_telefono: null,
        fuente: 'gcal' as const,
        gcal_event_id: e.id,
      }))
      setItems(prev => mergeItems([...prev.filter(i => i.fuente !== 'gcal'), ...gcalEvs]))
    } catch { /* silent */ }
  }

  const pushEventoAGcal = async (token: string, ev: typeof form): Promise<string|null> => {
    try {
      const body: any = {
        summary: ev.titulo,
        description: ev.descripcion || undefined,
        location: ev.lugar || undefined,
        start: ev.hora
          ? { dateTime: `${ev.fecha}T${ev.hora}:00`, timeZone: 'America/Argentina/Buenos_Aires' }
          : { date: ev.fecha },
        end: ev.hora_fin
          ? { dateTime: `${ev.fecha}T${ev.hora_fin}:00`, timeZone: 'America/Argentina/Buenos_Aires' }
          : { date: ev.fecha },
      }
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) { desconectarGcal(); return null }
      const data = await res.json()
      return data.id ?? null
    } catch { return null }
  }

  /* ── Guardar nueva cita ─────────────────────────────────────────── */
  const guardar = async () => {
    if (!form.titulo.trim()) { showToast('Escribí un título'); return }
    if (!form.fecha) { showToast('Seleccioná una fecha'); return }
    setGuardando(true)

    let gcal_event_id: string|null = null
    if (agregarGcal && gcalToken) {
      gcal_event_id = await pushEventoAGcal(gcalToken, form)
    }

    const { data: nuevo } = await supabase.from('eventos_agenda').insert({
      usuario_id: uid,
      titulo: form.titulo.trim(),
      fecha: form.fecha,
      hora: form.hora || null,
      hora_fin: form.hora_fin || null,
      tipo: form.tipo,
      descripcion: form.descripcion || null,
      lugar: form.lugar || null,
      gcal_event_id,
    }).select().single()

    if (nuevo) {
      const ev: EventoItem = {
        id: `ag-${nuevo.id}`, titulo: nuevo.titulo, fecha: nuevo.fecha,
        hora: nuevo.hora, hora_fin: nuevo.hora_fin, tipo: nuevo.tipo,
        estado: 'activo', descripcion: nuevo.descripcion, lugar: nuevo.lugar,
        contacto_nombre: null, contacto_telefono: null,
        fuente: 'agenda', gcal_event_id: nuevo.gcal_event_id,
      }
      setItems(prev => mergeItems([...prev, ev]))
    }

    showToast(gcal_event_id ? 'Cita creada y agregada a Google Calendar ✓' : 'Cita creada')
    setGuardando(false); setModal(false); setForm(FORM_VACIO); setAgregarGcal(false)
  }

  const eliminarCita = async (item: EventoItem) => {
    if (!confirm('¿Eliminar esta cita?')) return
    const rawId = item.id.replace('ag-', '')
    await supabase.from('eventos_agenda').delete().eq('id', rawId)
    // Eliminar de GCal si está conectado y tiene ID
    if (gcalToken && item.gcal_event_id) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${item.gcal_event_id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${gcalToken}` },
      })
    }
    setItems(prev => prev.filter(i => i.id !== item.id))
    showToast('Cita eliminada')
  }

  /* ── Helpers ─────────────────────────────────────────────────────── */
  function mergeItems(list: EventoItem[]): EventoItem[] {
    const seen = new Set<string>()
    return list
      .filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return i.fecha })
      .sort((a,b) => (a.fecha+(a.hora??'23:59')).localeCompare(b.fecha+(b.hora??'23:59')))
  }

  const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const hoyStr = hoy.toISOString().split('T')[0]

  const filtrados = (() => {
    if (filtro === 'hoy') return items.filter(i => i.fecha === hoyStr)
    if (filtro === 'proximos') {
      const en7 = new Date(hoy); en7.setDate(en7.getDate()+7)
      return items.filter(i => i.fecha >= hoyStr && i.fecha <= en7.toISOString().split('T')[0])
    }
    if (filtro === 'vencidos') return items.filter(i => i.fecha < hoyStr)
    return items
  })()

  const hoyCount  = items.filter(i => i.fecha === hoyStr).length
  const proxCount = items.filter(i => { const e=new Date(hoy); e.setDate(e.getDate()+7); return i.fecha>hoyStr && i.fecha<=e.toISOString().split('T')[0] }).length
  const vencCount = items.filter(i => i.fecha < hoyStr).length

  // Calendario mensual
  const primerDia = new Date(mesVista.getFullYear(), mesVista.getMonth(), 1)
  const ultimoDia = new Date(mesVista.getFullYear(), mesVista.getMonth()+1, 0)
  const diasMes: Date[] = Array.from({length: ultimoDia.getDate()}, (_,i) => new Date(mesVista.getFullYear(), mesVista.getMonth(), i+1))
  const offset = primerDia.getDay()
  const totalCeldas = Math.ceil((offset+diasMes.length)/7)*7
  const celdas: (Date|null)[] = [...Array(offset).fill(null), ...diasMes, ...Array(totalCeldas-offset-diasMes.length).fill(null)]

  const S = {
    input: { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#fff', padding:'9px 12px', fontSize:13, fontFamily:'Inter,sans-serif', boxSizing:'border-box' as const },
    label: { fontSize:10, fontFamily:'Montserrat,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:5 },
    btn: (primary?:boolean) => ({ background: primary?'#cc0000':'rgba(255,255,255,0.07)', border: primary?'none':'1px solid rgba(255,255,255,0.1)', color:'#fff', padding:'9px 18px', borderRadius:8, fontSize:12, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor:'pointer' }),
  }

  return (
    <div style={{maxWidth:820,margin:'0 auto',padding:'24px 0 64px',fontFamily:'Inter,sans-serif',color:'#fff'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap');
        select option { background:#1a1a1a; }
        .ag-row:hover { background:rgba(255,255,255,0.05)!important; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',bottom:24,right:24,background:'#1a1a1a',border:'1px solid rgba(255,255,255,0.12)',padding:'10px 18px',borderRadius:10,fontSize:13,color:'#fff',zIndex:200,boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontSize:10,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',color:'rgba(255,255,255,0.25)',marginBottom:6}}>Organización</div>
          <h1 style={{fontFamily:'Montserrat,sans-serif',fontSize:22,fontWeight:800,color:'#fff',margin:0}}>Agenda</h1>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',margin:'4px 0 0'}}>
            Citas · Recordatorios · Tareas{gcalToken ? ' · Google Calendar ✓' : ''}
          </p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {/* Botón Google Calendar */}
          {gcalToken ? (
            <button onClick={desconectarGcal} style={{...S.btn(),fontSize:11,display:'flex',alignItems:'center',gap:6,color:'#22c55e',border:'1px solid rgba(34,197,94,0.3)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google Calendar
            </button>
          ) : (
            <button onClick={conectarGcal} disabled={gcalConectando} style={{...S.btn(),fontSize:11,display:'flex',alignItems:'center',gap:6,opacity:gcalConectando?0.6:1}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {gcalConectando ? 'Conectando...' : 'Vincular Google Calendar'}
            </button>
          )}
          {/* Vistas */}
          {(['lista','mes'] as const).map(v => (
            <button key={v} onClick={()=>setVista(v)} style={{padding:'8px 14px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,background:vista===v?'#cc0000':'rgba(255,255,255,0.06)',color:vista===v?'#fff':'rgba(255,255,255,0.4)'}}>
              {v==='lista'?'≡ Lista':'▦ Mes'}
            </button>
          ))}
          <button onClick={()=>setModal(true)} style={{...S.btn(true),fontSize:12}}>+ Nueva cita</button>
        </div>
      </div>

      {/* Error GCal */}
      {gcalError && (
        <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#fca5a5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>⚠ {gcalError}</span>
          <button onClick={()=>setGcalError(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:14}}>✕</button>
        </div>
      )}

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
        {[
          {label:'Hoy',value:hoyCount,color:'#cc0000',key:'hoy'},
          {label:'Próximos 7 días',value:proxCount,color:'#f59e0b',key:'proximos'},
          {label:'Vencidos',value:vencCount,color:'#ef4444',key:'vencidos'},
        ].map(s => (
          <div key={s.key} onClick={()=>setFiltro(s.key)} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${s.value>0?`${s.color}30`:'rgba(255,255,255,0.07)'}`,borderRadius:10,padding:'12px 16px',cursor:'pointer'}}>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:22,fontWeight:800,color:s.value>0?s.color:'rgba(255,255,255,0.2)'}}>{s.value}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── VISTA MENSUAL ─────────────────────────────────────────────── */}
      {vista === 'mes' ? (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <button onClick={()=>setMesVista(new Date(mesVista.getFullYear(),mesVista.getMonth()-1))} style={{padding:'6px 12px',background:'rgba(255,255,255,0.06)',border:'none',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:16}}>‹</button>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:16,fontWeight:700,color:'#fff'}}>{MESES[mesVista.getMonth()]} {mesVista.getFullYear()}</div>
            <button onClick={()=>setMesVista(new Date(mesVista.getFullYear(),mesVista.getMonth()+1))} style={{padding:'6px 12px',background:'rgba(255,255,255,0.06)',border:'none',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:16}}>›</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,background:'rgba(255,255,255,0.05)',borderRadius:10,overflow:'hidden'}}>
            {DIAS_SEMANA.map(d=>(
              <div key={d} style={{padding:'8px 4px',textAlign:'center',fontSize:10,fontFamily:'Montserrat,sans-serif',fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:'0.1em',background:'#0a0a0a'}}>{d}</div>
            ))}
            {celdas.map((dia,i)=>{
              if (!dia) return <div key={i} style={{background:'#0a0a0a',minHeight:72}}/>
              const dStr = dia.toISOString().split('T')[0]
              const dItems = items.filter(it=>it.fecha===dStr)
              const esHoyDia = dia.toDateString()===hoy.toDateString()
              return (
                <div key={i} onClick={()=>{ setF('fecha',dStr); setModal(true) }} style={{background:esHoyDia?'rgba(204,0,0,0.08)':'#0a0a0a',padding:'6px 4px',minHeight:72,cursor:'pointer',border:esHoyDia?'1px solid rgba(204,0,0,0.3)':undefined}}>
                  <div style={{textAlign:'right',fontSize:12,fontWeight:esHoyDia?800:400,color:esHoyDia?'#cc0000':'rgba(255,255,255,0.4)',marginBottom:3,fontFamily:'Montserrat,sans-serif'}}>{dia.getDate()}</div>
                  {dItems.slice(0,3).map((it,j)=>{
                    const tc = TIPOS_COLOR[it.tipo]
                    return <div key={j} style={{fontSize:9,color:tc.color,background:tc.bg,padding:'2px 4px',borderRadius:3,marginBottom:2,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{it.titulo}</div>
                  })}
                  {dItems.length>3 && <div style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>+{dItems.length-3}</div>}
                </div>
              )
            })}
          </div>
        </div>

      ) : (
        /* ── VISTA LISTA ──────────────────────────────────────────────── */
        <>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            {[{k:'proximos',l:'Próximos 7 días'},{k:'hoy',l:'Hoy'},{k:'vencidos',l:'Vencidos'},{k:'todos',l:'Todos'}].map(f=>(
              <button key={f.k} onClick={()=>setFiltro(f.k)} style={{padding:'5px 14px',borderRadius:20,border:'none',cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,background:filtro===f.k?'#cc0000':'rgba(255,255,255,0.06)',color:filtro===f.k?'#fff':'rgba(255,255,255,0.4)'}}>
                {f.l}
              </button>
            ))}
            {gcalToken && (
              <button onClick={()=>cargarEventosGcal(gcalToken)} style={{...S.btn(),fontSize:10,marginLeft:'auto',display:'flex',alignItems:'center',gap:5}}>
                ↻ Sincronizar GCal
              </button>
            )}
          </div>

          {cargando ? (
            <div style={{color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'48px 0'}}>Cargando agenda...</div>
          ) : filtrados.length === 0 ? (
            <div style={{textAlign:'center',padding:'56px 0'}}>
              <div style={{fontSize:36,marginBottom:10}}>📅</div>
              <div style={{color:'rgba(255,255,255,0.3)',fontSize:14,marginBottom:12}}>
                {filtro==='hoy'?'Sin compromisos para hoy':filtro==='proximos'?'Sin eventos próximos':filtro==='vencidos'?'¡Todo al día!':'Sin eventos'}
              </div>
              <button onClick={()=>setModal(true)} style={S.btn(true)}>+ Nueva cita</button>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {filtrados.map((item,i)=>{
                const tc = TIPOS_COLOR[item.tipo]
                const vencido = item.fecha < hoyStr
                const esHoyItem = item.fecha === hoyStr
                const prevFecha = i>0 ? filtrados[i-1].fecha : null
                return (
                  <div key={item.id}>
                    {item.fecha !== prevFecha && (
                      <div style={{fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700,color:esHoyItem?'#cc0000':vencido?'#ef4444':'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em',padding:'12px 0 6px',display:'flex',alignItems:'center',gap:8}}>
                        {labelFecha(item.fecha)}
                        {esHoyItem && <span style={{background:'#cc0000',color:'#fff',padding:'1px 7px',borderRadius:10,fontSize:9}}>HOY</span>}
                        {vencido && <span style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',padding:'1px 7px',borderRadius:10,fontSize:9}}>VENCIDO</span>}
                      </div>
                    )}
                    <div className="ag-row" style={{background:vencido?'rgba(239,68,68,0.03)':'rgba(255,255,255,0.03)',border:`1px solid ${vencido?'rgba(239,68,68,0.15)':esHoyItem?'rgba(204,0,0,0.2)':'rgba(255,255,255,0.07)'}`,borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:36,height:36,borderRadius:8,background:tc.bg,border:`1px solid ${tc.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                        {tc.icon}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:vencido?'rgba(255,255,255,0.5)':'#fff',marginBottom:3}}>
                          {item.titulo}
                          {item.fuente==='gcal' && <span style={{marginLeft:8,fontSize:9,color:'#4285F4',background:'rgba(66,133,244,0.1)',padding:'1px 6px',borderRadius:8,fontFamily:'Montserrat,sans-serif',fontWeight:700}}>GCal</span>}
                        </div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                          <span style={{fontSize:10,color:tc.color,background:tc.bg,padding:'2px 7px',borderRadius:10,fontFamily:'Montserrat,sans-serif',fontWeight:700}}>{tc.label}</span>
                          {item.hora && <span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>🕐 {item.hora}{item.hora_fin?` – ${item.hora_fin}`:''}</span>}
                          {item.lugar && <span style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>📍 {item.lugar}</span>}
                          {item.contacto_nombre && <span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>👤 {item.contacto_nombre}</span>}
                        </div>
                        {item.descripcion && <div style={{fontSize:11,color:'rgba(255,255,255,0.25)',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.descripcion}</div>}
                      </div>
                      <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
                        {item.contacto_telefono && (
                          <a href={`https://wa.me/${item.contacto_telefono.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{padding:'5px 9px',background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.25)',borderRadius:7,color:'#22c55e',fontSize:12,textDecoration:'none'}}>💬</a>
                        )}
                        <a href={gcalUrl(item)} target="_blank" rel="noopener noreferrer" title="Agregar a Google Calendar" style={{padding:'5px 9px',background:'rgba(66,133,244,0.08)',border:'1px solid rgba(66,133,244,0.2)',borderRadius:7,color:'#4285F4',fontSize:11,textDecoration:'none',fontFamily:'Montserrat,sans-serif',fontWeight:700}}>GCal ↗</a>
                        {item.fuente==='agenda' && (
                          <button onClick={()=>eliminarCita(item)} style={{padding:'5px 9px',background:'none',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,color:'rgba(200,0,0,0.5)',cursor:'pointer',fontSize:11}}>✕</button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modal nueva cita ─────────────────────────────────────────── */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:100,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px 16px',overflowY:'auto'}} onClick={()=>setModal(false)}>
          <div style={{background:'#111',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:28,width:'100%',maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:16,fontWeight:800,color:'#fff',marginBottom:20}}>📌 Nueva cita</div>

            <div style={{display:'grid',gap:14}}>
              {/* Título */}
              <div>
                <label style={S.label}>Título *</label>
                <input value={form.titulo} onChange={e=>setF('titulo',e.target.value)} placeholder="Ej: Reunión con cliente — Depto Belgrano" style={S.input} autoFocus />
              </div>

              {/* Tipo */}
              <div>
                <label style={S.label}>Tipo</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {(Object.keys(TIPOS_COLOR) as TipoEvento[]).map(t=>{
                    const tc = TIPOS_COLOR[t]
                    return (
                      <button key={t} onClick={()=>setF('tipo',t)} style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${form.tipo===t?tc.color:'rgba(255,255,255,0.1)'}`,background:form.tipo===t?tc.bg:'transparent',color:form.tipo===t?tc.color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700}}>
                        {tc.icon} {tc.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Fecha + Hora */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div>
                  <label style={S.label}>Fecha *</label>
                  <input type="date" value={form.fecha} onChange={e=>setF('fecha',e.target.value)} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Hora inicio</label>
                  <input type="time" value={form.hora} onChange={e=>setF('hora',e.target.value)} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Hora fin</label>
                  <input type="time" value={form.hora_fin} onChange={e=>setF('hora_fin',e.target.value)} style={S.input} />
                </div>
              </div>

              {/* Lugar */}
              <div>
                <label style={S.label}>Lugar</label>
                <input value={form.lugar} onChange={e=>setF('lugar',e.target.value)} placeholder="Ej: Av. Corrientes 1234, CABA" style={S.input} />
              </div>

              {/* Descripción */}
              <div>
                <label style={S.label}>Descripción / notas</label>
                <textarea value={form.descripcion} onChange={e=>setF('descripcion',e.target.value)} rows={2} placeholder="Notas internas, link de videoconferencia, etc." style={{...S.input,resize:'vertical'}} />
              </div>

              {/* Google Calendar */}
              <div style={{background:'rgba(66,133,244,0.06)',border:'1px solid rgba(66,133,244,0.2)',borderRadius:10,padding:'12px 14px'}}>
                {gcalToken ? (
                  <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                    <input type="checkbox" checked={agregarGcal} onChange={e=>setAgregarGcal(e.target.checked)} />
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:'#fff'}}>Agregar a Google Calendar</div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:1}}>Sincroniza automáticamente con tu calendario de Google</div>
                    </div>
                  </label>
                ) : (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                    <div>
                      <div style={{fontSize:12,color:'rgba(255,255,255,0.5)'}}>Conectá Google Calendar para sincronizar automáticamente</div>
                    </div>
                    <button onClick={conectarGcal} style={{...S.btn(),fontSize:10,flexShrink:0,display:'flex',alignItems:'center',gap:5}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Conectar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal(false)} style={S.btn()}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={S.btn(true)}>{guardando?'Guardando...':'Crear cita'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
