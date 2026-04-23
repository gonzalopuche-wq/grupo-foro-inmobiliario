// app/(private)/components/IndicadoresWidget.tsx
// Widget reutilizable para mostrar ICL, IPC y Valor JUS con historial
'use client'

import { useEffect, useState } from 'react'

interface IndicadorData {
  actual: number | null
  periodo: string | null
  descripcion: string | null
  actualizado_at: string | null
  historial?: { valor: number; periodo: string; descripcion: string }[]
  fuente: string
}

interface IndicadoresData {
  icl: IndicadorData
  ipc: IndicadorData
  valor_jus: { actual: number | null; descripcion: string | null; actualizado_at: string | null }
}

interface Props {
  meses?: 3 | 4 | 6 | 12
  mostrarHistorial?: boolean
  compact?: boolean
}

const formatNum = (n: number | null, decimales = 2) =>
  n !== null ? n.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) : null

const formatPeriodo = (p: string | null) => {
  if (!p) return null
  const [año, mes] = p.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${meses[parseInt(mes) - 1]} ${año}`
}

export default function IndicadoresWidget({ meses = 6, mostrarHistorial = false, compact = false }: Props) {
  const [data, setData] = useState<IndicadoresData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [mesesSeleccionados, setMesesSeleccionados] = useState(meses)
  const [expandido, setExpandido] = useState<'icl' | 'ipc' | null>(null)

  useEffect(() => {
    cargar()
  }, [mesesSeleccionados])

  const cargar = async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/indicadores?meses=${mesesSeleccionados}`)
      const d = await res.json()
      setData(d)
    } catch (err) {
      console.error('Error cargando indicadores:', err)
    } finally {
      setCargando(false)
    }
  }

  if (compact) {
    // Versión compacta para el dashboard
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {/* ICL */}
        <div style={{ background: 'rgba(14,14,14,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
            ICL DIARIO · BCRA
          </div>
          {cargando ? (
            <div style={{ width: 80, height: 20, background: 'rgba(255,255,255,0.06)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
          ) : data?.icl.actual !== null ? (
            <>
              <div style={{ fontSize: 22, fontFamily: 'Montserrat,sans-serif', fontWeight: 800, color: '#fff' }}>
                {formatNum(data!.icl.actual)}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                {formatPeriodo(data!.icl.periodo) || 'Último disponible'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Sin datos BCRA</div>
          )}
        </div>

        {/* IPC */}
        <div style={{ background: 'rgba(14,14,14,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
            IPC MENSUAL · INDEC
          </div>
          {cargando ? (
            <div style={{ width: 60, height: 20, background: 'rgba(255,255,255,0.06)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
          ) : data?.ipc.actual !== null ? (
            <>
              <div style={{ fontSize: 22, fontFamily: 'Montserrat,sans-serif', fontWeight: 800, color: '#fff' }}>
                {formatNum(data!.ipc.actual, 1)}%
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                {formatPeriodo(data!.ipc.periodo) || 'Último disponible'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Sin datos INDEC</div>
          )}
        </div>

        {/* Valor JUS */}
        {data?.valor_jus.actual && (
          <div style={{ background: 'rgba(14,14,14,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '14px 18px' }}>
            <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
              VALOR JUS · COCIR
            </div>
            <div style={{ fontSize: 18, fontFamily: 'Montserrat,sans-serif', fontWeight: 800, color: '#fff' }}>
              $ {formatNum(data.valor_jus.actual)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>Ley 13.154</div>
          </div>
        )}
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
      </div>
    )
  }

  // Versión completa para el módulo Cotizaciones
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Selector de período */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
          📊 Índices económicos
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[3, 4, 6, 12].map(m => (
            <button key={m} onClick={() => setMesesSeleccionados(m as any)}
              style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${mesesSeleccionados === m ? '#cc0000' : 'rgba(255,255,255,0.1)'}`, background: mesesSeleccionados === m ? 'rgba(200,0,0,0.1)' : 'transparent', color: mesesSeleccionados === m ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer' }}>
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* Cards ICL + IPC + JUS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>

        {/* ICL */}
        <div style={{ background: 'rgba(14,14,14,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '16px 20px', cursor: mostrarHistorial ? 'pointer' : 'default' }}
          onClick={() => mostrarHistorial && setExpandido(expandido === 'icl' ? null : 'icl')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
              ICL DIARIO · BCRA
            </div>
            {mostrarHistorial && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{expandido === 'icl' ? '▲' : '▼'}</span>}
          </div>
          {cargando ? (
            <div style={{ width: 100, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
          ) : data?.icl.actual !== null ? (
            <>
              <div style={{ fontSize: 28, fontFamily: 'Montserrat,sans-serif', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {formatNum(data!.icl.actual)}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 5 }}>
                {formatPeriodo(data!.icl.periodo)} · Último disponible
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Sin conexión BCRA</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>Mostrando último valor guardado</div>
            </div>
          )}

          {/* Historial ICL */}
          {mostrarHistorial && expandido === 'icl' && data?.icl.historial && data.icl.historial.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
              <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
                Historial {mesesSeleccionados} meses
              </div>
              {data.icl.historial.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>{formatPeriodo(h.periodo)}</span>
                  <span style={{ color: '#60a5fa', fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{formatNum(h.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* IPC */}
        <div style={{ background: 'rgba(14,14,14,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '16px 20px', cursor: mostrarHistorial ? 'pointer' : 'default' }}
          onClick={() => mostrarHistorial && setExpandido(expandido === 'ipc' ? null : 'ipc')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
              IPC MENSUAL · INDEC
            </div>
            {mostrarHistorial && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{expandido === 'ipc' ? '▲' : '▼'}</span>}
          </div>
          {cargando ? (
            <div style={{ width: 80, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
          ) : data?.ipc.actual !== null ? (
            <>
              <div style={{ fontSize: 28, fontFamily: 'Montserrat,sans-serif', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {formatNum(data!.ipc.actual, 1)}%
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 5 }}>
                {formatPeriodo(data!.ipc.periodo)} · Variación mensual
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Sin conexión INDEC</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>Mostrando último valor guardado</div>
            </div>
          )}

          {/* Historial IPC */}
          {mostrarHistorial && expandido === 'ipc' && data?.ipc.historial && data.ipc.historial.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
              <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
                Historial {mesesSeleccionados} meses
              </div>
              {data.ipc.historial.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>{formatPeriodo(h.periodo)}</span>
                  <span style={{ color: '#22c55e', fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>{formatNum(h.valor, 1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Valor JUS */}
        <div style={{ background: 'rgba(14,14,14,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
            VALOR JUS · COCIR 2DA CIRC.
          </div>
          {cargando ? (
            <div style={{ width: 120, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
          ) : data?.valor_jus.actual ? (
            <>
              <div style={{ fontSize: 22, fontFamily: 'Montserrat,sans-serif', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                $ {formatNum(data.valor_jus.actual)}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 5 }}>Ley 13.154 · Honorarios</div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Sin datos</div>
          )}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </div>
  )
}
