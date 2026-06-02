'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface ComparableReal {
  portal: string
  titulo: string
  precio: number
  moneda: string
  m2: number | null
  barrio: string
  url: string
}

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
  comparables_reales: ComparableReal[]
  comparables_justificaciones?: string[]
  justificacion_valor_hoy?: string
  recomendacion: string
  _portales_consultados?: string[]
  _total_comparables_encontrados?: number
  _red_gfi_count?: number
  _comparables_tipo?: 'reales' | 'busqueda'
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

const REDES = [
  { value: 'todas',     label: 'Todas las redes' },
  { value: 'gfi',       label: 'Red GFI' },
  { value: 'propia',    label: 'Propia' },
  { value: 'red_propia',label: 'Red Propia' },
]

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
  red: 'todas',
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
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/tasador-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
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

  const exportarPDF = () => {
    if (!resultado) return
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Tasación GFI® — ${form.barrio}</title>
<style>
  body { font-family: 'Georgia',serif; color: #111; margin: 0; padding: 32px 40px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; font-weight: 700; color: #cc0000; margin: 0 0 4px; letter-spacing: -0.02em; }
  .subtitle { color: #666; font-size: 12px; margin-bottom: 28px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .kpi { background: #f8f8f8; border: 1px solid #e8e8e8; border-radius: 6px; padding: 14px 16px; }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; font-family: sans-serif; margin-bottom: 4px; }
  .kpi-val { font-size: 18px; font-weight: 700; color: #111; font-family: sans-serif; }
  .kpi-val.highlight { color: #cc0000; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #888; font-family: sans-serif; border-bottom: 1px solid #e0e0e0; padding-bottom: 5px; margin-bottom: 10px; }
  .analisis { color: #333; }
  .factor-list { margin: 0; padding-left: 18px; }
  .factor-list li { margin-bottom: 3px; }
  .factor-pos { color: #166534; }
  .factor-neg { color: #991b1b; }
  .comp-card { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 5px; padding: 10px 14px; margin-bottom: 8px; }
  .comp-portal { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-family: sans-serif; }
  .comp-titulo { font-weight: 600; color: #111; margin: 2px 0; }
  .comp-meta { font-size: 11px; color: #555; }
  .rec { background: #fff8f0; border-left: 3px solid #f97316; padding: 10px 14px; font-style: italic; color: #333; margin-top: 6px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #aaa; text-align: center; font-family: sans-serif; }
  @media print { @page { margin: 1.5cm; } }
</style>
</head>
<body>
<h1>Tasación IA GFI®</h1>
<div class="subtitle">${form.tipo} · ${form.barrio} · ${form.sup_cubierta} m² · ${form.ambientes} amb. · Fecha: ${fecha}</div>

<div class="grid">
  <div class="kpi"><div class="kpi-label">Valor sugerido</div><div class="kpi-val highlight">USD ${resultado.valor_sugerido.toLocaleString('es-AR')}</div></div>
  <div class="kpi"><div class="kpi-label">Rango</div><div class="kpi-val">USD ${resultado.valor_min.toLocaleString('es-AR')} – ${resultado.valor_max.toLocaleString('es-AR')}</div></div>
  <div class="kpi"><div class="kpi-label">Precio/m²</div><div class="kpi-val">USD ${resultado.precio_m2.toLocaleString('es-AR')}/m²</div></div>
  ${resultado.alquiler_estimado ? `<div class="kpi"><div class="kpi-label">Alquiler estimado</div><div class="kpi-val">ARS ${resultado.alquiler_estimado.toLocaleString('es-AR')}/mes</div></div>` : ''}
</div>

${resultado.justificacion_valor_hoy ? `<div class="section"><div class="section-title">Justificación del valor</div><div class="analisis">${resultado.justificacion_valor_hoy}</div></div>` : ''}

<div class="section"><div class="section-title">Análisis de mercado</div><div class="analisis">${resultado.analisis}</div></div>

${resultado.factores_positivos.length > 0 ? `<div class="section"><div class="section-title">Factores positivos</div><ul class="factor-list">${resultado.factores_positivos.map(f => `<li class="factor-pos">${f}</li>`).join('')}</ul></div>` : ''}
${resultado.factores_negativos.length > 0 ? `<div class="section"><div class="section-title">Factores negativos</div><ul class="factor-list">${resultado.factores_negativos.map(f => `<li class="factor-neg">${f}</li>`).join('')}</ul></div>` : ''}

${resultado.comparables_reales && resultado.comparables_reales.length > 0 ? `<div class="section"><div class="section-title">Comparables reales utilizados</div>${resultado.comparables_reales.map((c, i) => { const sup = c.m2 ?? 0; return `<div class="comp-card"><div class="comp-portal">${c.portal ?? 'Portal'}</div><div class="comp-titulo">${c.titulo}</div><div class="comp-meta">${sup > 0 ? `${sup} m² · ` : ''}USD ${c.precio.toLocaleString('es-AR')}${sup > 0 ? ` · USD ${Math.round(c.precio / sup).toLocaleString('es-AR')}/m²` : ''}${resultado.comparables_justificaciones?.[i] ? ` · ${resultado.comparables_justificaciones[i]}` : ''}</div></div>`; }).join('')}</div>` : ''}

<div class="section"><div class="section-title">Recomendación</div><div class="rec">${resultado.recomendacion}</div></div>

<div class="footer">Tasación generada por IA · Grupo Foro Inmobiliario · ${fecha} · Este informe es orientativo y no reemplaza una tasación profesional certificada.</div>
</body>
</html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); }, 400)
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
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { background: #fff !important; }
          .sidebar, .topbar, .sidebar-overlay { display: none !important; }
          .main-content { margin-left: 0 !important; }
          .page-content { padding: 0 !important; }
          .no-print { display: none !important; }
          * { color: #111 !important; background: transparent !important; border-color: #e0e0e0 !important; box-shadow: none !important; }
          a { color: #1a56db !important; }
        }
        .tas-label { display: block; font-family: var(--font-display); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gfi-text-secondary); margin-bottom: 5px; }
        .tas-input { width: 100%; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); padding: 8px 10px; font-size: 13px; font-family: var(--font-body); box-sizing: border-box; outline: none; transition: var(--gfi-transition); }
        .tas-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .tas-input::placeholder { color: var(--gfi-text-muted); }
        .tas-select { width: 100%; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); padding: 8px 10px; font-size: 13px; font-family: var(--font-body); outline: none; }
        .tas-select option { background: var(--gfi-bg-panel); }
        .tas-select:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .tas-textarea { width: 100%; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); padding: 8px 10px; font-size: 13px; font-family: var(--font-body); resize: vertical; box-sizing: border-box; outline: none; transition: var(--gfi-transition); }
        .tas-textarea:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .tas-textarea::placeholder { color: var(--gfi-text-muted); }
      `}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--gfi-bg-elevated)', border: '1px solid var(--gfi-border)', color: 'var(--gfi-text-primary)', padding: '10px 20px', borderRadius: 'var(--gfi-radius-md)', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, zIndex: 999, boxShadow: 'var(--gfi-shadow-md)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="gfi-section-title" style={{ marginBottom: 6, fontSize: 9 }}>Módulo IA</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--gfi-text-primary)', margin: 0 }}>Tasador <span style={{ color: 'var(--gfi-red)' }}>IA</span></h1>
          <p style={{ fontSize: 12, color: 'var(--gfi-text-secondary)', marginTop: 4 }}>
            Tasaciones instantáneas con inteligencia artificial · <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--gfi-red)' }}>{historial.length}</span> en historial
          </p>
        </div>
        <button className="no-print gfi-btn gfi-btn--secondary" onClick={() => setMostrandoHistorial(h => !h)} style={{ borderRadius: 'var(--gfi-radius-md)' }}>
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
                <div key={t.id} onClick={() => setVerDetalle(t)} className="gfi-card" style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--gfi-radius-md)', background: 'var(--gfi-red-soft)', border: '1px solid var(--gfi-red-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏠</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
                      {t.datos_propiedad?.tipo} · {t.datos_propiedad?.barrio}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {t.datos_propiedad?.sup_cubierta} m² · {t.datos_propiedad?.ambientes} amb.
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="gfi-price-usd" style={{ fontSize: 16 }}>
                      USD {t.resultado?.valor_sugerido?.toLocaleString('es-AR')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--gfi-text-muted)', marginTop: 2 }}>
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
          <div className="no-print gfi-card">
            <div className="gfi-section-title" style={{ marginBottom: 16 }}>Datos de la propiedad</div>

            {/* Tipo y operación */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label className="tas-label">Tipo</label>
                <select value={form.tipo} onChange={e => setF('tipo', e.target.value)} className="tas-select">
                  {TIPOS_PROPIEDAD.map(t => <option key={t} value={t} style={{ background: '#141414' }}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="tas-label">Operación</label>
                <select value={form.operacion} onChange={e => setF('operacion', e.target.value)} className="tas-select">
                  {OPERACIONES.map(o => <option key={o} value={o} style={{ background: '#141414' }}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Dirección y barrio */}
            <div style={{ marginBottom: 12 }}>
              <label className="tas-label">Barrio / Zona *</label>
              <input value={form.barrio} onChange={e => setF('barrio', e.target.value)} placeholder="Ej: Alberdi, Fisherton, Centro..." className="tas-input" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="tas-label">Dirección (opcional)</label>
              <input value={form.direccion} onChange={e => setF('direccion', e.target.value)} placeholder="Ej: Av. Pellegrini 1200" className="tas-input" />
            </div>

            {/* Superficies */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="tas-label">Sup. cubierta m² *</label>
                <input type="number" value={form.sup_cubierta} onChange={e => setF('sup_cubierta', e.target.value)} placeholder="65" className="tas-input" />
              </div>
              <div>
                <label className="tas-label">Sup. total m²</label>
                <input type="number" value={form.sup_total} onChange={e => setF('sup_total', e.target.value)} placeholder="80" className="tas-input" />
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
                  <label className="tas-label">{f.label}</label>
                  <input type="number" value={(form as any)[f.key]} onChange={e => setF(f.key, e.target.value)} placeholder={f.ph} className="tas-input" />
                </div>
              ))}
            </div>

            {/* Antigüedad, estado, piso */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="tas-label">Antigüedad (años)</label>
                <input type="number" value={form.antiguedad} onChange={e => setF('antiguedad', e.target.value)} placeholder="10" className="tas-input" />
              </div>
              <div>
                <label className="tas-label">Estado</label>
                <select value={form.estado} onChange={e => setF('estado', e.target.value)} className="tas-select">
                  {ESTADOS_CONSERVACION.map(e => <option key={e} value={e} style={{ background: '#141414' }}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="tas-label">Piso</label>
                <input value={form.piso} onChange={e => setF('piso', e.target.value)} placeholder="3° A" className="tas-input" />
              </div>
            </div>

            {/* Cochera y extras */}
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="cochera" checked={form.cochera} onChange={e => setF('cochera', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="cochera" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Incluye cochera</label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="tas-label">Amenities</label>
              <input value={form.amenities} onChange={e => setF('amenities', e.target.value)} placeholder="Ej: Pileta, gym, laundry..." className="tas-input" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="tas-label">Observaciones</label>
              <textarea value={form.observaciones} onChange={e => setF('observaciones', e.target.value)} placeholder="Vistas, reformas, particularidades del inmueble..." rows={2} className="tas-textarea" />
            </div>

            {/* Selector de red */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 7 }}>Buscar comparables en</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {REDES.map(r => (
                  <button key={r.value} onClick={() => setF('red', r.value)} className={`gfi-filter-chip${form.red === r.value ? ' active' : ''}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>{error}</div>}

            <button
              onClick={tasar}
              disabled={tasando}
              className="gfi-btn gfi-btn--primary"
              style={{ width: '100%', padding: '12px', fontSize: 13, justifyContent: 'center' }}
            >
              {tasando ? 'Analizando con IA...' : 'Tasar con IA'}
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
              <div className="gfi-card gfi-card--red-top" style={{ padding: 20 }}>
                <div className="gfi-section-title" style={{ marginBottom: 12 }}>Valuación estimada</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Valor sugerido', val: `USD ${resultado.valor_sugerido.toLocaleString('es-AR')}`, highlight: true },
                    { label: 'Precio / m²', val: `USD ${resultado.precio_m2.toLocaleString('es-AR')}`, highlight: false },
                    { label: 'Rango mínimo', val: `USD ${resultado.valor_min.toLocaleString('es-AR')}`, highlight: false },
                    { label: 'Rango máximo', val: `USD ${resultado.valor_max.toLocaleString('es-AR')}`, highlight: false },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '12px', background: s.highlight ? 'var(--gfi-red-soft)' : 'var(--gfi-bg-secondary)', borderRadius: 'var(--gfi-radius-md)', border: s.highlight ? '1px solid var(--gfi-red-border)' : '1px solid var(--gfi-border)' }}>
                      <div style={{ fontSize: s.highlight ? 20 : 15, fontWeight: 800, color: s.highlight ? 'var(--gfi-red)' : 'var(--gfi-text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
                      <div style={{ fontSize: 9, color: 'var(--gfi-text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {resultado.alquiler_estimado && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--gfi-green-soft)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--gfi-radius-md)' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gfi-green-text)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>Alquiler estimado: ARS {resultado.alquiler_estimado.toLocaleString('es-AR')}/mes</span>
                  </div>
                )}
              </div>

              {/* Análisis */}
              <div className="gfi-card" style={{ padding: 16 }}>
                <div className="gfi-section-title" style={{ marginBottom: 8 }}>Análisis de mercado</div>
                <p style={{ fontSize: 13, color: 'var(--gfi-text-secondary)', lineHeight: 1.7, margin: 0 }}>{resultado.analisis}</p>
              </div>

              {/* Factores */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--gfi-green-soft)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 'var(--gfi-radius-md)', padding: 14 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--gfi-green-text)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Positivos</div>
                  {resultado.factores_positivos.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--gfi-text-secondary)', marginBottom: 5, paddingLeft: 14, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--gfi-green-text)' }}>+</span>{f}
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--gfi-red-soft)', border: '1px solid var(--gfi-red-border)', borderRadius: 'var(--gfi-radius-md)', padding: 14 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--gfi-red)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Negativos</div>
                  {resultado.factores_negativos.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--gfi-text-secondary)', marginBottom: 5, paddingLeft: 14, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--gfi-red)' }}>−</span>{f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Justificación del valor — hoy */}
              {resultado.justificacion_valor_hoy && (
                <div style={{ background: 'var(--gfi-orange-soft)', border: '1px solid var(--gfi-orange-border)', borderRadius: 'var(--gfi-radius-md)', padding: 14 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: '#f97316', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Justificacion del valor · hoy
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--gfi-text-primary)', lineHeight: 1.6, margin: 0 }}>{resultado.justificacion_valor_hoy}</p>
                </div>
              )}

              {/* Comparables reales */}
              {resultado.comparables_reales && resultado.comparables_reales.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                        {resultado._comparables_tipo === 'busqueda' ? 'Portales para verificar' : `3 comparables reales · ${resultado._total_comparables_encontrados ?? resultado.comparables_reales.length} analizados`}
                      </div>
                      {resultado._comparables_tipo === 'busqueda' && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>Los portales no respondieron en tiempo · abrí cada link para verificar</div>
                      )}
                    </div>
                    {resultado._portales_consultados && resultado._portales_consultados.length > 0 && resultado._comparables_tipo !== 'busqueda' && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {resultado._portales_consultados.map(p => (
                          <span key={p} style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: p === 'Red GFI' ? 'rgba(204,0,0,0.12)' : 'rgba(59,130,246,0.12)', color: p === 'Red GFI' ? '#cc0000' : '#3b82f6', border: `1px solid ${p === 'Red GFI' ? 'rgba(204,0,0,0.25)' : 'rgba(59,130,246,0.2)'}` }}>{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {resultado.comparables_reales.map((c, i) => {
                      const esBusqueda = c.precio === 0
                      const esRedGFI = c.portal === 'Red GFI'
                      return (
                        <div key={i} style={{ background: esRedGFI ? 'rgba(204,0,0,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${esBusqueda ? 'rgba(255,255,255,0.05)' : (esRedGFI ? 'rgba(204,0,0,0.15)' : 'rgba(255,255,255,0.08)')}`, borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: esRedGFI ? 'rgba(204,0,0,0.12)' : 'rgba(255,255,255,0.06)', color: esRedGFI ? '#cc0000' : 'rgba(255,255,255,0.35)', border: `1px solid ${esRedGFI ? 'rgba(204,0,0,0.2)' : 'rgba(255,255,255,0.08)'}`, marginRight: 7 }}>{c.portal}</span>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{esBusqueda ? `Ver ${c.barrio}` : (c.titulo || c.barrio)}</span>
                            {!esBusqueda && c.m2 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>{c.m2} m²</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            {!esBusqueda && (
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'Montserrat,sans-serif' }}>
                                {c.moneda} {c.precio.toLocaleString('es-AR')}
                              </span>
                            )}
                            {esRedGFI ? (
                              <span style={{ fontSize: 10, color: 'rgba(204,0,0,0.6)', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>interna</span>
                            ) : (
                              <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, padding: '4px 10px', borderRadius: 5, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', whiteSpace: 'nowrap' }}>
                                Ver →
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recomendación */}
              <div style={{ background: 'var(--gfi-bg-elevated)', border: '1px solid var(--gfi-border)', borderRadius: 'var(--gfi-radius-md)', padding: 14, borderLeft: '3px solid var(--gfi-red)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--gfi-red)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Recomendacion</div>
                <p style={{ fontSize: 13, color: 'var(--gfi-text-secondary)', lineHeight: 1.6, margin: 0 }}>{resultado.recomendacion}</p>
              </div>

              {/* Acciones */}
              <div className="no-print" style={{ display: 'flex', gap: 8 }}>
                <button onClick={copiarResultado} className="gfi-btn gfi-btn--secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Copiar tasacion
                </button>
                <button onClick={exportarPDF} className="gfi-btn gfi-btn--ghost" style={{ flex: 1, justifyContent: 'center' }}>
                  Exportar PDF
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
          <div style={{ background: 'var(--gfi-bg-panel)', border: '1px solid var(--gfi-border)', borderRadius: 'var(--gfi-radius-xl)', padding: 24, width: '100%', maxWidth: 540, maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--gfi-shadow-lg)' }}>
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

            {/* Justificación del valor */}
            {verDetalle.resultado?.justificacion_valor_hoy && (
              <div style={{ marginTop: 16, padding: 14, background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.15)', borderRadius: 8 }}>
                <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#cc0000', marginBottom: 8 }}>
                  Justificación del valor
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{verDetalle.resultado.justificacion_valor_hoy}</p>
              </div>
            )}

            {/* Factores positivos y negativos */}
            {((verDetalle.resultado?.factores_positivos?.length ?? 0) > 0 || (verDetalle.resultado?.factores_negativos?.length ?? 0) > 0) && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(verDetalle.resultado?.factores_positivos?.length ?? 0) > 0 && (
                  <div style={{ padding: 12, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#22c55e', marginBottom: 8 }}>
                      Factores positivos
                    </div>
                    {verDetalle.resultado!.factores_positivos.map((f, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 4, paddingLeft: 10, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: '#22c55e' }}>+</span>{f}
                      </div>
                    ))}
                  </div>
                )}
                {(verDetalle.resultado?.factores_negativos?.length ?? 0) > 0 && (
                  <div style={{ padding: 12, background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f87171', marginBottom: 8 }}>
                      Factores negativos
                    </div>
                    {verDetalle.resultado!.factores_negativos.map((f, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 4, paddingLeft: 10, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: '#f87171' }}>−</span>{f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comparables reales */}
            {(verDetalle.resultado?.comparables_reales?.length ?? 0) > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 9, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
                  Comparables reales · {verDetalle.resultado!.comparables_reales.length} propiedades
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {verDetalle.resultado!.comparables_reales.map((c, i) => (
                    <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, textDecoration: 'none', transition: 'background 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.titulo}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{c.barrio}{c.m2 ? ` · ${c.m2} m²` : ''} · {c.portal}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#cc0000', fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {c.moneda} {c.precio?.toLocaleString('es-AR')}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
