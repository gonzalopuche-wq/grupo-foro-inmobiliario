// app/(private)/crm/busqueda/CrearListaModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { X, BookmarkPlus, Loader2, CheckCircle2 } from 'lucide-react'

interface Contacto {
  id: string
  nombre: string
  apellido: string
  email?: string
  telefono?: string
}

interface CrearListaModalProps {
  propiedades: any[]
  onClose: () => void
  onCreada: (listaId: string, slug: string) => void
}

export default function CrearListaModal({ propiedades, onClose, onCreada }: CrearListaModalProps) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [emailCliente, setEmailCliente] = useState('')
  const [notificarCliente, setNotificarCliente] = useState(true)
  const [contactoId, setContactoId] = useState('')
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [cargandoContactos, setCargandoContactos] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(false)
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('crm_contactos')
        .select('id, nombre, apellido, email, telefono')
        .eq('perfil_id', user.id)
        .order('apellido', { ascending: true })
        .limit(200)
      setContactos((data as Contacto[]) || [])
      setCargandoContactos(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    if (contactoId) {
      const c = contactos.find(x => x.id === contactoId)
      if (c?.email) setEmailCliente(c.email)
      if (c) setNombre(`${c.apellido ? c.apellido + ', ' : ''}${c.nombre} — ${new Date().toLocaleDateString('es-AR')}`)
    }
  }, [contactoId, contactos])

  const guardar = async () => {
    if (!nombre.trim()) { setError('Ponele un nombre a la lista'); return }
    setError('')
    setGuardando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sesión expirada')
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      }

      const resLista = await fetch('/api/listas', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion,
          contacto_id: contactoId || null,
          email_cliente: emailCliente || null,
          notificar_cliente: notificarCliente,
        }),
      })
      const lista = await resLista.json()
      if (!resLista.ok) throw new Error(lista.error)

      await Promise.allSettled(
        propiedades.map(prop =>
          fetch(`/api/listas/${lista.id}/propiedades`, {
            method: 'POST',
            headers,
            body: JSON.stringify(prop),
          })
        )
      )

      setSlug(lista.slug)
      setListo(true)
      onCreada(lista.id, lista.slug)
    } catch (err: any) {
      setError(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const urlLista = `https://foroinmobiliario.com.ar/b/${slug}`

  const s: Record<string, any> = {
    bg: { position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16 },
    modal: { background:'#0f0f0f',border:'1px solid rgba(200,0,0,0.2)',borderRadius:12,width:'100%',maxWidth:480 },
    header: { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,0.07)' },
    body: { padding:20 },
    label: { fontSize:10,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:6,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase' as const },
    input: { width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 10px',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box' as const,fontFamily:'Inter,sans-serif' },
    field: { marginBottom:14 },
  }

  return (
    <div style={s.bg} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modal}>
        <div style={s.header}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <BookmarkPlus style={{width:18,height:18,color:'#cc0000'}} />
            <span style={{fontWeight:700,fontSize:15,color:'#fff',fontFamily:'Montserrat,sans-serif'}}>
              {listo ? 'Lista creada' : 'Guardar en lista'}
            </span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer'}}><X style={{width:18,height:18}} /></button>
        </div>

        {!listo ? (
          <div style={s.body}>
            <div style={{background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:16}}>
              {propiedades.length} propiedad{propiedades.length !== 1 ? 'es' : ''} seleccionada{propiedades.length !== 1 ? 's' : ''}
            </div>

            <div style={s.field}>
              <label style={s.label}>Contacto del CRM (opcional)</label>
              {cargandoContactos ? (
                <div style={{color:'rgba(255,255,255,0.3)',fontSize:12}}>Cargando contactos...</div>
              ) : (
                <select value={contactoId} onChange={e => setContactoId(e.target.value)}
                  style={{...s.input,background:'#111'}}>
                  <option value="">— Sin contacto —</option>
                  {contactos.map(c => (
                    <option key={c.id} value={c.id} style={{background:'#111'}}>
                      {c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}{c.telefono ? ` · ${c.telefono}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={s.field}>
              <label style={s.label}>Nombre de la lista *</label>
              <input style={s.input} value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Departamentos 2 dorm Pichincha — García" />
            </div>

            <div style={s.field}>
              <label style={s.label}>Descripción (opcional)</label>
              <input style={s.input} value={descripcion} onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej: Búsqueda entre U$D 80.000 y U$D 100.000" />
            </div>

            <div style={{background:'rgba(200,0,0,0.05)',border:'1px solid rgba(200,0,0,0.15)',borderRadius:8,padding:14,marginBottom:14}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:notificarCliente?12:0}}>
                <input type="checkbox" id="notif" checked={notificarCliente} onChange={e => setNotificarCliente(e.target.checked)}
                  style={{marginTop:2,accentColor:'#cc0000'}} />
                <label htmlFor="notif" style={{fontSize:12,color:'rgba(255,255,255,0.6)',cursor:'pointer'}}>
                  Notificar al cliente cuando cambie el precio o se dé de baja una propiedad
                </label>
              </div>
              {notificarCliente && (
                <div>
                  <label style={{...s.label,marginBottom:4}}>Email del cliente</label>
                  <input type="email" style={s.input} value={emailCliente} onChange={e => setEmailCliente(e.target.value)}
                    placeholder="cliente@email.com" />
                </div>
              )}
            </div>

            {error && <p style={{color:'#f87171',fontSize:12,marginBottom:12}}>{error}</p>}

            <button onClick={guardar} disabled={guardando}
              style={{width:'100%',background:'#cc0000',border:'none',color:'#fff',padding:'12px',borderRadius:8,fontWeight:700,fontSize:13,fontFamily:'Montserrat,sans-serif',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:guardando?0.7:1}}>
              {guardando ? <><Loader2 style={{width:15,height:15,animation:'spin 1s linear infinite'}} />Guardando...</> : <><BookmarkPlus style={{width:15,height:15}} />Crear lista</>}
            </button>
          </div>
        ) : (
          <div style={{padding:24,textAlign:'center'}}>
            <div style={{width:56,height:56,background:'rgba(34,197,94,0.15)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
              <CheckCircle2 style={{width:28,height:28,color:'#22c55e'}} />
            </div>
            <h3 style={{margin:'0 0 6px',color:'#fff',fontFamily:'Montserrat,sans-serif'}}>{propiedades.length} propiedades guardadas</h3>
            <p style={{margin:'0 0 20px',color:'rgba(255,255,255,0.4)',fontSize:13}}>La lista se actualiza automáticamente</p>

            <div style={{background:'rgba(255,255,255,0.04)',borderRadius:8,padding:14,marginBottom:20,textAlign:'left'}}>
              <p style={{margin:'0 0 6px',fontSize:10,color:'rgba(255,255,255,0.3)',fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Link para el cliente:</p>
              <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(0,0,0,0.3)',borderRadius:6,padding:'8px 12px'}}>
                <span style={{color:'#cc0000',fontSize:12,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{urlLista}</span>
                <button onClick={() => navigator.clipboard.writeText(urlLista)}
                  style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',padding:'4px 10px',borderRadius:4,fontSize:11,cursor:'pointer'}}>
                  Copiar
                </button>
              </div>
            </div>

            <div style={{display:'flex',gap:10}}>
              <button onClick={onClose} style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',padding:'10px',borderRadius:8,fontSize:12,fontWeight:700,fontFamily:'Montserrat,sans-serif',cursor:'pointer'}}>Cerrar</button>
              <a href="/crm/listas" style={{flex:1,background:'#cc0000',color:'#fff',padding:'10px',borderRadius:8,fontSize:12,fontWeight:700,fontFamily:'Montserrat,sans-serif',textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center'}}>Ver mis listas</a>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
