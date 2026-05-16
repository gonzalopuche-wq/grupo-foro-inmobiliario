'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

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
  fuente: 'agenda' | 'crm_recordatorios' | 'crm_tareas'
}

interface GcalCal {
  id: string
  nombre: string
  embedUrl: string
  color: string
}

// State for the quick-add popover (like GCal)
interface QuickAdd {
  show: boolean
  fecha: string
  anchorY: number
  anchorX: number
}

// State after saving — offer to send to each linked GCal
interface AfterSave {
  show: boolean
  item: EventoItem | null
}

const TIPOS_COLOR: Record<TipoEvento, { color: string; bg: string; icon: string; label: string }> = {
  cita:         { color: '#cc0000', bg: 'rgba(204,0,0,0.1)',    icon: '📌', label: 'Cita' },
  recordatorio: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🔔', label: 'Recordatorio' },
  evento:       { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '📅', label: 'Evento' },
  tarea:        { color: '#a855f7', bg: 'rgba(168,85,247,0.1)', icon: '✓',  label: 'Tarea' },
  visita:       { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  icon: '🏠', label: 'Visita' },
}

const CAL_COLORS = ['#4285F4','#0F9D58','#F4B400','#DB4437','#AB47BC','#00ACC1','#FF7043','#9E9E9E']

const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const FORM_VACIO = {
  titulo: '', fecha: new Date().toISOString().split('T')[0],
  hora: '10:00', hora_fin: '11:00', tipo: 'cita' as TipoEvento,
  descripcion: '', lugar: '',
}

const GCAL_FORM_VACIO = { nombre: '', embedUrl: '', color: '#4285F4' }

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

function labelFechaCorta(fecha: string): string {
  return new Date(fecha+'T12:00:00').toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'})
}

function buildIcs(eventos: { titulo:string; fecha:string; hora:string|null; hora_fin:string|null; descripcion:string|null; lugar:string|null }[]): string {
  const fmt = (d: string, h: string) => `${d.replace(/-/g,'')}T${h.replace(':','')}00`
  const esc = (s: string) => s.replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n')
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}@gfi`
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//GFI//Agenda GFI//ES','CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Agenda GFI®','X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
  ]
  for (const ev of eventos) {
    const dtStart = ev.hora ? `DTSTART:${fmt(ev.fecha, ev.hora)}` : `DTSTART;VALUE=DATE:${ev.fecha.replace(/-/g,'')}`
    const dtEnd   = ev.hora_fin ? `DTEND:${fmt(ev.fecha, ev.hora_fin)}` : (ev.hora ? `DTEND:${fmt(ev.fecha, ev.hora)}` : `DTEND;VALUE=DATE:${ev.fecha.replace(/-/g,'')}`)
    lines.push('BEGIN:VEVENT', `UID:${uid()}`, dtStart, dtEnd,
      `SUMMARY:${esc(ev.titulo)}`,
      ...(ev.descripcion ? [`DESCRIPTION:${esc(ev.descripcion)}`] : []),
      ...(ev.lugar ? [`LOCATION:${esc(ev.lugar)}`] : []),
      'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function downloadIcs(eventos: { titulo:string; fecha:string; hora:string|null; hora_fin:string|null; descripcion:string|null; lugar:string|null }[], filename = 'agenda-gfi.ics') {
  const blob = new Blob([buildIcs(eventos)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function gcalUrl(ev: { titulo:string; fecha:string; hora:string|null; hora_fin:string|null; descripcion:string|null; lugar:string|null }, calSrc?: string) {
  const fmt = (d: string, h: string) => `${d.replace(/-/g,'')}T${h.replace(':','')}00`
  const start = ev.hora ? fmt(ev.fecha, ev.hora) : ev.fecha.replace(/-/g,'')
  const end   = ev.hora_fin ? fmt(ev.fecha, ev.hora_fin) : (ev.hora ? fmt(ev.fecha, ev.hora) : ev.fecha.replace(/-/g,''))
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.titulo,
    dates: `${start}/${end}`,
    ...(ev.descripcion ? { details: ev.descripcion } : {}),
    ...(ev.lugar       ? { location: ev.lugar }       : {}),
    ...(calSrc         ? { src: calSrc }               : {}),
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

// Extract calendar src (email) from embed URL to pass to gcalUrl
function extractCalSrc(embedUrl: string): string | undefined {
  try {
    const u = new URL(embedUrl)
    return u.searchParams.get('src') ?? undefined
  } catch { return undefined }
}

function normalizeGcalEmbedUrl(raw: string): string {
  const s = raw.trim()
  if (s.startsWith('https://calendar.google.com/calendar/embed')) return s
  if (s.includes('calendar.google.com')) {
    return s.replace(/\/r(\/|$)/, '/embed').replace('/render', '/embed')
  }
  const srcMatch = s.match(/src="([^"]+calendar\.google\.com[^"]+)"/)
  if (srcMatch) return srcMatch[1]
  return s
}

function buildEmbedUrl(url: string): string {
  const base = normalizeGcalEmbedUrl(url)
  try {
    const u = new URL(base)
    if (!u.searchParams.has('ctz')) u.searchParams.set('ctz', 'America/Argentina/Buenos_Aires')
    u.searchParams.set('mode', 'MONTH')
    u.searchParams.set('showTitle', '0')
    u.searchParams.set('showNav', '1')
    u.searchParams.set('showDate', '1')
    u.searchParams.set('showPrint', '0')
    u.searchParams.set('showTabs', '0')
    u.searchParams.set('showCalendars', '0')
    return u.toString()
  } catch { return base }
}

const LSKEY = (uid: string) => `gcal_cals_${uid}`

function loadCals(uid: string): GcalCal[] {
  try {
    const raw = localStorage.getItem(LSKEY(uid))
    if (!raw) return []
    return JSON.parse(raw) as GcalCal[]
  } catch { return [] }
}

function saveCals(uid: string, cals: GcalCal[]) {
  try { localStorage.setItem(LSKEY(uid), JSON.stringify(cals)) } catch {}
}

const GoogleLogo = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function AgendaPage() {
  const [uid, setUid] = useState('')
  const [items, setItems] = useState<EventoItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<'lista'|'mes'|'gcal'>('lista')
  const [filtro, setFiltro] = useState('proximos')
  const [hoy] = useState(new Date())
  const [mesVista, setMesVista] = useState(new Date())

  // Full modal (from "+ Nueva cita" button or "Más opciones")
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<string|null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  // Quick-add popover (like clicking a day in GCal)
  const [quickAdd, setQuickAdd] = useState<QuickAdd>({ show: false, fecha: '', anchorY: 0, anchorX: 0 })
  const [quickTitulo, setQuickTitulo] = useState('')
  const [quickTipo, setQuickTipo] = useState<TipoEvento>('cita')
  const [quickHora, setQuickHora] = useState('10:00')
  const [quickSaving, setQuickSaving] = useState(false)
  const quickInputRef = useRef<HTMLInputElement>(null)

  // After-save: offer to add to each linked GCal
  const [afterSave, setAfterSave] = useState<AfterSave>({ show: false, item: null })

  // Google Calendar integration
  const [gcalCals, setGcalCals] = useState<GcalCal[]>([])
  const [gcalActivo, setGcalActivo] = useState(0)
  const [gcalModal, setGcalModal] = useState(false)
  const [gcalForm, setGcalForm] = useState(GCAL_FORM_VACIO)
  const [gcalGuardando, setGcalGuardando] = useState(false)
  const [gcalEditando, setGcalEditando] = useState<string|null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }:any) => {
      if (!data.user) { window.location.href = '/login'; return }
      const userId = data.user.id
      setUid(userId)
      cargar(userId)
      // Cargar desde DB (fuente de verdad) con fallback/migración desde localStorage
      const { data: perfil } = await supabase.from('perfiles').select('gcal_calendarios').eq('id', userId).single()
      const dbCals = (perfil?.gcal_calendarios as GcalCal[] | null) ?? null
      if (dbCals && dbCals.length > 0) {
        setGcalCals(dbCals)
      } else {
        const lsCals = loadCals(userId)
        if (lsCals.length > 0) {
          setGcalCals(lsCals)
          await supabase.from('perfiles').update({ gcal_calendarios: lsCals }).eq('id', userId)
        } else {
          setGcalCals([])
        }
      }
    })
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  // Focus quick-add input when it appears
  useEffect(() => {
    if (quickAdd.show) setTimeout(() => quickInputRef.current?.focus(), 50)
  }, [quickAdd.show])

  const cargar = async (id: string) => {
    setCargando(true)
    const [{ data: citasData }, { data: recData }, { data: tarData }] = await Promise.all([
      supabase.from('eventos_agenda').select('*').eq('usuario_id', id).order('fecha'),
      supabase.from('crm_recordatorios').select('*, contacto:crm_contactos(nombre,apellido,telefono)').eq('perfil_id', id).neq('estado','completado'),
      supabase.from('crm_tareas').select('*').eq('perfil_id', id).neq('estado', 'completada').not('fecha_vencimiento','is',null),
    ])
    const all: EventoItem[] = [
      ...((citasData ?? []).map((e:any) => ({
        id: `ag-${e.id}`, titulo: e.titulo, fecha: e.fecha?.split('T')[0]??'',
        hora: e.hora??null, hora_fin: e.hora_fin??null,
        tipo: (e.tipo??'cita') as TipoEvento, estado: 'activo',
        descripcion: e.descripcion??null, lugar: e.lugar??null,
        contacto_nombre: null, contacto_telefono: null, fuente: 'agenda' as const,
      }))),
      ...((recData ?? []).map((r:any) => ({
        id: `rec-${r.id}`, titulo: r.titulo, fecha: r.fecha_recordatorio?.split('T')[0]??'',
        hora: r.fecha_recordatorio?.split('T')[1]?.slice(0,5)??null, hora_fin: null,
        tipo: 'recordatorio' as TipoEvento, estado: r.estado,
        descripcion: r.notas??null, lugar: null,
        contacto_nombre: r.contacto ? `${r.contacto.nombre??''} ${r.contacto.apellido??''}`.trim() : null,
        contacto_telefono: r.contacto?.telefono??null, fuente: 'crm_recordatorios' as const,
      }))),
      ...((tarData ?? []).map((t:any) => ({
        id: `tar-${t.id}`, titulo: t.titulo, fecha: t.fecha_vencimiento?.split('T')[0]??'',
        hora: null, hora_fin: null,
        tipo: 'tarea' as TipoEvento, estado: t.estado ?? 'pendiente',
        descripcion: t.descripcion??null, lugar: null,
        contacto_nombre: null, contacto_telefono: null, fuente: 'crm_tareas' as const,
      }))),
    ]
    all.sort((a,b) => (a.fecha+(a.hora??'23:59')).localeCompare(b.fecha+(b.hora??'23:59')))
    setItems(all.filter(i => i.fecha))
    setCargando(false)
  }

  const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const setGF = (k: string, v: any) => setGcalForm(p => ({ ...p, [k]: v }))

  // Save from full modal
  const guardar = async () => {
    if (!form.titulo.trim()) { showToast('Escribí un título'); return }
    if (!form.fecha) { showToast('Seleccioná una fecha'); return }
    setGuardando(true)
    const saved = await insertEvento({
      usuario_id: uid, titulo: form.titulo.trim(), fecha: form.fecha,
      hora: form.hora || null, hora_fin: form.hora_fin || null, tipo: form.tipo,
      descripcion: form.descripcion || null, lugar: form.lugar || null,
    })
    if (saved) {
      setItems(prev => sortItems([...prev, saved]))
      if (gcalCals.length > 0) setAfterSave({ show: true, item: saved })
      else showToast('Cita creada')
    }
    setGuardando(false); setModal(false); setForm(FORM_VACIO)
  }

  // Save from quick-add popover
  const guardarQuick = useCallback(async () => {
    if (!quickTitulo.trim()) return
    setQuickSaving(true)
    const saved = await insertEvento({
      usuario_id: uid, titulo: quickTitulo.trim(), fecha: quickAdd.fecha,
      hora: quickHora || null, hora_fin: null, tipo: quickTipo,
      descripcion: null, lugar: null,
    })
    if (saved) {
      setItems(prev => sortItems([...prev, saved]))
      setQuickAdd(p => ({ ...p, show: false }))
      setQuickTitulo('')
      if (gcalCals.length > 0) setAfterSave({ show: true, item: saved })
      else showToast('Cita creada')
    }
    setQuickSaving(false)
  }, [uid, quickTitulo, quickAdd.fecha, quickHora, quickTipo, gcalCals.length])

  const insertEvento = async (data: any): Promise<EventoItem | null> => {
    const { data: nuevo } = await supabase.from('eventos_agenda').insert(data).select().single()
    if (!nuevo) return null
    return {
      id: `ag-${nuevo.id}`, titulo: nuevo.titulo, fecha: nuevo.fecha,
      hora: nuevo.hora, hora_fin: nuevo.hora_fin, tipo: nuevo.tipo as TipoEvento,
      estado: 'activo', descripcion: nuevo.descripcion, lugar: nuevo.lugar,
      contacto_nombre: null, contacto_telefono: null, fuente: 'agenda',
    }
  }

  const sortItems = (arr: EventoItem[]) =>
    arr.sort((a,b) => (a.fecha+(a.hora??'23:59')).localeCompare(b.fecha+(b.hora??'23:59')))

  const eliminarCita = async (item: EventoItem) => {
    if (!confirm('¿Eliminar esta cita?')) return
    await supabase.from('eventos_agenda').delete().eq('id', item.id.replace('ag-',''))
    setItems(prev => prev.filter(i => i.id !== item.id))
    showToast('Cita eliminada')
  }

  const abrirQuickAdd = (fecha: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const scrollY = window.scrollY
    setQuickAdd({ show: true, fecha, anchorX: rect.left, anchorY: rect.top + scrollY })
    setQuickTitulo('')
    setQuickTipo('cita')
    setQuickHora('10:00')
  }

  const abrirFullModalDesdeQuick = () => {
    setForm({ ...FORM_VACIO, fecha: quickAdd.fecha, titulo: quickTitulo, tipo: quickTipo, hora: quickHora })
    setQuickAdd(p => ({ ...p, show: false }))
    setModal(true)
  }

  const vincularCalendario = async () => {
    if (!gcalForm.nombre.trim()) { showToast('Poné un nombre al calendario'); return }
    if (!gcalForm.embedUrl.trim()) { showToast('Pegá la URL del calendario'); return }
    setGcalGuardando(true)
    const cal: GcalCal = {
      id: gcalEditando ?? Date.now().toString(),
      nombre: gcalForm.nombre.trim(),
      embedUrl: gcalForm.embedUrl.trim(),
      color: gcalForm.color,
    }
    const next = gcalEditando
      ? gcalCals.map(c => c.id === gcalEditando ? cal : c)
      : [...gcalCals, cal]
    setGcalCals(next)
    // Persistir en DB como fuente de verdad + localStorage como caché
    await supabase.from('perfiles').update({ gcal_calendarios: next }).eq('id', uid)
    saveCals(uid, next)
    if (!gcalEditando) setGcalActivo(next.length - 1)
    setGcalGuardando(false)
    setGcalModal(false)
    setGcalForm(GCAL_FORM_VACIO)
    setGcalEditando(null)
    showToast(gcalEditando ? 'Calendario actualizado' : 'Calendario vinculado')
    if (vista !== 'gcal') setVista('gcal')
  }

  const desvincularCalendario = async (id: string) => {
    if (!confirm('¿Desvincular este calendario?')) return
    const next = gcalCals.filter(c => c.id !== id)
    setGcalCals(next)
    await supabase.from('perfiles').update({ gcal_calendarios: next }).eq('id', uid)
    saveCals(uid, next)
    setGcalActivo(Math.max(0, gcalActivo - 1))
    showToast('Calendario desvinculado')
  }

  const editarCalendario = (cal: GcalCal) => {
    setGcalForm({ nombre: cal.nombre, embedUrl: cal.embedUrl, color: cal.color })
    setGcalEditando(cal.id)
    setGcalModal(true)
  }

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
  const proxCount = items.filter(i => { const e=new Date(hoy); e.setDate(e.getDate()+7); return i.fecha>hoyStr&&i.fecha<=e.toISOString().split('T')[0] }).length
  const vencCount = items.filter(i => i.fecha < hoyStr).length

  // Calendario mensual
  const primerDia = new Date(mesVista.getFullYear(), mesVista.getMonth(), 1)
  const ultimoDia = new Date(mesVista.getFullYear(), mesVista.getMonth()+1, 0)
  const diasMes = Array.from({length: ultimoDia.getDate()}, (_,i) => new Date(mesVista.getFullYear(), mesVista.getMonth(), i+1))
  const offset = primerDia.getDay()
  const totalCeldas = Math.ceil((offset+diasMes.length)/7)*7
  const celdas: (Date|null)[] = [...Array(offset).fill(null), ...diasMes, ...Array(totalCeldas-offset-diasMes.length).fill(null)]

  const S = {
    input: { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'#fff', padding:'9px 12px', fontSize:13, fontFamily:'Inter,sans-serif', boxSizing:'border-box' as const },
    label: { fontSize:10, fontFamily:'Montserrat,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:5 },
    btn: (primary?:boolean) => ({ background:primary?'#cc0000':'rgba(255,255,255,0.07)', border:primary?'none':'1px solid rgba(255,255,255,0.1)', color:'#fff', padding:'9px 18px', borderRadius:8, fontSize:12, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor:'pointer' }),
  }

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'24px 0 64px',fontFamily:'Inter,sans-serif',color:'#fff'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap');
        .ag-row:hover{background:rgba(255,255,255,0.05)!important;}
        .cal-tab:hover{background:rgba(255,255,255,0.06)!important;}
        .day-cell:hover .day-add{opacity:1!important;}
        select option{background:#1a1a1a;}
        .gcal-iframe{border:none;border-radius:0 0 10px 10px;width:100%;height:600px;display:block;}
        @media(max-width:600px){.gcal-iframe{height:420px;}}
        .quick-tipo-btn:hover{background:rgba(255,255,255,0.08)!important;}
      `}</style>

      {toast && (
        <div style={{position:'fixed',bottom:24,right:24,background:'#1a1a1a',border:'1px solid rgba(255,255,255,0.12)',padding:'10px 18px',borderRadius:10,fontSize:13,color:'#fff',zIndex:200,boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
          {toast}
        </div>
      )}

      {/* ── QUICK-ADD POPOVER (overlay) ── */}
      {quickAdd.show && (
        <div
          style={{position:'fixed',inset:0,zIndex:300}}
          onClick={()=>setQuickAdd(p=>({...p,show:false}))}
        >
          <div
            style={{
              position:'absolute',
              top: Math.min(quickAdd.anchorY + 8, window.innerHeight - 320),
              left: Math.min(Math.max(quickAdd.anchorX, 8), window.innerWidth - 320),
              width: 300,
              background:'#1a1a1a',
              border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:12,
              boxShadow:'0 8px 40px rgba(0,0,0,0.6)',
              padding:16,
              zIndex:301,
            }}
            onClick={e=>e.stopPropagation()}
          >
            {/* Date chip */}
            <div style={{fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700,color:'rgba(255,255,255,0.35)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.1em'}}>
              {labelFechaCorta(quickAdd.fecha)}
            </div>

            {/* Title input */}
            <input
              ref={quickInputRef}
              value={quickTitulo}
              onChange={e=>setQuickTitulo(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') guardarQuick(); if(e.key==='Escape') setQuickAdd(p=>({...p,show:false})) }}
              placeholder="Título del evento"
              style={{width:'100%',background:'transparent',border:'none',borderBottom:'2px solid rgba(204,0,0,0.6)',color:'#fff',fontSize:16,fontFamily:'Inter,sans-serif',padding:'4px 0',outline:'none',marginBottom:14,boxSizing:'border-box'}}
            />

            {/* Hora */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
              <span style={{fontSize:12,color:'rgba(255,255,255,0.3)'}}>🕐</span>
              <input
                type="time"
                value={quickHora}
                onChange={e=>setQuickHora(e.target.value)}
                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'#fff',padding:'5px 8px',fontSize:12,fontFamily:'Inter,sans-serif',flex:1}}
              />
            </div>

            {/* Tipo */}
            <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:14}}>
              {(Object.keys(TIPOS_COLOR) as TipoEvento[]).map(t => {
                const tc = TIPOS_COLOR[t]
                return (
                  <button
                    key={t}
                    className="quick-tipo-btn"
                    onClick={()=>setQuickTipo(t)}
                    style={{padding:'3px 9px',borderRadius:12,border:`1px solid ${quickTipo===t?tc.color:'rgba(255,255,255,0.08)'}`,background:quickTipo===t?tc.bg:'transparent',color:quickTipo===t?tc.color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:10,fontFamily:'Montserrat,sans-serif',fontWeight:700,lineHeight:1.5}}
                  >
                    {tc.icon} {tc.label}
                  </button>
                )
              })}
            </div>

            {/* Actions */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
              <button
                onClick={abrirFullModalDesdeQuick}
                style={{fontSize:11,color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontWeight:700,padding:0,textDecoration:'underline'}}
              >
                Más opciones
              </button>
              <button
                onClick={guardarQuick}
                disabled={quickSaving || !quickTitulo.trim()}
                style={{padding:'8px 18px',background:'#cc0000',border:'none',color:'#fff',borderRadius:8,fontSize:12,fontWeight:700,fontFamily:'Montserrat,sans-serif',cursor:'pointer',opacity:!quickTitulo.trim()?0.4:1}}
              >
                {quickSaving ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AFTER-SAVE: Agregar a GCal ── */}
      {afterSave.show && afterSave.item && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:250,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setAfterSave({show:false,item:null})}>
          <div style={{background:'#1a1a1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:24,maxWidth:380,width:'100%'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:20,marginBottom:8}}>✅</div>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:15,fontWeight:800,color:'#fff',marginBottom:4}}>
              {afterSave.item.titulo}
            </div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginBottom:20}}>
              {labelFechaCorta(afterSave.item.fecha)}{afterSave.item.hora ? ` · ${afterSave.item.hora}` : ''}
            </div>

            {gcalCals.length > 0 && (
              <>
                <div style={{fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.25)',marginBottom:10}}>
                  ¿Agregar a Google Calendar?
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                  {gcalCals.map(cal => (
                    <a
                      key={cal.id}
                      href={gcalUrl(afterSave.item!, extractCalSrc(cal.embedUrl))}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={()=>setAfterSave({show:false,item:null})}
                      style={{
                        display:'flex',alignItems:'center',gap:10,
                        padding:'10px 14px',
                        background:`${cal.color}12`,
                        border:`1px solid ${cal.color}30`,
                        borderRadius:8,textDecoration:'none',
                        color:'#fff',fontSize:13,fontWeight:600,fontFamily:'Inter,sans-serif',
                      }}
                    >
                      <span style={{width:10,height:10,borderRadius:'50%',background:cal.color,flexShrink:0,display:'inline-block'}}/>
                      <GoogleLogo/>
                      <span style={{flex:1}}>{cal.nombre}</span>
                      <span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>Agregar →</span>
                    </a>
                  ))}
                  {/* Agregar a cualquier GCal sin calendario específico */}
                  <a
                    href={gcalUrl(afterSave.item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={()=>setAfterSave({show:false,item:null})}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,textDecoration:'none',color:'rgba(255,255,255,0.4)',fontSize:12,fontFamily:'Inter,sans-serif'}}
                  >
                    <GoogleLogo size={12}/>
                    <span>Otro calendario...</span>
                  </a>
                </div>
              </>
            )}

            <button
              onClick={()=>setAfterSave({show:false,item:null})}
              style={{width:'100%',padding:'8px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,color:'rgba(255,255,255,0.4)',fontSize:12,cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontWeight:700}}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontSize:10,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',color:'rgba(255,255,255,0.25)',marginBottom:6}}>Organización</div>
          <h1 style={{fontFamily:'Montserrat,sans-serif',fontSize:22,fontWeight:800,color:'#fff',margin:0}}>Agenda</h1>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',margin:'4px 0 0'}}>Citas · Recordatorios CRM · Tareas · Google Calendar</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {([
            {k:'lista' as const,l:'≡ Lista'},
            {k:'mes' as const,l:'▦ Mes'},
            {k:'gcal' as const,l:'Google Calendar'},
          ]).map(v => (
            <button key={v.k} onClick={()=>setVista(v.k)} style={{padding:'8px 14px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,background:vista===v.k?'rgba(66,133,244,0.2)':'rgba(255,255,255,0.06)',color:vista===v.k?'#7aa4f7':'rgba(255,255,255,0.4)',display:'flex',alignItems:'center',gap:6}}>
              {v.k==='gcal'&&<GoogleLogo/>}
              {v.l}
              {v.k==='gcal'&&gcalCals.length>0&&<span style={{background:'rgba(66,133,244,0.25)',color:'#7aa4f7',borderRadius:10,padding:'1px 6px',fontSize:10}}>{gcalCals.length}</span>}
            </button>
          ))}
          <button onClick={()=>setModal(true)} style={S.btn(true)}>+ Nueva cita</button>
          <button
            onClick={()=>downloadIcs(items.map(i=>({titulo:i.titulo,fecha:i.fecha,hora:i.hora,hora_fin:i.hora_fin,descripcion:i.descripcion,lugar:i.lugar})))}
            style={{padding:'8px 14px',background:'transparent',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,color:'rgba(255,255,255,0.45)',fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}
            title="Exportar agenda como .ics (compatible Google Calendar, Outlook, Apple Calendar)"
          >
            📥 .ics
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
        {[
          {label:'Hoy',value:hoyCount,color:'#cc0000',key:'hoy'},
          {label:'Próximos 7 días',value:proxCount,color:'#f59e0b',key:'proximos'},
          {label:'Vencidos',value:vencCount,color:'#ef4444',key:'vencidos'},
        ].map(s=>(
          <div key={s.key} onClick={()=>{setFiltro(s.key);setVista('lista')}} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${s.value>0?`${s.color}30`:'rgba(255,255,255,0.07)'}`,borderRadius:10,padding:'12px 16px',cursor:'pointer'}}>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:22,fontWeight:800,color:s.value>0?s.color:'rgba(255,255,255,0.2)'}}>{s.value}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── VISTA GOOGLE CALENDAR ── */}
      {vista==='gcal' && (
        <div>
          {gcalCals.length === 0 ? (
            <div style={{background:'rgba(66,133,244,0.05)',border:'1px solid rgba(66,133,244,0.2)',borderRadius:12,padding:'40px 32px',textAlign:'center'}}>
              <div style={{fontSize:48,marginBottom:16,display:'flex',justifyContent:'center'}}><GoogleLogo size={48}/></div>
              <div style={{fontFamily:'Montserrat,sans-serif',fontSize:18,fontWeight:800,color:'#fff',marginBottom:8}}>Vinculá tus calendarios de Google</div>
              <p style={{fontSize:13,color:'rgba(255,255,255,0.45)',maxWidth:480,margin:'0 auto 24px',lineHeight:1.6}}>
                Conectá uno o varios Google Calendars para verlos directamente acá. Podés vincular tu calendario personal, el de trabajo, el del equipo — todos juntos.
              </p>
              <button
                onClick={()=>{ setGcalEditando(null); setGcalForm(GCAL_FORM_VACIO); setGcalModal(true) }}
                style={{padding:'12px 28px',background:'rgba(66,133,244,0.2)',border:'1px solid rgba(66,133,244,0.4)',color:'#7aa4f7',borderRadius:8,fontSize:13,fontWeight:700,fontFamily:'Montserrat,sans-serif',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8}}
              >
                <GoogleLogo/> Vincular primer calendario
              </button>
              <div style={{marginTop:32,background:'rgba(255,255,255,0.03)',borderRadius:10,padding:'20px 24px',textAlign:'left',maxWidth:520,margin:'32px auto 0'}}>
                <div style={{fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.25)',marginBottom:14}}>Cómo obtener el link</div>
                {[
                  { n:'1', t:'Abrí Google Calendar', d:'calendar.google.com' },
                  { n:'2', t:'Entrá a Configuración ⚙️', d:'Ícono de engranaje → Configuración' },
                  { n:'3', t:'Elegí el calendario de la barra izquierda', d:'Clic en el nombre de tu calendario' },
                  { n:'4', t:'Sección "Integrar el calendario"', d:'Scrolleá hasta encontrar esa sección' },
                  { n:'5', t:'Copiá la "Dirección pública en formato HTML"', d:'Empieza con https://calendar.google.com/calendar/embed?...' },
                ].map(s=>(
                  <div key={s.n} style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:12}}>
                    <div style={{width:22,height:22,borderRadius:'50%',background:'rgba(66,133,244,0.2)',border:'1px solid rgba(66,133,244,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#7aa4f7',flexShrink:0,marginTop:1}}>{s.n}</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.8)',marginBottom:2}}>{s.t}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:0,flexWrap:'wrap'}}>
                {gcalCals.map((cal,i) => (
                  <button key={cal.id} className="cal-tab" onClick={()=>setGcalActivo(i)} style={{padding:'8px 16px',borderRadius:'8px 8px 0 0',border:'none',cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontSize:12,fontWeight:700,background:gcalActivo===i?'#111':'rgba(255,255,255,0.04)',color:gcalActivo===i?cal.color:'rgba(255,255,255,0.4)',borderTop:gcalActivo===i?`2px solid ${cal.color}`:'2px solid transparent',display:'flex',alignItems:'center',gap:7}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:cal.color,display:'inline-block',flexShrink:0}}/>
                    {cal.nombre}
                  </button>
                ))}
                <button onClick={()=>{ setGcalEditando(null); setGcalForm(GCAL_FORM_VACIO); setGcalModal(true) }} style={{padding:'8px 14px',borderRadius:'8px 8px 0 0',border:'none',cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,background:'transparent',color:'rgba(66,133,244,0.6)',display:'flex',alignItems:'center',gap:5}}>
                  + Vincular
                </button>
              </div>
              {gcalCals[gcalActivo] && (
                <div style={{background:'#111',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0 8px 10px 10px',overflow:'hidden'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:10,height:10,borderRadius:'50%',background:gcalCals[gcalActivo].color,display:'inline-block'}}/>
                      <span style={{fontFamily:'Montserrat,sans-serif',fontSize:13,fontWeight:700,color:'#fff'}}>{gcalCals[gcalActivo].nombre}</span>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>editarCalendario(gcalCals[gcalActivo])} style={{padding:'5px 12px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'rgba(255,255,255,0.5)',fontSize:11,cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontWeight:700}}>Editar</button>
                      <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" style={{padding:'5px 12px',background:'rgba(66,133,244,0.08)',border:'1px solid rgba(66,133,244,0.2)',borderRadius:6,color:'#7aa4f7',fontSize:11,textDecoration:'none',fontFamily:'Montserrat,sans-serif',fontWeight:700,display:'flex',alignItems:'center',gap:5}}>
                        <GoogleLogo/> Abrir GCal
                      </a>
                      <button onClick={()=>desvincularCalendario(gcalCals[gcalActivo].id)} style={{padding:'5px 12px',background:'none',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,color:'rgba(200,0,0,0.5)',fontSize:11,cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontWeight:700}}>Desvincular</button>
                    </div>
                  </div>
                  <iframe key={gcalCals[gcalActivo].id} src={buildEmbedUrl(gcalCals[gcalActivo].embedUrl)} className="gcal-iframe" title={gcalCals[gcalActivo].nombre} sandbox="allow-scripts allow-same-origin allow-popups allow-forms"/>
                </div>
              )}
              <div style={{marginTop:12,display:'flex',alignItems:'center',gap:8,fontSize:11,color:'rgba(255,255,255,0.2)'}}>
                <GoogleLogo size={12}/>
                <span>Vista de solo lectura. Para agregar eventos a GCal, creá una cita en GFI y después elegís a qué calendario enviarlo.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VISTA MES ── */}
      {vista==='mes' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <button onClick={()=>setMesVista(new Date(mesVista.getFullYear(),mesVista.getMonth()-1))} style={{padding:'6px 14px',background:'rgba(255,255,255,0.06)',border:'none',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:16}}>‹</button>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:15,fontWeight:700,color:'#fff'}}>{MESES[mesVista.getMonth()]} {mesVista.getFullYear()}</div>
            <button onClick={()=>setMesVista(new Date(mesVista.getFullYear(),mesVista.getMonth()+1))} style={{padding:'6px 14px',background:'rgba(255,255,255,0.06)',border:'none',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:16}}>›</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,background:'rgba(255,255,255,0.05)',borderRadius:10,overflow:'hidden'}}>
            {DIAS_SEMANA.map(d=>(
              <div key={d} style={{padding:'8px 4px',textAlign:'center',fontSize:10,fontFamily:'Montserrat,sans-serif',fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:'0.1em',background:'#0a0a0a'}}>{d}</div>
            ))}
            {celdas.map((dia,i)=>{
              if (!dia) return <div key={i} style={{background:'#0a0a0a',minHeight:80}}/>
              const dStr = dia.toISOString().split('T')[0]
              const dItems = items.filter(it=>it.fecha===dStr)
              const esHoyDia = dia.toDateString()===hoy.toDateString()
              return (
                <div
                  key={i}
                  className="day-cell"
                  onClick={e=>abrirQuickAdd(dStr,e)}
                  style={{background:esHoyDia?'rgba(204,0,0,0.08)':'#0a0a0a',padding:'6px 4px',minHeight:80,cursor:'pointer',border:esHoyDia?'1px solid rgba(204,0,0,0.3)':undefined,position:'relative'}}
                >
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:esHoyDia?800:400,color:esHoyDia?'#cc0000':'rgba(255,255,255,0.4)',fontFamily:'Montserrat,sans-serif'}}>{dia.getDate()}</span>
                    {/* "+" hint on hover */}
                    <span className="day-add" style={{fontSize:11,color:'rgba(204,0,0,0.5)',opacity:0,transition:'opacity 0.15s',lineHeight:1}}>+</span>
                  </div>
                  {dItems.slice(0,3).map((it,j)=>{
                    const tc=TIPOS_COLOR[it.tipo]
                    return <div key={j} style={{fontSize:9,color:tc.color,background:tc.bg,padding:'2px 4px',borderRadius:3,marginBottom:2,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{it.titulo}</div>
                  })}
                  {dItems.length>3&&<div style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>+{dItems.length-3}</div>}
                </div>
              )
            })}
          </div>
          <div style={{marginTop:10,fontSize:11,color:'rgba(255,255,255,0.2)',textAlign:'center'}}>Hacé clic en cualquier día para crear un evento</div>
        </div>
      )}

      {/* ── VISTA LISTA ── */}
      {vista==='lista' && (
        <>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            {[{k:'proximos',l:'Próximos 7 días'},{k:'hoy',l:'Hoy'},{k:'vencidos',l:'Vencidos'},{k:'todos',l:'Todos'}].map(f=>(
              <button key={f.k} onClick={()=>setFiltro(f.k)} style={{padding:'5px 14px',borderRadius:20,border:'none',cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,background:filtro===f.k?'#cc0000':'rgba(255,255,255,0.06)',color:filtro===f.k?'#fff':'rgba(255,255,255,0.4)'}}>
                {f.l}
              </button>
            ))}
          </div>
          {cargando ? (
            <div style={{color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'48px 0'}}>Cargando agenda...</div>
          ) : filtrados.length===0 ? (
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
                const tc=TIPOS_COLOR[item.tipo]
                const vencido=item.fecha<hoyStr
                const esHoyItem=item.fecha===hoyStr
                const prevFecha=i>0?filtrados[i-1].fecha:null
                return (
                  <div key={item.id}>
                    {item.fecha!==prevFecha&&(
                      <div style={{fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700,color:esHoyItem?'#cc0000':vencido?'#ef4444':'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em',padding:'12px 0 6px',display:'flex',alignItems:'center',gap:8}}>
                        {labelFecha(item.fecha)}
                        {esHoyItem&&<span style={{background:'#cc0000',color:'#fff',padding:'1px 7px',borderRadius:10,fontSize:9}}>HOY</span>}
                        {vencido&&<span style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',padding:'1px 7px',borderRadius:10,fontSize:9}}>VENCIDO</span>}
                      </div>
                    )}
                    <div className="ag-row" style={{background:vencido?'rgba(239,68,68,0.03)':'rgba(255,255,255,0.03)',border:`1px solid ${vencido?'rgba(239,68,68,0.15)':esHoyItem?'rgba(204,0,0,0.2)':'rgba(255,255,255,0.07)'}`,borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:36,height:36,borderRadius:8,background:tc.bg,border:`1px solid ${tc.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                        {tc.icon}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:vencido?'rgba(255,255,255,0.5)':'#fff',marginBottom:3}}>{item.titulo}</div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                          <span style={{fontSize:10,color:tc.color,background:tc.bg,padding:'2px 7px',borderRadius:10,fontFamily:'Montserrat,sans-serif',fontWeight:700}}>{tc.label}</span>
                          {item.hora&&<span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>🕐 {item.hora}{item.hora_fin?` – ${item.hora_fin}`:''}</span>}
                          {item.lugar&&<span style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>📍 {item.lugar}</span>}
                          {item.contacto_nombre&&<span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>👤 {item.contacto_nombre}</span>}
                        </div>
                        {item.descripcion&&<div style={{fontSize:11,color:'rgba(255,255,255,0.25)',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.descripcion}</div>}
                      </div>
                      <div style={{display:'flex',gap:6,flexShrink:0}}>
                        {item.contacto_telefono&&(
                          <a href={`https://wa.me/${item.contacto_telefono.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{padding:'6px 10px',background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.25)',borderRadius:7,color:'#22c55e',fontSize:12,textDecoration:'none'}}>💬</a>
                        )}
                        {/* GCal button: if linked cals, show dropdown, else direct link */}
                        {gcalCals.length > 0 ? (
                          <button
                            onClick={()=>setAfterSave({show:true,item})}
                            style={{padding:'6px 10px',background:'rgba(66,133,244,0.08)',border:'1px solid rgba(66,133,244,0.2)',borderRadius:7,fontSize:11,display:'flex',alignItems:'center',gap:5,color:'#7aa4f7',fontFamily:'Montserrat,sans-serif',fontWeight:700,cursor:'pointer'}}
                          >
                            <GoogleLogo size={12}/> GCal
                          </button>
                        ) : (
                          <a href={gcalUrl(item)} target="_blank" rel="noopener noreferrer" title="Agregar a Google Calendar" style={{padding:'6px 10px',background:'rgba(66,133,244,0.08)',border:'1px solid rgba(66,133,244,0.2)',borderRadius:7,fontSize:11,textDecoration:'none',display:'flex',alignItems:'center',gap:5,color:'#7aa4f7',fontFamily:'Montserrat,sans-serif',fontWeight:700}}>
                            <GoogleLogo size={12}/> GCal
                          </a>
                        )}
                        {item.fuente==='agenda'&&(
                          <button onClick={()=>eliminarCita(item)} style={{padding:'6px 10px',background:'none',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,color:'rgba(200,0,0,0.5)',cursor:'pointer',fontSize:11}}>✕</button>
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

      {/* ── MODAL NUEVA CITA (full) ── */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:100,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px 16px',overflowY:'auto'}} onClick={()=>setModal(false)}>
          <div style={{background:'#111',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:28,width:'100%',maxWidth:500}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:16,fontWeight:800,color:'#fff',marginBottom:20}}>📌 Nueva cita</div>
            <div style={{display:'grid',gap:14}}>
              <div>
                <label style={S.label}>Título *</label>
                <input value={form.titulo} onChange={e=>setF('titulo',e.target.value)} placeholder="Ej: Reunión con cliente — Depto Belgrano" style={S.input} autoFocus />
              </div>
              <div>
                <label style={S.label}>Tipo</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {(Object.keys(TIPOS_COLOR) as TipoEvento[]).map(t=>{
                    const tc=TIPOS_COLOR[t]
                    return (
                      <button key={t} onClick={()=>setF('tipo',t)} style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${form.tipo===t?tc.color:'rgba(255,255,255,0.1)'}`,background:form.tipo===t?tc.bg:'transparent',color:form.tipo===t?tc.color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700}}>
                        {tc.icon} {tc.label}
                      </button>
                    )
                  })}
                </div>
              </div>
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
              <div>
                <label style={S.label}>Lugar</label>
                <input value={form.lugar} onChange={e=>setF('lugar',e.target.value)} placeholder="Ej: Av. Corrientes 1234, CABA" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Descripción / notas</label>
                <textarea value={form.descripcion} onChange={e=>setF('descripcion',e.target.value)} rows={2} placeholder="Notas, link de videollamada, etc." style={{...S.input,resize:'vertical'}} />
              </div>
              {gcalCals.length > 0 && (
                <div style={{background:'rgba(66,133,244,0.06)',border:'1px solid rgba(66,133,244,0.15)',borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                  <GoogleLogo/>
                  <span style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>Al guardar, te pedimos a qué calendario de Google querés enviarlo.</span>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal(false)} style={S.btn()}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={S.btn(true)}>{guardando?'Guardando...':'Crear cita'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VINCULAR GOOGLE CALENDAR ── */}
      {gcalModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:150,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px 16px',overflowY:'auto'}} onClick={()=>{ setGcalModal(false); setGcalEditando(null); setGcalForm(GCAL_FORM_VACIO) }}>
          <div style={{background:'#111',border:'1px solid rgba(66,133,244,0.25)',borderRadius:14,padding:28,width:'100%',maxWidth:560}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
              <GoogleLogo/>
              <span style={{fontFamily:'Montserrat,sans-serif',fontSize:16,fontWeight:800,color:'#fff'}}>
                {gcalEditando ? 'Editar calendario' : 'Vincular Google Calendar'}
              </span>
            </div>
            <div style={{display:'grid',gap:14}}>
              <div>
                <label style={S.label}>Nombre del calendario</label>
                <input value={gcalForm.nombre} onChange={e=>setGF('nombre',e.target.value)} placeholder="Ej: Personal, Trabajo, GFI, Familia…" style={S.input} autoFocus />
              </div>
              <div>
                <label style={S.label}>Color</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {CAL_COLORS.map(c=>(
                    <button key={c} onClick={()=>setGF('color',c)} style={{width:28,height:28,borderRadius:'50%',background:c,border:gcalForm.color===c?'3px solid #fff':'3px solid transparent',cursor:'pointer',outline:'none'}}/>
                  ))}
                </div>
              </div>
              <div>
                <label style={S.label}>URL del calendario</label>
                <textarea value={gcalForm.embedUrl} onChange={e=>setGF('embedUrl',e.target.value)} rows={3} placeholder={'Pegá acá la URL de integración\nEj: https://calendar.google.com/calendar/embed?src=tucorreo%40gmail.com&ctz=America...'} style={{...S.input,resize:'vertical',fontFamily:'monospace',fontSize:11}}/>
              </div>
              <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'14px 16px'}}>
                <div style={{fontSize:10,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.25)',marginBottom:10}}>Dónde encontrar la URL</div>
                <ol style={{margin:0,padding:'0 0 0 16px',display:'grid',gap:6}}>
                  {['Google Calendar → ⚙️ Configuración','Sidebar izquierdo → elegí el calendario','Scrolleá a "Integrar el calendario"','Copiá la "Dirección pública en formato HTML"'].map((s,i)=>(
                    <li key={i} style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.5}}>{s}</li>
                  ))}
                </ol>
                <div style={{marginTop:8,fontSize:11,color:'rgba(255,255,255,0.25)'}}>
                  También podés pegar el código HTML del iframe completo.
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button onClick={()=>{ setGcalModal(false); setGcalEditando(null); setGcalForm(GCAL_FORM_VACIO) }} style={S.btn()}>Cancelar</button>
              <button onClick={vincularCalendario} disabled={gcalGuardando || !gcalForm.nombre.trim() || !gcalForm.embedUrl.trim()} style={{...S.btn(true),background:'rgba(66,133,244,0.8)',display:'flex',alignItems:'center',gap:7,opacity:(!gcalForm.nombre.trim()||!gcalForm.embedUrl.trim())?0.5:1}}>
                <GoogleLogo/> {gcalGuardando ? 'Vinculando...' : gcalEditando ? 'Guardar cambios' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
