'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Profesional {
  id: string
  nombre: string
  apellido: string
  profesion: 'escribano' | 'abogado' | 'contador'
  especialidad: string | null
  zona: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  matricula: string | null
  descripcion: string | null
  destacado: boolean
  verificado: boolean
  created_at: string
}

const PROFESIONES: Record<string, { label: string; plural: string; color: string; bg: string; icon: string }> = {
  escribano: { label: 'Escribano',  plural: 'Escribanos',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: '✍️' },
  abogado:   { label: 'Abogado',    plural: 'Abogados',    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  icon: '⚖️' },
  contador:  { label: 'Contador',   plural: 'Contadores',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: '📊' },
}

// Directorio estático base (se combina con los de la DB)
const DIRECTORIO_BASE: Omit<Profesional, 'id' | 'created_at'>[] = [
  {
    nombre: 'Roberto', apellido: 'Fernández', profesion: 'escribano',
    especialidad: 'Inmobiliario, Sociedades', zona: 'Centro', telefono: '+54 341 4220000',
    email: 'rfernandez@escribanias.com.ar', direccion: 'Córdoba 1542, Rosario',
    matricula: 'Reg. 123 – Col. Escribanos SF', descripcion: 'Especializado en operaciones inmobiliarias. Más de 20 años de experiencia en escrituras y consorcios.',
    destacado: true, verificado: true
  },
  {
    nombre: 'Marcela', apellido: 'Torres', profesion: 'escribano',
    especialidad: 'Compraventa, Hipotecas', zona: 'Norte', telefono: '+54 341 4551234',
    email: null, direccion: 'Mendoza 3200, Rosario',
    matricula: 'Reg. 241', descripcion: 'Atención personalizada. Escrituras en 48hs hábiles.',
    destacado: false, verificado: true
  },
  {
    nombre: 'Diego', apellido: 'Martínez', profesion: 'abogado',
    especialidad: 'Derecho Inmobiliario, Locaciones', zona: 'Centro', telefono: '+54 341 4280000',
    email: 'dmartinez@estudio.com.ar', direccion: 'Laprida 1020, Rosario',
    matricula: 'CSJSF T.XII F.90', descripcion: 'Redacción de contratos, defensa en desalojos y litigios inmobiliarios. Miembro GFI.',
    destacado: true, verificado: true
  },
  {
    nombre: 'Silvina', apellido: 'Gómez', profesion: 'abogado',
    especialidad: 'Sucesiones, Contratos', zona: 'Sur', telefono: '+54 341 5550000',
    email: null, direccion: null,
    matricula: 'CSJSF T.XV F.12', descripcion: 'Tramitación de sucesiones y regularización dominial.',
    destacado: false, verificado: false
  },
  {
    nombre: 'Carlos', apellido: 'Rodríguez', profesion: 'contador',
    especialidad: 'Impuesto Inmobiliario, AFIP', zona: 'Centro', telefono: '+54 341 4399000',
    email: 'carlos@estudiorodriguez.com.ar', direccion: 'Entre Ríos 480 1°B, Rosario',
    matricula: 'CPCESF Mat. 5521', descripcion: 'Asesoramiento impositivo a corredores inmobiliarios. Monotributo, relación de dependencia y ganancias.',
    destacado: true, verificado: true
  },
  {
    nombre: 'Natalia', apellido: 'López', profesion: 'contador',
    especialidad: 'PyMEs, Autónomos', zona: 'Oeste', telefono: '+54 341 6660000',
    email: null, direccion: null,
    matricula: 'CPCESF Mat. 8812', descripcion: 'Gestión contable y laboral para inmobiliarias.',
    destacado: false, verificado: true
  },
]

export default function DirectoriosPage() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [zonaFiltro, setZonaFiltro] = useState('Todas')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      cargar()
    })
  }, [])

  const cargar = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('directorio_profesionales')
      .select('*')
      .order('destacado', { ascending: false })

    const dbItems: Profesional[] = (data as Profesional[]) ?? []
    const baseItems = DIRECTORIO_BASE.map((p, i) => ({
      ...p,
      id: `base-${i}`,
      created_at: '2024-01-01',
    }))
    setProfesionales([...baseItems, ...dbItems])
    setCargando(false)
  }

  const zonas = ['Todas', ...Array.from(new Set(profesionales.map(p => p.zona).filter(Boolean) as string[]))]

  const filtrados = profesionales.filter(p => {
    const matchProf = filtro === 'todos' || p.profesion === filtro
    const matchZona = zonaFiltro === 'Todas' || p.zona === zonaFiltro
    const matchBusq = !busqueda ||
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.especialidad ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.descripcion ?? '').toLowerCase().includes(busqueda.toLowerCase())
    return matchProf && matchZona && matchBusq
  })

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 0 64px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulos 46 / 47 / 48</div>
        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Directorios Profesionales</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          Escribanos, abogados y contadores recomendados por la comunidad GFI
        </p>
      </div>

      {/* Stats rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {Object.entries(PROFESIONES).map(([k, v]) => (
          <div key={k} onClick={() => setFiltro(filtro === k ? 'todos' : k)} style={{ background: filtro === k ? v.bg : 'rgba(255,255,255,0.03)', border: `1px solid ${filtro === k ? v.color + '40' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{v.icon}</div>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 18, fontWeight: 800, color: filtro === k ? v.color : '#fff' }}>
              {profesionales.filter(p => p.profesion === k).length}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{v.plural}</div>
          </div>
        ))}
      </div>

      {/* Búsqueda y filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>🔍</span>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o especialidad..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '9px 12px 9px 32px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <select value={zonaFiltro} onChange={e => setZonaFiltro(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit' }}>
          {zonas.map(z => <option key={z} value={z} style={{ background: '#141414' }}>{z}</option>)}
        </select>
      </div>

      {/* Filtros profesión */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setFiltro('todos')} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: filtro === 'todos' ? '#cc0000' : 'rgba(255,255,255,0.06)', color: filtro === 'todos' ? '#fff' : 'rgba(255,255,255,0.4)' }}>
          Todos
        </button>
        {Object.entries(PROFESIONES).map(([k, v]) => (
          <button key={k} onClick={() => setFiltro(filtro === k ? 'todos' : k)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: filtro === k ? v.color + '22' : 'rgba(255,255,255,0.06)', color: filtro === k ? v.color : 'rgba(255,255,255,0.4)', outline: filtro === k ? `1px solid ${v.color}44` : 'none' }}>
            {v.icon} {v.plural}
          </button>
        ))}
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No se encontraron profesionales</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(p => {
            const prof = PROFESIONES[p.profesion]
            return (
              <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.destacado ? `${prof.color}25` : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {/* Avatar */}
                <div style={{ width: 48, height: 48, borderRadius: 10, background: prof.bg, border: `1px solid ${prof.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {prof.icon}
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{p.nombre} {p.apellido}</span>
                    {p.verificado && <span style={{ fontSize: 9, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 7px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>✓ VERIFICADO</span>}
                    {p.destacado && <span style={{ fontSize: 9, color: '#cc0000', fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>★ DESTACADO</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: prof.color, background: prof.bg, padding: '2px 8px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{prof.label}</span>
                    {p.especialidad && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 10 }}>{p.especialidad}</span>}
                    {p.zona && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>📍 {p.zona}</span>}
                  </div>

                  {p.descripcion && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: 8 }}>{p.descripcion}</div>}

                  {p.matricula && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>Mat. {p.matricula}</div>}

                  {p.direccion && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>📍 {p.direccion}</div>}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {p.telefono && (
                      <a href={`https://wa.me/${p.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 7, color: '#22c55e', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat,sans-serif' }}>
                        💬 {p.telefono}
                      </a>
                    )}
                    {p.email && (
                      <a href={`mailto:${p.email}`} style={{ padding: '5px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 7, color: '#3b82f6', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat,sans-serif' }}>
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

      {/* Nota de contribución */}
      <div style={{ marginTop: 28, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px', fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
        ¿Querés sugerir un profesional para el directorio? Escribinos al grupo de comunidad GFI o contactá al administrador de la plataforma.
      </div>
    </div>
  )
}
