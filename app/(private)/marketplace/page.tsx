'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Publicacion {
  id: string
  titulo: string
  descripcion: string
  tipo: 'venta' | 'servicio' | 'busqueda' | 'trabajo'
  categoria: string
  precio: number | null
  moneda: string | null
  contacto_whatsapp: string | null
  contacto_email: string | null
  autor_id: string
  autor_nombre: string | null
  activa: boolean
  created_at: string
}

const TIPOS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  venta:    { label: 'Vendo',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  icon: '🏷️' },
  servicio: { label: 'Ofrezco',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '🔧' },
  busqueda: { label: 'Busco',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🔍' },
  trabajo:  { label: 'Empleo',   color: '#a855f7', bg: 'rgba(168,85,247,0.1)', icon: '💼' },
}

const CATEGORIAS_VENTA = ['Equipamiento', 'Software', 'Muebles', 'Vehículo', 'Otro']
const CATEGORIAS_SERVICIO = ['Fotografía', 'Marketing', 'Legal', 'Contable', 'Diseño', 'IT', 'Reforma', 'Otro']
const CATEGORIAS_TRABAJO = ['Corredor', 'Administrativo', 'Marketing', 'IT', 'Otro']

type TipoPublicacion = 'venta' | 'servicio' | 'busqueda' | 'trabajo'

const FORM_VACIO: { titulo: string; descripcion: string; tipo: TipoPublicacion; categoria: string; precio: string; moneda: string; contacto_whatsapp: string; contacto_email: string } = {
  titulo: '', descripcion: '', tipo: 'venta', categoria: '', precio: '', moneda: 'ARS', contacto_whatsapp: '', contacto_email: ''
}

export default function MarketplacePage() {
  const [userId, setUserId] = useState('')
  const [userNombre, setUserNombre] = useState('')
  const [items, setItems] = useState<Publicacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [filtro, setFiltro] = useState<string>('todos')
  const [toast, setToast] = useState<string | null>(null)

  const mostrarToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)
      supabase.from('perfiles').select('nombre, apellido').eq('id', data.user.id).single().then(({ data: p }) => {
        if (p) setUserNombre(`${p.nombre ?? ''} ${p.apellido ?? ''}`.trim())
      })
      cargar()
    })
  }, [])

  const cargar = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('marketplace')
      .select('*')
      .eq('activa', true)
      .order('created_at', { ascending: false })
    setItems((data as Publicacion[]) ?? [])
    setCargando(false)
  }

  const guardar = async () => {
    if (!form.titulo.trim() || !form.descripcion.trim()) return
    setGuardando(true)
    await supabase.from('marketplace').insert({
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      tipo: form.tipo,
      categoria: form.categoria || null,
      precio: form.precio ? parseFloat(form.precio) : null,
      moneda: form.precio ? form.moneda : null,
      contacto_whatsapp: form.contacto_whatsapp.trim() || null,
      contacto_email: form.contacto_email.trim() || null,
      autor_id: userId,
      autor_nombre: userNombre || null,
      activa: true,
    })
    setModal(false)
    setForm(FORM_VACIO)
    setGuardando(false)
    mostrarToast('✅ Publicación creada')
    cargar()
  }

  const eliminar = async (id: string) => {
    await supabase.from('marketplace').update({ activa: false }).eq('id', id).eq('autor_id', userId)
    mostrarToast('Publicación eliminada')
    cargar()
  }

  const filtrados = filtro === 'todos' ? items : items.filter(i => i.tipo === filtro)

  const getCategorias = (tipo: TipoPublicacion) => {
    if (tipo === 'venta') return CATEGORIAS_VENTA
    if (tipo === 'servicio' || tipo === 'busqueda') return CATEGORIAS_SERVICIO
    return CATEGORIAS_TRABAJO
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 0 64px' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulos 50 / 51</div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Marketplace GFI</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            Intercambiá servicios, equipamiento y oportunidades laborales entre miembros
          </p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding: '10px 20px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Publicar
        </button>
      </div>

      {/* Filtros tipo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFiltro('todos')} style={{ padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: filtro === 'todos' ? '#cc0000' : 'rgba(255,255,255,0.06)', color: filtro === 'todos' ? '#fff' : 'rgba(255,255,255,0.4)' }}>
          Todos ({items.length})
        </button>
        {Object.entries(TIPOS).map(([k, v]) => (
          <button key={k} onClick={() => setFiltro(k)} style={{ padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: filtro === k ? v.color + '22' : 'rgba(255,255,255,0.06)', color: filtro === k ? v.color : 'rgba(255,255,255,0.4)', outline: filtro === k ? `1px solid ${v.color}44` : 'none' }}>
            {v.icon} {v.label} ({items.filter(i => i.tipo === k).length})
          </button>
        ))}
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏪</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginBottom: 8 }}>
            {filtro === 'todos' ? 'Todavía no hay publicaciones' : `No hay publicaciones de tipo "${TIPOS[filtro]?.label}"`}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Sé el primero en publicar algo útil para la comunidad GFI</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {filtrados.map(item => {
            const tipo = TIPOS[item.tipo]
            return (
              <div key={item.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: tipo.color, background: tipo.bg, padding: '3px 8px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{tipo.icon} {tipo.label}</span>
                      {item.categoria && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>{item.categoria}</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{item.titulo}</div>
                  </div>
                  {item.autor_id === userId && (
                    <button onClick={() => eliminar(item.id)} style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, color: '#ef4444', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                  )}
                </div>

                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{item.descripcion}</div>

                {item.precio && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: tipo.color, fontFamily: 'Montserrat,sans-serif' }}>
                    {item.moneda} {item.precio.toLocaleString('es-AR')}
                  </div>
                )}

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    {item.autor_nombre && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{item.autor_nombre}</div>}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                      {new Date(item.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {item.contacto_whatsapp && (
                      <a href={`https://wa.me/${item.contacto_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 7, color: '#22c55e', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat,sans-serif' }}>
                        💬 WhatsApp
                      </a>
                    )}
                    {item.contacto_email && (
                      <a href={`mailto:${item.contacto_email}`} style={{ padding: '5px 10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 7, color: '#3b82f6', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat,sans-serif' }}>
                        ✉ Email
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Nueva publicación</div>

            {/* Tipo */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Tipo</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {(Object.entries(TIPOS) as [TipoPublicacion, typeof TIPOS[string]][]).map(([k, v]) => (
                  <button key={k} onClick={() => setForm(f => ({ ...f, tipo: k, categoria: '' }))} style={{ padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: form.tipo === k ? v.color + '22' : 'rgba(255,255,255,0.04)', color: form.tipo === k ? v.color : 'rgba(255,255,255,0.4)', outline: form.tipo === k ? `1px solid ${v.color}44` : 'none', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{v.icon}</div>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Título *</label>
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título de la publicación" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Descripción *</label>
              <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Describí lo que ofrecés o buscás..." rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Categoría</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }}>
                  <option value="" style={{ background: '#141414' }}>— Sin categoría —</option>
                  {getCategorias(form.tipo).map(c => <option key={c} value={c} style={{ background: '#141414' }}>{c}</option>)}
                </select>
              </div>
              {(form.tipo === 'venta' || form.tipo === 'servicio') && (
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Precio</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 8px', fontSize: 13, fontFamily: 'inherit', width: 60 }}>
                      <option value="ARS" style={{ background: '#141414' }}>$</option>
                      <option value="USD" style={{ background: '#141414' }}>U$D</option>
                    </select>
                    <input type="number" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} placeholder="0" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>WhatsApp</label>
                <input value={form.contacto_whatsapp} onChange={e => setForm(f => ({ ...f, contacto_whatsapp: e.target.value }))} placeholder="+54 341 ..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Email</label>
                <input type="email" value={form.contacto_email} onChange={e => setForm(f => ({ ...f, contacto_email: e.target.value }))} placeholder="email@ejemplo.com" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '10px 20px', background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando || !form.titulo.trim() || !form.descripcion.trim()} style={{ padding: '10px 24px', background: '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: guardando || !form.titulo.trim() || !form.descripcion.trim() ? 0.5 : 1 }}>
                {guardando ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
