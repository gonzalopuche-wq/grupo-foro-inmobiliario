// app/(private)/crm/listas/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

interface Lista {
  id: string
  nombre: string
  descripcion?: string
  slug: string
  email_cliente?: string
  notificar_cliente: boolean
  created_at: string
  contacto?: { id: string; nombre: string; apellido: string }
  propiedades: [{ count: number }]
}

export default function ListasPage() {
  const [listas, setListas] = useState<Lista[]>([])
  const [cargando, setCargando] = useState(true)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setToken(session.access_token)
      const res = await fetch('/api/listas', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      setListas(data || [])
      setCargando(false)
    }
    init()
  }, [])

  const copiarLink = (slug: string) => {
    navigator.clipboard.writeText(`https://foroinmobiliario.com.ar/b/${slug}`)
    setCopiado(slug)
    setTimeout(() => setCopiado(null), 2000)
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta lista? Las propiedades también se eliminarán.')) return
    await fetch(`/api/listas/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    setListas(prev => prev.filter(l => l.id !== id))
  }

  const s: Record<string, any> = {
    page: { minHeight:'100vh', background:'#0a0a0a', color:'#fff', padding:24, fontFamily:'Inter,sans-serif' },
    header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, maxWidth:900 },
    titulo: { margin:0, fontSize:18, fontWeight:800, fontFamily:'Montserrat,sans-serif', color:'#fff' },
    subtitulo: { margin:'4px 0 0', fontSize:12, color:'rgba(255,255,255,0.35)' },
    btnNuevo: { display:'flex', alignItems:'center', gap:8, background:'#cc0000', border:'none', color:'#fff', padding:'9px 16px', borderRadius:8, fontSize:12, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor:'pointer', textDecoration:'none' },
    card: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'16px 20px', marginBottom:12, maxWidth:900, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 },
    nombre: { margin:0, fontSize:15, fontWeight:700, fontFamily:'Montserrat,sans-serif', color:'#fff' },
    desc: { margin:'4px 0 0', fontSize:12, color:'rgba(255,255,255,0.35)' },
    meta: { display:'flex', flexWrap:'wrap' as const, gap:12, marginTop:8, fontSize:11, color:'rgba(255,255,255,0.3)' },
    linkWrap: { display:'flex', alignItems:'center', gap:8, background:'rgba(0,0,0,0.3)', borderRadius:6, padding:'6px 10px', marginTop:10 },
    linkText: { color:'#cc0000', fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const },
    acciones: { display:'flex', flexDirection:'column' as const, gap:6, flexShrink:0 },
    btnVer: { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:700, fontFamily:'Montserrat,sans-serif', cursor:'pointer', textDecoration:'none', textAlign:'center' as const },
    btnDel: { background:'none', border:'none', color:'rgba(200,0,0,0.6)', fontSize:11, cursor:'pointer', textAlign:'center' as const },
  }

  if (cargando) return (
    <div style={{...s.page, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <span style={{color:'rgba(255,255,255,0.3)'}}>Cargando...</span>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>🔖 Listas guardadas</h1>
          <p style={s.subtitulo}>Propiedades seleccionadas para tus clientes</p>
        </div>
        <Link href="/crm/busqueda" style={s.btnNuevo}>
          + Nueva búsqueda
        </Link>
      </div>

      {listas.length === 0 ? (
        <div style={{textAlign:'center',padding:'64px 0',color:'rgba(255,255,255,0.25)',maxWidth:900}}>
          <p style={{fontSize:14,marginBottom:16}}>Todavía no tenés listas guardadas</p>
          <Link href="/crm/busqueda" style={s.btnNuevo}>
            Ir a búsqueda inteligente
          </Link>
        </div>
      ) : (
        listas.map(lista => {
          const cantPropiedades = lista.propiedades?.[0]?.count || 0
          const url = `https://foroinmobiliario.com.ar/b/${lista.slug}`
          return (
            <div key={lista.id} style={s.card}>
              <div style={{flex:1,minWidth:0}}>
                <h3 style={s.nombre}>{lista.nombre}</h3>
                {lista.descripcion && <p style={s.desc}>{lista.descripcion}</p>}
                <div style={s.meta}>
                  {lista.contacto && <span>👤 {lista.contacto.nombre} {lista.contacto.apellido}</span>}
                  <span>🏠 {cantPropiedades} propiedad{cantPropiedades !== 1 ? 'es' : ''}</span>
                  {lista.notificar_cliente && lista.email_cliente && <span style={{color:'#22c55e'}}>🔔 Alertas activas</span>}
                  <span>{new Date(lista.created_at).toLocaleDateString('es-AR')}</span>
                </div>
                <div style={s.linkWrap}>
                  <span style={s.linkText}>{url}</span>
                  <button onClick={() => copiarLink(lista.slug)}
                    style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',padding:'4px 10px',borderRadius:4,fontSize:11,cursor:'pointer'}}>
                    {copiado === lista.slug ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    style={{color:'rgba(255,255,255,0.4)',fontSize:11,textDecoration:'none'}}>
                    Vista cliente ↗
                  </a>
                </div>
              </div>
              <div style={s.acciones}>
                <Link href="/crm/listas" style={s.btnVer}>Ver lista</Link>
                <button onClick={() => eliminar(lista.id)} style={s.btnDel}>Eliminar</button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
