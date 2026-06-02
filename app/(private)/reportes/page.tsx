'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Periodo = 'mes' | 'trimestre' | 'anio'

interface KPIs {
  propiedades: number; propiedades_activas: number
  contactos: number; contactos_nuevos: number
  negocios: number; negocios_cerrados: number
  tareas_completadas: number; tareas_total: number
  interacciones: number; tasaciones: number; visitas: number
}
interface ComisionItem {
  id: string; descripcion: string; tipo_operacion: string
  monto_comision: number; moneda_comision: string
  monto_cobrado: number; estado: string
  fecha_operacion: string; created_at: string
}
interface MesData { mes: string; label: string; interacciones: number; negocios: number; comisiones: number }
interface ZonaData { zona: string; count: number }
interface EtapaData { etapa: string; count: number }

const MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const ETAPA_COLOR: Record<string,string> = {
  prospecto:'#6b7280', contactado:'#3b82f6', visita:'#d4960c',
  oferta:'#d4960c', negociacion:'#8b5cf6', cerrado:'#3abab6', perdido:'#b80000',
}
const PERIODOS: {key:Periodo;label:string}[] = [
  {key:'mes',label:'Este mes'},{key:'trimestre',label:'Trimestre'},{key:'anio',label:'Este año'},
]

function fmtMoneda(n: number, moneda='ARS') {
  if (moneda === 'USD') return `USD ${n.toLocaleString('es-AR')}`
  return `$${n.toLocaleString('es-AR')}`
}

function fechaDesde(p: Periodo): string {
  const d = new Date()
  if (p === 'mes') d.setDate(1)
  else if (p === 'trimestre') d.setMonth(d.getMonth() - 3)
  else d.setFullYear(d.getFullYear() - 1)
  return d.toISOString()
}

function ultimos6Meses(): {mes:string;label:string}[] {
  const res = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    res.push({ mes: d.toISOString().slice(0,7), label: MESES_LABEL[d.getMonth()] })
  }
  return res
}

export default function ReportesPage() {
  const [uid, setUid] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [kpis, setKpis] = useState<KPIs|null>(null)
  const [comisiones, setComisiones] = useState<ComisionItem[]>([])
  const [barras, setBarras] = useState<MesData[]>([])
  const [zonas, setZonas] = useState<ZonaData[]>([])
  const [etapas, setEtapas] = useState<EtapaData[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }:any) => {
      if (!data.user) { window.location.href='/login'; return }
      setUid(data.user.id)
      cargar(data.user.id, 'mes')
    })
  }, [])

  const cargar = async (id: string, p: Periodo) => {
    setCargando(true)
    const desde = fechaDesde(p)
    const meses = ultimos6Meses()

    const [
      { data: props }, { data: contactos }, { data: negocios },
      { data: tareas }, { data: interacciones }, { data: tasaciones },
      { data: comisionesData }, { data: visitasData },
    ] = await Promise.all([
      supabase.from('cartera_propiedades').select('id,estado,zona').eq('perfil_id',id),
      supabase.from('crm_contactos').select('id,created_at').eq('perfil_id',id),
      supabase.from('crm_negocios').select('id,etapa,created_at').eq('perfil_id',id),
      supabase.from('crm_tareas').select('id,estado').eq('perfil_id',id),
      supabase.from('crm_interacciones').select('id,created_at').eq('perfil_id',id),
      supabase.from('tasaciones_historial').select('id,created_at').eq('usuario_id',id),
      supabase.from('comisiones').select('*').eq('perfil_id',id).order('fecha_operacion',{ascending:false}),
      supabase.from('cartera_visitas').select('id,created_at').eq('perfil_id',id).gte('created_at',desde),
    ])

    const pl = props ?? []; const cl = contactos ?? []; const nl = negocios ?? []
    const tl = tareas ?? []; const il = interacciones ?? []; const tal = tasaciones ?? []
    const coml = (comisionesData ?? []) as ComisionItem[]
    const vl = visitasData ?? []

    setKpis({
      propiedades: pl.length,
      propiedades_activas: pl.filter((x:any) => ['activa','disponible'].includes(x.estado)).length,
      contactos: cl.length,
      contactos_nuevos: cl.filter((x:any) => x.created_at >= desde).length,
      negocios: nl.length,
      negocios_cerrados: nl.filter((x:any) => x.etapa === 'cerrado').length,
      tareas_completadas: tl.filter((x:any) => x.estado === 'completada').length,
      tareas_total: tl.length,
      interacciones: il.filter((x:any) => x.created_at >= desde).length,
      tasaciones: tal.filter((x:any) => x.created_at >= desde).length,
      visitas: vl.length,
    })

    setComisiones(coml)

    // Barras: últimos 6 meses
    const bData = meses.map(m => ({
      ...m,
      interacciones: il.filter((x:any) => x.created_at?.startsWith(m.mes)).length,
      negocios: nl.filter((x:any) => x.created_at?.startsWith(m.mes)).length,
      comisiones: coml.filter(x => x.fecha_operacion?.startsWith(m.mes) || x.created_at?.startsWith(m.mes))
        .reduce((s,x) => s + (x.monto_comision || 0), 0),
    }))
    setBarras(bData)

    // Zonas
    const zonaMap: Record<string,number> = {}
    for (const p of pl as any[]) {
      const z = p.zona || 'Sin zona'
      zonaMap[z] = (zonaMap[z] || 0) + 1
    }
    setZonas(Object.entries(zonaMap).map(([zona,count])=>({zona,count})).sort((a,b)=>b.count-a.count).slice(0,8))

    // Etapas
    const eMap: Record<string,number> = {}
    for (const n of nl as any[]) { eMap[n.etapa] = (eMap[n.etapa]||0)+1 }
    setEtapas(Object.entries(eMap).map(([etapa,count])=>({etapa,count})).sort((a,b)=>b.count-a.count))

    setCargando(false)
  }

  const cambiarPeriodo = (p: Periodo) => { setPeriodo(p); if(uid) cargar(uid, p) }

  const exportarReportePDF = () => {
    if (!kpis) return
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const periodoLabel = PERIODOS.find(p => p.key === periodo)?.label ?? periodo
    const fmtARS = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Reporte GFI® — ${periodoLabel}</title>
<style>
  body { font-family: 'Georgia',serif; color: #111; margin: 0; padding: 32px 40px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; font-weight: 700; color: #990000; margin: 0 0 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 28px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 24px; }
  .kpi { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; padding: 14px 16px; }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; font-family: sans-serif; margin-bottom: 4px; }
  .kpi-val { font-size: 22px; font-weight: 700; color: #111; font-family: sans-serif; }
  .kpi-sub { font-size: 10px; color: #888; font-family: sans-serif; margin-top: 2px; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #888; font-family: sans-serif; border-bottom: 1px solid #e0e0e0; padding-bottom: 5px; margin-bottom: 10px; }
  .com-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f0f0f0; }
  .com-label { color: #333; }
  .com-val { font-weight: 700; font-family: sans-serif; }
  .com-cobrada { color: #166534; }
  .com-pendiente { color: #854d0e; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-family: sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; padding: 6px 8px; border-bottom: 1px solid #e0e0e0; }
  td { padding: 7px 8px; border-bottom: 1px solid #f5f5f5; }
  .zona-bar { display: inline-block; height: 8px; background: #990000; border-radius: 2px; vertical-align: middle; margin-right: 6px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #aaa; text-align: center; font-family: sans-serif; }
  @media print { @page { margin: 1.5cm; } }
</style>
</head>
<body>
<h1>Reporte de Actividad — ${periodoLabel}</h1>
<div class="sub">Generado el ${fecha} · Grupo Foro Inmobiliario GFI®</div>

<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Cartera total</div><div class="kpi-val">${kpis.propiedades}</div><div class="kpi-sub">${kpis.propiedades_activas} activas</div></div>
  <div class="kpi"><div class="kpi-label">Contactos CRM</div><div class="kpi-val">${kpis.contactos}</div><div class="kpi-sub">+${kpis.contactos_nuevos} nuevos en el período</div></div>
  <div class="kpi"><div class="kpi-label">Negocios</div><div class="kpi-val">${kpis.negocios}</div><div class="kpi-sub">${kpis.negocios_cerrados} cerrados</div></div>
  <div class="kpi"><div class="kpi-label">Visitas</div><div class="kpi-val">${kpis.visitas}</div><div class="kpi-sub">en el período</div></div>
  <div class="kpi"><div class="kpi-label">Interacciones</div><div class="kpi-val">${kpis.interacciones}</div><div class="kpi-sub">en el período</div></div>
  <div class="kpi"><div class="kpi-label">Tasaciones IA</div><div class="kpi-val">${kpis.tasaciones}</div><div class="kpi-sub">en el período</div></div>
</div>

<div class="section">
  <div class="section-title">Comisiones</div>
  <div class="com-row"><div class="com-label">Total facturado</div><div class="com-val">${fmtARS(comTotal)}</div></div>
  <div class="com-row"><div class="com-label">Cobradas</div><div class="com-val com-cobrada">${fmtARS(comCobradas)}</div></div>
  <div class="com-row"><div class="com-label">Pendientes de cobro</div><div class="com-val com-pendiente">${fmtARS(comPendientes)}</div></div>
</div>

${zonas.length > 0 ? `<div class="section">
  <div class="section-title">Actividad por zona</div>
  <table>
    <tr><th>Zona</th><th>Propiedades</th></tr>
    ${zonas.slice(0, 8).map(z => `<tr><td><span class="zona-bar" style="width:${Math.round(z.count/zonas[0].count*80)}px"></span>${z.zona}</td><td>${z.count}</td></tr>`).join('')}
  </table>
</div>` : ''}

${comisiones.length > 0 ? `<div class="section">
  <div class="section-title">Detalle de comisiones</div>
  <table>
    <tr><th>Operación</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr>
    ${comisiones.slice(0, 10).map(c => `<tr>
      <td>${c.tipo_operacion ?? 'Operación'}</td>
      <td>${fmtARS(c.monto_comision ?? 0)}</td>
      <td style="color:${c.estado === 'cobrada' ? '#166534' : '#854d0e'}">${c.estado}</td>
      <td>${c.fecha_operacion ? new Date(c.fecha_operacion).toLocaleDateString('es-AR') : '-'}</td>
    </tr>`).join('')}
  </table>
</div>` : ''}

<div class="footer">Reporte generado por GFI® · ${fecha}</div>
</body>
</html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  // Resumen comisiones
  const comTotal = comisiones.reduce((s,c) => s + (c.monto_comision||0), 0)
  const comCobradas = comisiones.filter(c=>c.estado==='cobrada').reduce((s,c)=>s+(c.monto_cobrado||0),0)
  const comPendientes = comisiones.filter(c=>c.estado==='pendiente').reduce((s,c)=>s+(c.monto_comision||0),0)
  const maxBarra = Math.max(...barras.map(b=>b.interacciones), 1)
  const maxCom = Math.max(...barras.map(b=>b.comisiones), 1)
  const maxZona = Math.max(...zonas.map(z=>z.count), 1)
  const maxEtapa = Math.max(...etapas.map(e=>e.count), 1)

  const KPI_CARDS = kpis ? [
    { label:'Cartera', valor:kpis.propiedades, sub:`${kpis.propiedades_activas} activas`, color:'#3b82f6', icon:'🏠' },
    { label:'Contactos CRM', valor:kpis.contactos, sub:`+${kpis.contactos_nuevos} nuevos`, color:'#3abab6', icon:'👥' },
    { label:'Negocios', valor:kpis.negocios, sub:`${kpis.negocios_cerrados} cerrados`, color:'#d4960c', icon:'🤝' },
    { label:'Visitas', valor:kpis.visitas, sub:'en el período', color:'#3abab6', icon:'🗓' },
    { label:'Interacciones', valor:kpis.interacciones, sub:'en el período', color:'#8b5cf6', icon:'💬' },
    { label:'Tasaciones IA', valor:kpis.tasaciones, sub:'en el período', color:'#990000', icon:'📊' },
  ] : []

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'24px 0 64px',fontFamily:'Inter,sans-serif',color:'#fff'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontSize:10,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',color:'rgba(255,255,255,0.25)',marginBottom:6}}>Panel de Reportes</div>
          <h1 style={{fontFamily:'Montserrat,sans-serif',fontSize:22,fontWeight:800,color:'#fff',margin:0}}>Tu actividad como corredor</h1>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginTop:4,margin:'4px 0 0'}}>Métricas clave · Comisiones · Pipeline · Actividad</p>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={()=>cambiarPeriodo(p.key)} style={{padding:'7px 14px',borderRadius:20,border:'none',cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,background:periodo===p.key?'rgba(153,0,0,0.15)':'rgba(255,255,255,0.04)',color:periodo===p.key?'#ff6666':'rgba(255,255,255,0.4)',outline:periodo===p.key?'1px solid rgba(153,0,0,0.35)':'none'}}>
              {p.label}
            </button>
          ))}
          {kpis && (
            <button onClick={exportarReportePDF} style={{padding:'7px 14px',borderRadius:20,border:'1px solid rgba(153,0,0,0.25)',cursor:'pointer',fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,background:'rgba(153,0,0,0.08)',color:'#f87171'}}>
              📄 PDF
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <div style={{textAlign:'center',padding:'64px 0',color:'rgba(255,255,255,0.3)'}}>Cargando métricas...</div>
      ) : (<>

        {/* KPI Grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:28}}>
          {KPI_CARDS.map(m => (
            <div key={m.label} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'18px 20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:18}}>{m.icon}</span>
                <span style={{fontSize:10,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)'}}>{m.label}</span>
              </div>
              <div style={{fontFamily:'Montserrat,sans-serif',fontSize:32,fontWeight:800,color:m.color,lineHeight:1}}>{m.valor}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:4}}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Resumen de comisiones */}
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'20px 24px',marginBottom:20}}>
          <div style={{fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',marginBottom:16}}>Resumen de honorarios</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:16}}>
            {[
              {label:'Total registrado',valor:fmtMoneda(comTotal),color:'#fff',sub:`${comisiones.length} operaciones`},
              {label:'Cobrado',valor:fmtMoneda(comCobradas),color:'#3abab6',sub:`${comisiones.filter(c=>c.estado==='cobrada').length} operaciones`},
              {label:'Pendiente de cobro',valor:fmtMoneda(comPendientes),color:'#d4960c',sub:`${comisiones.filter(c=>c.estado==='pendiente').length} operaciones`},
            ].map(card => (
              <div key={card.label} style={{background:'rgba(0,0,0,0.3)',borderRadius:10,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:6}}>{card.label}</div>
                <div style={{fontFamily:'Montserrat,sans-serif',fontSize:20,fontWeight:800,color:card.color}}>{card.valor}</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.25)',marginTop:3}}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Barra cobro */}
          {comTotal > 0 && (
            <div style={{marginTop:16}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Ratio de cobro</span>
                <span style={{fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700,color:'#3abab6'}}>{Math.round((comCobradas/comTotal)*100)}%</span>
              </div>
              <div style={{height:8,background:'rgba(255,255,255,0.06)',borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.round((comCobradas/comTotal)*100)}%`,background:'#3abab6',borderRadius:4,transition:'width 0.5s'}}/>
              </div>
            </div>
          )}

          {/* Últimas comisiones */}
          {comisiones.length > 0 && (
            <div style={{marginTop:16}}>
              <div style={{fontSize:10,fontFamily:'Montserrat,sans-serif',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.2)',marginBottom:10}}>Últimas operaciones</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {comisiones.slice(0,5).map(c => (
                  <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'rgba(255,255,255,0.02)',borderRadius:7,gap:12}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:'rgba(255,255,255,0.75)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.descripcion}</div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:2}}>
                        {c.tipo_operacion} · {c.fecha_operacion ? new Date(c.fecha_operacion+'T12:00').toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontFamily:'Montserrat,sans-serif',fontSize:13,fontWeight:700,color:c.estado==='cobrada'?'#3abab6':'#d4960c'}}>
                        {fmtMoneda(c.monto_comision, c.moneda_comision)}
                      </div>
                      <div style={{fontSize:9,color:c.estado==='cobrada'?'#3abab6':'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{c.estado}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dos columnas: Actividad mensual + Pipeline */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>

          {/* Actividad mensual — barras */}
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'20px 20px'}}>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',marginBottom:16}}>Actividad mensual</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,height:100}}>
              {barras.map(b => {
                const pct = Math.round((b.interacciones/maxBarra)*100)
                return (
                  <div key={b.mes} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{width:'100%',background:'rgba(139,92,246,0.25)',borderRadius:'3px 3px 0 0',height:`${Math.max(pct,3)}%`,position:'relative',display:'flex',alignItems:'flex-end',justifyContent:'center',minHeight:3}}>
                      {b.interacciones > 0 && <span style={{position:'absolute',top:-16,fontSize:9,color:'rgba(255,255,255,0.4)',fontFamily:'Montserrat,sans-serif',fontWeight:700}}>{b.interacciones}</span>}
                    </div>
                    <span style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontFamily:'Montserrat,sans-serif'}}>{b.label}</span>
                  </div>
                )
              })}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:12}}>
              <div style={{width:10,height:10,borderRadius:2,background:'rgba(139,92,246,0.5)'}}/>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Interacciones CRM</span>
            </div>
          </div>

          {/* Pipeline de negocios */}
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'20px 20px'}}>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',marginBottom:16}}>Pipeline de negocios</div>
            {etapas.length === 0 ? (
              <div style={{color:'rgba(255,255,255,0.2)',fontSize:12,textAlign:'center',padding:'24px 0'}}>Sin negocios registrados</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {etapas.map(e => {
                  const color = ETAPA_COLOR[e.etapa] ?? '#6b7280'
                  const pct = Math.round((e.count/maxEtapa)*100)
                  return (
                    <div key={e.etapa}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontSize:12,color:'rgba(255,255,255,0.6)',textTransform:'capitalize'}}>{e.etapa}</span>
                        <span style={{fontSize:12,fontFamily:'Montserrat,sans-serif',fontWeight:700,color}}>{e.count}</span>
                      </div>
                      <div style={{height:5,background:'rgba(255,255,255,0.06)',borderRadius:3,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3,transition:'width 0.5s'}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dos columnas: Comisiones por mes + Zonas */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>

          {/* Comisiones por mes */}
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'20px 20px'}}>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',marginBottom:16}}>Honorarios por mes</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,height:100}}>
              {barras.map(b => {
                const pct = maxCom > 0 ? Math.round((b.comisiones/maxCom)*100) : 0
                return (
                  <div key={b.mes} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{width:'100%',background:'rgba(34,197,94,0.25)',borderRadius:'3px 3px 0 0',height:`${Math.max(pct,3)}%`,position:'relative',minHeight:3}}>
                      {b.comisiones > 0 && <span style={{position:'absolute',top:-14,fontSize:7,color:'rgba(255,255,255,0.35)',fontFamily:'Montserrat,sans-serif',fontWeight:700,left:'50%',transform:'translateX(-50%)',whiteSpace:'nowrap'}}>
                        {b.comisiones >= 1000000 ? `${(b.comisiones/1000000).toFixed(1)}M` : b.comisiones >= 1000 ? `${(b.comisiones/1000).toFixed(0)}K` : b.comisiones}
                      </span>}
                    </div>
                    <span style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontFamily:'Montserrat,sans-serif'}}>{b.label}</span>
                  </div>
                )
              })}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:12}}>
              <div style={{width:10,height:10,borderRadius:2,background:'rgba(34,197,94,0.5)'}}/>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Honorarios ARS</span>
            </div>
          </div>

          {/* Propiedades por zona */}
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'20px 20px'}}>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',marginBottom:14}}>Cartera por zona</div>
            {zonas.length === 0 ? (
              <div style={{color:'rgba(255,255,255,0.2)',fontSize:12,textAlign:'center',padding:'24px 0'}}>Sin propiedades en cartera</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {zonas.map(z => {
                  const pct = Math.round((z.count/maxZona)*100)
                  return (
                    <div key={z.zona}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:11,color:'rgba(255,255,255,0.55)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'75%'}}>{z.zona}</span>
                        <span style={{fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700,color:'#3b82f6'}}>{z.count}</span>
                      </div>
                      <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:'rgba(59,130,246,0.5)',borderRadius:2}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tareas + Productividad */}
        {kpis && kpis.tareas_total > 0 && (
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'20px 24px',marginBottom:20}}>
            <div style={{fontFamily:'Montserrat,sans-serif',fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',marginBottom:14}}>Productividad — Tareas CRM</div>
            <div style={{display:'flex',gap:24,alignItems:'center',flexWrap:'wrap'}}>
              {[
                {label:'Completadas',valor:kpis.tareas_completadas,color:'#3abab6'},
                {label:'Pendientes',valor:kpis.tareas_total-kpis.tareas_completadas,color:'#d4960c'},
                {label:'Total',valor:kpis.tareas_total,color:'rgba(255,255,255,0.6)'},
              ].map(s=>(
                <div key={s.label} style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Montserrat,sans-serif',fontSize:26,fontWeight:800,color:s.color}}>{s.valor}</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:2}}>{s.label}</div>
                </div>
              ))}
              <div style={{flex:1,minWidth:140}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Completadas</span>
                  <span style={{fontSize:11,fontFamily:'Montserrat,sans-serif',fontWeight:700,color:'#3abab6'}}>{Math.round((kpis.tareas_completadas/kpis.tareas_total)*100)}%</span>
                </div>
                <div style={{height:8,background:'rgba(255,255,255,0.06)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.round((kpis.tareas_completadas/kpis.tareas_total)*100)}%`,background:'#3abab6',borderRadius:4,transition:'width 0.5s'}}/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer: link a módulos */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
          {[
            {href:'/crm',label:'Ir al CRM',icon:'👥'},
            {href:'/cartera',label:'Ver cartera',icon:'🏠'},
          ].map(l=>(
            <a key={l.href} href={l.href} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,color:'rgba(255,255,255,0.5)',fontSize:12,textDecoration:'none',fontFamily:'Montserrat,sans-serif',fontWeight:600,transition:'all 0.15s'}}>
              <span>{l.icon}</span>{l.label}
            </a>
          ))}
        </div>

      </>)}
    </div>
  )
}
