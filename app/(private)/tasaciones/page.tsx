'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface TasacionResult {
  valor_min: number
  valor_max: number
  valor_sugerido: number
  precio_m2: number
  moneda: string
  alquiler_estimado: number | null
  analisis: string
  factores_positivos: string[]
  factores_negativos: string[]
  comparables: { descripcion: string; precio: number; m2: number }[]
  recomendacion: string
}

interface TasacionHistorial {
  id: string
  usuario_id: string
  datos_propiedad: any
  resultado: TasacionResult
  created_at: string
}

const TIPOS_PROPIEDAD = ['Casa', 'Departamento', 'PH', 'Local comercial', 'Oficina', 'Terreno', 'Galpón', 'Campo']
const OPERACIONES = ['Venta', 'Alquiler']
const ESTADOS_CONSERVACION = ['Excelente', 'Muy bueno', 'Bueno', 'Regular', 'A reciclar']

const FORM_VACIO = {
  tipo: 'Departamento',
  operacion: 'Venta',
  direccion: '',
  barrio: '',
  sup_cubierta: '',
  sup_total: '',
  ambientes: '',
  dormitorios: '',
  banos: '',
  antiguedad: '',
  estado: 'Bueno',
  piso: '',
  cochera: false,
  amenities: '',
  observaciones: '',
}

export default function TasacionesPage() {
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState(FORM_VACIO)
  const [tasando, setTasando] = useState(false)
  const [resultado, setResultado] = useState<TasacionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historial, setHistorial] = useState<TasacionHistorial[]>([])
  const [mostrandoHistorial, setMostrandoHistorial] = useState(false)
  const [verDetalle, setVerDetalle] = useState<TasacionHistorial | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const mostrarToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)
      cargarHistorial(data.user.id)
    })
  }, [])

  const cargarHistorial = async (uid: string) => {
    const { data } = await supabase
      .from('tasaciones_historial')
      .select('*')
      .eq('usuario_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
    setHistorial((data as TasacionHistorial[]) ?? [])
  }

  const tasar = async () => {
    if (!form.sup_cubierta || !form.ambientes || !form.barrio) {
      setError('Completá al menos barrio, superficie cubierta y ambientes.')
      return
    }
    setTasando(true)
    setResultado(null)
    setError(null)

    try {
      const res = await fetch('/api/tasador-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setTasando(false); return }

      setResultado(data as TasacionResult)

      await supabase.from('tasaciones_historial').insert({
        usuario_id: userId,
        datos_propiedad: form,
        resultado: data,
      })
      cargarHistorial(userId)
      mostrarToast('✅ Tasación guardada en historial')
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    }
    setTasando(false)
  }

  const copiarResultado = () => {
    if (!resultado) return
    const txt = `TASACIÓN IA GFI® — ${new Date().toLocaleDateString('es-AR')}
Propiedad: ${form.tipo} · ${form.barrio}
Superficie: ${form.sup_cubierta} m²

VALUACIÓN:
• Valor mínimo: USD ${resultado.valor_min.toLocaleString('es-AR')}
• Valor máximo: USD ${resultado.valor_max.toLocaleString('es-AR')}
• Valor sugerido: USD ${resultado.valor_sugerido.toLocaleString('es-AR')}
• Precio/m²: USD ${resultado.precio_m2.toLocaleString('es-AR')}
${resultado.alquiler_estimado ? `• Alquiler estimado: ARS ${resultado.alquiler_estimado.toLocaleString('es-AR')}/mes` : ''}

ANÁLISIS:
${resultado.analisis}

FACTORES POSITIVOS:
${resultado.factores_positivos.map(f => `+ ${f}`).join('\n')}

FACTORES NEGATIVOS:
${resultado.factores_negativos.map(f => `- ${f}`).join('\n')}

RECOMENDACIÓN:
${resultado.recomendacion}`
    navigator.clipboard.writeText(txt)
    mostrarToast('📋 Tasación copiada')
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 0 64px' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>Módulo IA</div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Tasador IA</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            Tasaciones instantáneas con inteligencia artificial · {historial.length} en historial
          </p>
        </div>
        <button onClick={() => setMostrandoHistorial(h => !h)} style={{ padding: '9px 18px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {mostrandoHistorial ? '← Volver' : '📋 Historial'}
        </button>
      </div>

      {mostrandoHistorial ? (
        /* HISTORIAL */
        <div>
          {historial.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 0', color: 'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏠</div>
              <div style={{ fontSize: 14 }}>Todavía no realizaste tasaciones</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historial.map(t => (
                <div key={t.id} onClick={() => setVerDetalle(t)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏠</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
                      {t.datos_propiedad?.tipo} · {t.datos_propiedad?.barrio}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {t.datos_propiedad?.sup_cubierta} m² · {t.datos_propiedad?.ambientes} amb.
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#cc0000', fontFamily: 'Montserrat,sans-serif' }}>
                      USD {t.resultado?.valor_sugerido?.toLocaleString('es-AR')}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                      {new Date(t.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* FORMULARIO + RESULTADO */
        <div style={{ display: 'grid', gridTemplateColumns: resultado ? '1fr 1fr' : '1fr', gap: 20 }}>

          {/* Formulario */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Datos de la propiedad</div>

            {/* Tipo y operación */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Tipo</label>
                <select value={form.tipo} onChange={e => setF('tipo', e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }}>
                  {TIPOS_PROPIEDAD.map(t => <option key={t} value={t} style={{ background: '#141414' }}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Operación</label>
                <select value={form.operacion} onChange={e => setF('operacion', e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }}>
                  {OPERACIONES.map(o => <option key={o} value={o} style={{ background: '#141414' }}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Dirección y barrio */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Barrio / Zona *</label>
              <input value={form.barrio} onChange={e => setF('barrio', e.target.value)} placeholder="Ej: Alberdi, Fisherton, Centro..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Dirección (opcional)</label>
              <input value={form.direccion} onChange={e => setF('direccion', e.target.value)} placeholder="Ej: Av. Pellegrini 1200" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            {/* Superficies */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Sup. cubierta m² *</label>
                <input type="number" value={form.sup_cubierta} onChange={e => setF('sup_cubierta', e.target.value)} placeholder="65" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Sup. total m²</label>
                <input type="number" value={form.sup_total} onChange={e => setF('sup_total', e.target.value)} placeholder="80" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Ambientes, dormitorios, baños */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { key: 'ambientes', label: 'Ambientes *', ph: '3' },
                { key: 'dormitorios', label: 'Dormitorios', ph: '2' },
                { key: 'banos', label: 'Baños', ph: '1' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input type="number" value={(form as any)[f.key]} onChange={e => setF(f.key, e.target.value)} placeholder={f.ph} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>

            {/* Antigüedad, estado, piso */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Antigüedad (años)</label>
                <input type="number" value={form.antiguedad} onChange={e => setF('antiguedad', e.target.value)} placeholder="10" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Estado</label>
                <select value={form.estado} onChange={e => setF('estado', e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }}>
                  {ESTADOS_CONSERVACION.map(e => <option key={e} value={e} style={{ background: '#141414' }}>{e}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Piso</label>
                <input value={form.piso} onChange={e => setF('piso', e.target.value)} placeholder="3° A" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Cochera y extras */}
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="cochera" checked={form.cochera} onChange={e => setF('cochera', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="cochera" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Incluye cochera</label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Amenities</label>
              <input value={form.amenities} onChange={e => setF('amenities', e.target.value)} placeholder="Ej: Pileta, gym, laundry..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Observaciones</label>
              <textarea value={form.observaciones} onChange={e => setF('observaciones', e.target.value)} placeholder="Vistas, reformas, particularidades del inmueble..." rows={2} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>{error}</div>}

            <button
              onClick={tasar}
              disabled={tasando}
              style={{ width: '100%', padding: '12px', background: tasando ? 'rgba(204,0,0,0.5)' : '#cc0000', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'Montserrat,sans-serif', fontSize: 14, fontWeight: 800, cursor: tasando ? 'not-allowed' : 'pointer', letterSpacing: '0.06em' }}
            >
              {tasando ? '🤖 Analizando con IA...' : '🏠 Tasar con IA'}
            </button>
            {tasando && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                Consultando mercado rosarino · Puede demorar 15–30 segundos
              </div>
            )}
          </div>

          {/* Resultado */}
          {resultado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Valores */}
              <div style={{ background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.2)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 11, fontWeight: 700, color: 'rgba(204,0,0,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Valuación estimada</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Valor sugerido', val: `USD ${resultado.valor_sugerido.toLocaleString('es-AR')}`, highlight: true },
                    { label: 'Precio / m²', val: `USD ${resultado.precio_m2.toLocaleString('es-AR')}`, highlight: false },
                    { label: 'Rango mínimo', val: `USD ${resultado.valor_min.toLocaleString('es-AR')}`, highlight: false },
                    { label: 'Rango máximo', val: `USD ${resultado.valor_max.toLocaleString('es-AR')}`, highlight: false },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '12px', background: s.highlight ? 'rgba(204,0,0,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: 8, border: s.highlight ? '1px solid rgba(204,0,0,0.25)' : '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: s.highlight ? 20 : 15, fontWeight: 800, color: s.highlight ? '#cc0000' : '#fff', fontFamily: 'Montserrat,sans-serif' }}>{s.val}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {resultado.alquiler_estimado && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>Alquiler estimado: ARS {resultado.alquiler_estimado.toLocaleString('es-AR')}/mes</span>
                  </div>
                )}
              </div>

              {/* Análisis */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Análisis de mercado</div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: 0 }}>{resultado.analisis}</p>
              </div>

              {/* Factores */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 10, fontWeight: 700, color: '#22c55e', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Positivos</div>
                  {resultado.factores_positivos.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 5, paddingLeft: 14, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: '#22c55e' }}>+</span>{f}
                    </div>
                  ))}
                </div>
                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 10, fontWeight: 700, color: '#ef4444', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Negativos</div>
                  {resultado.factores_negativos.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 5, paddingLeft: 14, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: '#ef4444' }}>−</span>{f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparables */}
              {resultado.comparables && resultado.comparables.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Comparables de mercado</div>
                  {resultado.comparables.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < resultado.comparables.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', flex: 1 }}>{c.descripcion}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>USD {c.precio.toLocaleString('es-AR')}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{c.m2} m²</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recomendación */}
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 10, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Recomendación</div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>{resultado.recomendacion}</p>
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copiarResultado} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                  📋 Copiar tasación
                </button>
                <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                  🖨 Imprimir
                </button>
              </div>

              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', lineHeight: 1.5 }}>
                ⚠ Esta tasación es una estimación generada por IA con fines orientativos. No reemplaza la tasación profesional de un corredor matriculado. Los valores pueden diferir del mercado actual.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal detalle historial */}
      {verDetalle && (
        <div onClick={e => { if (e.target === e.currentTarget) setVerDetalle(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 540, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {verDetalle.datos_propiedad?.tipo} · {verDetalle.datos_propiedad?.barrio}
              </div>
              <button onClick={() => setVerDetalle(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#cc0000', fontFamily: 'Montserrat,sans-serif', marginBottom: 8 }}>
              USD {verDetalle.resultado?.valor_sugerido?.toLocaleString('es-AR')}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
              {new Date(verDetalle.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>{verDetalle.resultado?.analisis}</p>
            <p style={{ fontSize: 13, color: 'rgba(59,130,246,0.8)', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 12 }}>
              <strong style={{ color: '#3b82f6' }}>Recomendación: </strong>{verDetalle.resultado?.recomendacion}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
