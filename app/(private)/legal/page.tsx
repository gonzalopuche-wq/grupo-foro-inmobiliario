'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Documento {
  id: string
  titulo: string
  descripcion: string | null
  categoria: string
  tipo: 'guia' | 'modelo' | 'normativa' | 'formulario'
  archivo_url: string | null
  contenido: string | null
  vigente: boolean
  destacado: boolean
  created_at: string
}

const CATEGORIAS = ['Todos', 'Locación', 'Compraventa', 'Mandato', 'Reservas', 'Honorarios', 'Registro', 'Impuestos', 'General']
const TIPOS: Record<string, { label: string; color: string; icon: string }> = {
  guia:       { label: 'Guía',       color: '#3b82f6', icon: '📖' },
  modelo:     { label: 'Modelo',     color: '#22c55e', icon: '📄' },
  normativa:  { label: 'Normativa',  color: '#f59e0b', icon: '⚖️' },
  formulario: { label: 'Formulario', color: '#a855f7', icon: '📋' },
}

// Documentos estáticos que siempre aparecen (base de conocimiento GFI)
const DOCS_GFI: Omit<Documento, 'id' | 'created_at'>[] = [
  {
    titulo: 'Ley 27.551 — Alquileres (texto actualizado)',
    descripcion: 'Ley de Alquileres vigente. Actualización de plazos mínimos, actualizaciones de precio, depósitos y resolución de conflictos.',
    categoria: 'Locación', tipo: 'normativa', archivo_url: null,
    contenido: `LEY 27.551 — ALQUILERES\n\nArtículo 1195 CCyC (modificado): El plazo mínimo de la locación de inmueble, cualquiera sea su destino, es de tres (3) años...\n\nActualización de precio: Los contratos de locación con destino habitacional deben ajustarse anualmente según el índice publicado por el BCRA (promedio UVA/IPC).\n\nDepósito: El depósito en garantía no puede ser mayor a un (1) mes de alquiler por cada año de contrato...\n\nRescisión anticipada: El locatario puede rescindir el contrato anticipadamente, con un preaviso de 30 días al primer año y 60 días posteriores...`,
    vigente: true, destacado: true
  },
  {
    titulo: 'Honorarios del Corredor Inmobiliario — Reglamento GFI',
    descripcion: 'Escala de honorarios sugerida por el Grupo Foro Inmobiliario para operaciones de compraventa y locación en Rosario y zona.',
    categoria: 'Honorarios', tipo: 'guia', archivo_url: null,
    contenido: `HONORARIOS GFI — ESCALA SUGERIDA\n\nCOMPRAVENTA:\n• Parte vendedora: 3% + IVA sobre precio de venta\n• Parte compradora: 3% + IVA sobre precio de venta\n• Total operación: 6% + IVA\n\nLOCACIÓN:\n• Propietario: 1 mes de alquiler + IVA\n• Inquilino: 1 mes de alquiler + IVA\n\nAUTORIZACIÓN EXCLUSIVA:\n• Porcentaje pactado según acuerdo, nunca inferior al 3%\n\nNOTA: Los honorarios son libremente pactados entre partes. Los porcentajes indicados son sugeridos por GFI en base a usos y costumbres del mercado rosarino.`,
    vigente: true, destacado: true
  },
  {
    titulo: 'Guía de Captación: Documentación necesaria',
    descripcion: 'Listado completo de documentación que el corredor debe solicitar al propietario al momento de captar una propiedad.',
    categoria: 'Mandato', tipo: 'guia', archivo_url: null,
    contenido: `DOCUMENTACIÓN PARA CAPTACIÓN\n\nDOCUMENTOS BÁSICOS:\n□ DNI del propietario (frente y dorso)\n□ Título de propiedad o Escritura traslativa\n□ Último boleto de servicios (agua, luz, gas)\n□ Plano de la propiedad (si disponible)\n□ Reglamento de copropiedad (si es PH o departamento)\n\nDOCUMENTOS ADICIONALES (recomendados):\n□ Certificado de inhibición del propietario\n□ Libre deuda de ABL/Rentas\n□ Certificado de libre deuda de expensas\n□ Informe de dominio actualizado\n\nEXCLUSIVIDAD:\nSe recomienda firmar autorización de venta exclusiva por 90 días con prórroga automática. Incluir cláusula de intermediación GFI.`,
    vigente: true, destacado: false
  },
  {
    titulo: 'Checklist: Cierre de operación de compraventa',
    descripcion: 'Paso a paso para el corredor desde la reserva hasta la escritura, incluyendo intervención del escribano y tiempos estimados.',
    categoria: 'Compraventa', tipo: 'guia', archivo_url: null,
    contenido: `CHECKLIST CIERRE DE COMPRAVENTA\n\n1. RESERVA (Día 0)\n□ Firmar boleto de reserva/seña\n□ Verificar fondos del comprador\n□ Notificar al propietario\n\n2. BOLETO DE COMPRAVENTA (Días 7-15)\n□ Elegir escribano de común acuerdo\n□ Solicitar informes de dominio e inhibición\n□ Preparar documentación completa\n□ Firma del boleto ante escribano\n□ Cobro de seña (normalmente 10-30%)\n\n3. ESCRITURA (Días 30-90)\n□ Aprobación de hipoteca (si aplica)\n□ Libre deuda de impuestos y servicios\n□ Firma ante escribano\n□ Entrega de llaves\n□ Cobro de honorarios\n\nTIEMPOS ESTIMADOS:\n• Operación contado: 30-45 días\n• Con hipoteca bancaria: 60-90 días`,
    vigente: true, destacado: false
  },
  {
    titulo: 'Normativa COCIR — Código de Ética del Corredor Inmobiliario',
    descripcion: 'Principios éticos y deberes del corredor inmobiliario matriculado según el Colegio de Corredores Inmobiliarios de Rosario.',
    categoria: 'Registro', tipo: 'normativa', archivo_url: null,
    contenido: `CÓDIGO DE ÉTICA — COCIR\n\nPRINCIPIOS FUNDAMENTALES:\n1. Honestidad y transparencia en todas las operaciones\n2. Deber de informar sobre vicios aparentes y ocultos\n3. Confidencialidad de información de las partes\n4. No representar intereses contrapuestos sin consentimiento\n5. Formación continua y actualización profesional\n\nDEBERES DEL CORREDOR:\n• Exhibir matrícula vigente en toda publicidad\n• Rendir cuentas a las partes en tiempo y forma\n• Conservar documentación por 5 años mínimo\n• Mediar únicamente en su jurisdicción habilitada\n\nSANCIONES:\nEl incumplimiento puede acarrear desde apercibimiento hasta cancelación de matrícula según gravedad.`,
    vigente: true, destacado: false
  },
  {
    titulo: 'Guía de Alquiler Temporal (Turístico)',
    descripcion: 'Marco legal y operativo para gestionar alquileres temporales y turísticos en Argentina. AirBnB, Booking y plataformas similares.',
    categoria: 'Locación', tipo: 'guia', archivo_url: null,
    contenido: `ALQUILER TEMPORAL — MARCO LEGAL\n\nDEFINICIÓN:\nEl alquiler temporal (hasta 3 meses) está regulado por el Art. 1199 CCyC y no requiere las mismas garantías que el alquiler habitacional.\n\nCARACTERÍSTICAS:\n• Sin plazo mínimo legal\n• Precio libremente pactado\n• No aplica actualización ICL\n• Garantía: depósito libre o seguro de caución\n\nPLATAFORMAS:\nAl operar en Airbnb/Booking el propietario debe:\n□ Inscribirse en AFIP como monotributista o responsable inscripto\n□ Emitir factura por los ingresos\n□ Considerar impuesto de sellos provincial\n\nROL DEL CORREDOR:\nPuede gestionar calendarios, check-in/out y mantenimiento con un contrato de administración específico.`,
    vigente: true, destacado: false
  },
]

export default function LegalPage() {
  const [documentos, setDocumentos] = useState<(Documento & { esGFI?: boolean })[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      cargar()
    })
  }, [])

  const cargar = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('documentos_legales')
      .select('*')
      .eq('vigente', true)
      .order('destacado', { ascending: false })

    const docsDB: Documento[] = (data as Documento[]) ?? []
    const docsEstaticos = DOCS_GFI.map((d, i) => ({
      ...d,
      id: `gfi-${i}`,
      created_at: '2024-01-01',
      esGFI: true,
    }))
    setDocumentos([...docsEstaticos, ...docsDB])
    setCargando(false)
  }

  const filtrados = documentos.filter(d => {
    const matchCat = filtro === 'Todos' || d.categoria === filtro
    const matchBusq = !busqueda || d.titulo.toLowerCase().includes(busqueda.toLowerCase()) || (d.descripcion ?? '').toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchBusq
  })

  const destacados = filtrados.filter(d => d.destacado)
  const resto = filtrados.filter(d => !d.destacado)

  const renderDoc = (d: Documento & { esGFI?: boolean }, key: string) => {
    const tipo = TIPOS[d.tipo] ?? TIPOS.guia
    const isOpen = abierto === d.id
    return (
      <div key={key} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${d.destacado ? 'rgba(204,0,0,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, overflow: 'hidden' }}>
        <div
          onClick={() => setAbierto(isOpen ? null : d.id)}
          style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
        >
          <div style={{ fontSize: 24, flexShrink: 0 }}>{tipo.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              {d.destacado && <span style={{ fontSize: 9, color: '#cc0000', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.1em' }}>★ DESTACADO</span>}
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{d.titulo}</span>
            </div>
            {d.descripcion && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{d.descripcion}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: tipo.color, background: `${tipo.color}18`, padding: '2px 8px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{tipo.label}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{d.categoria}</span>
            </div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, flexShrink: 0, marginTop: 2 }}>{isOpen ? '▲' : '▼'}</span>
        </div>

        {isOpen && d.contenido && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px', background: 'rgba(0,0,0,0.2)' }}>
            <pre style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>{d.contenido}</pre>
            {d.archivo_url && (
              <a href={d.archivo_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 12, padding: '8px 16px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: '#3b82f6', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat,sans-serif' }}>
                ⬇ Descargar archivo
              </a>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 0 64px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulos 70 / 71</div>
        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Documentación Legal</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          Guías, modelos y normativa para el corredor inmobiliario matriculado
        </p>
      </div>

      {/* Búsqueda */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>🔍</span>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar documento, guía o normativa..."
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '10px 12px 10px 38px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {CATEGORIAS.map(c => (
          <button key={c} onClick={() => setFiltro(c)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, background: filtro === c ? '#cc0000' : 'rgba(255,255,255,0.06)', color: filtro === c ? '#fff' : 'rgba(255,255,255,0.4)' }}>
            {c}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '48px 0' }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚖️</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No se encontraron documentos</div>
        </div>
      ) : (
        <>
          {destacados.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(204,0,0,0.6)', marginBottom: 10 }}>Documentos destacados</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {destacados.map(d => renderDoc(d, d.id))}
              </div>
            </div>
          )}
          {resto.length > 0 && (
            <div>
              {destacados.length > 0 && <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>Biblioteca completa</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resto.map(d => renderDoc(d, d.id))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
