"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Sponsor {
  id: string; nombre: string; rubro: string; telefono: string | null; email: string | null;
  zona: string | null; notas: string | null; nota_admin: string | null;
  tipo: string; suscripcion_estado: string | null; suscripcion_vencimiento: string | null;
  monto_mensual_usd: number | null; logo_url: string | null; sitio_web: string | null;
  descripcion: string | null; destacado: boolean; activo: boolean; created_at: string;
  beneficio: string | null;
}

const RUBROS = ["Electricista","Plomero","Gasista","Pintor","Carpintero","Albañil","Arquitecto","Ingeniero","Escribano","Abogado","Contador","Tasador","Fotógrafo","Marketing / Publicidad","Informática / Tecnología","Mudanza","Cerrajero","Seguros","Financiero / Inversiones","Otro"];
const FORM_VACIO = { nombre:"", rubro:"", telefono:"", email:"", zona:"", notas:"", nota_admin:"", logo_url:"", sitio_web:"", descripcion:"", beneficio:"", monto_mensual_usd:"", suscripcion_vencimiento:"", destacado: false };

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "activa" | "vencida" | "suspendida">("todos");

  const showToast = (msg: string, tipo: "ok" | "err" = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (p?.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      setEsAdmin(true);
      cargar();
    })();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase.from("red_proveedores")
      .select("*")
      .eq("tipo", "sponsor")
      .order("destacado", { ascending: false })
      .order("created_at", { ascending: false });
    setSponsors((data ?? []) as Sponsor[]);
    setLoading(false);
  };

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setMostrarForm(true);
  };

  const abrirEditar = (s: Sponsor) => {
    setForm({
      nombre: s.nombre, rubro: s.rubro, telefono: s.telefono ?? "", email: s.email ?? "",
      zona: s.zona ?? "", notas: s.notas ?? "", nota_admin: s.nota_admin ?? "",
      logo_url: s.logo_url ?? "", sitio_web: s.sitio_web ?? "", descripcion: s.descripcion ?? "", beneficio: s.beneficio ?? "",
      monto_mensual_usd: s.monto_mensual_usd?.toString() ?? "",
      suscripcion_vencimiento: s.suscripcion_vencimiento ?? "",
      destacado: s.destacado,
    });
    setEditandoId(s.id);
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!form.nombre || !form.rubro) return;
    setGuardando(true);
    const payload = {
      nombre: form.nombre, rubro: form.rubro,
      telefono: form.telefono || null, email: form.email || null,
      zona: form.zona || null, notas: form.notas || null,
      nota_admin: form.nota_admin || null,
      logo_url: form.logo_url || null, sitio_web: form.sitio_web || null,
      descripcion: form.descripcion || null,
      beneficio: form.beneficio || null,
      monto_mensual_usd: form.monto_mensual_usd ? parseInt(form.monto_mensual_usd) : null,
      suscripcion_vencimiento: form.suscripcion_vencimiento || null,
      destacado: form.destacado,
      tipo: "sponsor",
    };
    if (editandoId) {
      await supabase.from("red_proveedores").update(payload).eq("id", editandoId);
      showToast("Sponsor actualizado");
    } else {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("red_proveedores").insert({ ...payload, referenciado_por: u.user!.id, activo: true, suscripcion_estado: "activa" });
      showToast("Sponsor creado");
    }
    setGuardando(false); setMostrarForm(false); setEditandoId(null);
    cargar();
  };

  const cambiarEstado = async (id: string, estado: "activa" | "vencida" | "suspendida") => {
    await supabase.from("red_proveedores").update({ suscripcion_estado: estado }).eq("id", id);
    showToast(`Estado cambiado a ${estado}`);
    cargar();
  };

  const toggleDestacado = async (s: Sponsor) => {
    await supabase.from("red_proveedores").update({ destacado: !s.destacado }).eq("id", s.id);
    cargar();
  };

  const extenderMes = async (s: Sponsor) => {
    const base = s.suscripcion_vencimiento && new Date(s.suscripcion_vencimiento) > new Date()
      ? new Date(s.suscripcion_vencimiento)
      : new Date();
    base.setMonth(base.getMonth() + 1);
    const nueva = base.toISOString().slice(0, 10);
    await supabase.from("red_proveedores").update({ suscripcion_vencimiento: nueva, suscripcion_estado: "activa" }).eq("id", s.id);
    showToast(`Extendido hasta ${nueva}`);
    cargar();
  };

  const ff = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const diasHasta = (fecha: string) => Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);

  const filtrados = sponsors.filter(s => filtro === "todos" || s.suscripcion_estado === filtro);
  const stats = { total: sponsors.length, activos: sponsors.filter(s => s.suscripcion_estado === "activa").length, vencidos: sponsors.filter(s => s.suscripcion_estado === "vencida").length, suspendidos: sponsors.filter(s => s.suscripcion_estado === "suspendida").length };

  if (!esAdmin) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .sp-wrap{display:flex;flex-direction:column;gap:20px}
        .sp-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .sp-titulo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:#fff}
        .sp-titulo span{color:#cc0000}
        .sp-sub{font-size:13px;color:rgba(255,255,255,0.35);margin-top:4px}
        .sp-stats{display:flex;gap:10px;flex-wrap:wrap}
        .sp-stat{background:rgba(14,14,14,0.95);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:12px 18px;text-align:center;min-width:90px}
        .sp-stat-num{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:800;color:#fff}
        .sp-stat-num.verde{color:#22c55e}
        .sp-stat-num.rojo{color:#cc0000}
        .sp-stat-num.amarillo{color:#f59e0b}
        .sp-stat-label{font-size:9px;color:rgba(255,255,255,0.3);font-family:'Montserrat',sans-serif;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px}
        .sp-filtros{display:flex;gap:6px;flex-wrap:wrap}
        .sp-filtro-btn{padding:6px 14px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.4);font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s}
        .sp-filtro-btn.activo{border-color:rgba(200,0,0,0.4);background:rgba(200,0,0,0.1);color:#cc0000}
        .sp-btn-nuevo{padding:10px 20px;background:#cc0000;border:none;border-radius:4px;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
        .sp-grid{display:flex;flex-direction:column;gap:10px}
        .sp-card{background:rgba(14,14,14,0.98);border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden}
        .sp-card.activa{border-color:rgba(34,197,94,0.2)}
        .sp-card.vencida{border-color:rgba(245,158,11,0.25)}
        .sp-card.suspendida{border-color:rgba(200,0,0,0.2)}
        .sp-card-top{padding:16px 20px;display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
        .sp-logo{width:48px;height:48px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.08);flex-shrink:0}
        .sp-logo-ph{width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
        .sp-info{flex:1;min-width:0}
        .sp-nombre{font-family:'Montserrat',sans-serif;font-size:15px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .sp-badge-estado{font-size:8px;font-family:'Montserrat',sans-serif;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:2px 8px;border-radius:20px}
        .sp-badge-estado.activa{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e}
        .sp-badge-estado.vencida{background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#f59e0b}
        .sp-badge-estado.suspendida{background:rgba(200,0,0,0.1);border:1px solid rgba(200,0,0,0.3);color:#ff6666}
        .sp-badge-estado.sin-estado{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4)}
        .sp-destacado{color:#eab308;font-size:14px}
        .sp-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px}
        .sp-meta-item{font-size:11px;color:rgba(255,255,255,0.4)}
        .sp-desc{font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6;margin-top:6px;font-style:italic}
        .sp-nota-admin{font-size:11px;color:rgba(245,158,11,0.6);background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:4px;padding:6px 10px;margin-top:6px}
        .sp-beneficio{display:flex;align-items:flex-start;gap:7px;font-size:11px;color:rgba(255,255,255,0.65);background:rgba(200,0,0,0.06);border:1px solid rgba(200,0,0,0.2);border-radius:4px;padding:6px 10px;margin-top:6px;line-height:1.5}
        .sp-beneficio strong{font-family:'Montserrat',sans-serif;font-size:8px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#cc0000;margin-right:4px;flex-shrink:0}
        .sp-acciones{display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0}
        .sp-btn{padding:6px 12px;border-radius:3px;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;white-space:nowrap;border:1px solid}
        .sp-btn-editar{background:transparent;border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.5)}
        .sp-btn-editar:hover{border-color:rgba(255,255,255,0.3);color:#fff}
        .sp-btn-extender{background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.3);color:#22c55e}
        .sp-btn-extender:hover{background:rgba(34,197,94,0.2)}
        .sp-btn-activar{background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.3);color:#22c55e}
        .sp-btn-suspender{background:rgba(200,0,0,0.1);border-color:rgba(200,0,0,0.3);color:#ff6666}
        .sp-btn-star{background:transparent;border-color:rgba(234,179,8,0.3);color:#eab308}
        .sp-venc{font-size:10px;padding:4px 8px;border-radius:3px;font-family:'Inter',sans-serif}
        .sp-venc.ok{background:rgba(34,197,94,0.07);color:rgba(34,197,94,0.7)}
        .sp-venc.pronto{background:rgba(245,158,11,0.1);color:#f59e0b}
        .sp-venc.vencido{background:rgba(200,0,0,0.07);color:rgba(200,0,0,0.7)}
        .sp-empty{padding:48px;text-align:center;color:rgba(255,255,255,0.2);font-size:13px;font-style:italic;background:rgba(14,14,14,0.9);border:1px solid rgba(255,255,255,0.07);border-radius:6px}
        .sp-spin-wrap{padding:48px;display:flex;justify-content:center}
        .sp-spin{width:28px;height:28px;border:2px solid rgba(200,0,0,0.2);border-top-color:#cc0000;border-radius:50%;animation:spin 0.7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:400;padding:24px}
        .modal{background:#0f0f0f;border:1px solid rgba(200,0,0,0.25);border-radius:8px;padding:28px 30px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;position:relative}
        .modal::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#cc0000,transparent);border-radius:8px 8px 0 0}
        .modal-titulo{font-family:'Montserrat',sans-serif;font-size:16px;font-weight:800;color:#fff;margin-bottom:20px}
        .modal-titulo span{color:#cc0000}
        .modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .modal-grid .full{grid-column:1/-1}
        .field{display:flex;flex-direction:column;gap:5px}
        .field label{font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.35)}
        .field input,.field select,.field textarea{padding:9px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#fff;font-size:13px;outline:none;font-family:'Inter',sans-serif;transition:border-color 0.2s;width:100%}
        .field input:focus,.field select:focus,.field textarea:focus{border-color:rgba(200,0,0,0.4)}
        .field input::placeholder,.field textarea::placeholder{color:rgba(255,255,255,0.2)}
        .field select{background:#0f0f0f}
        .field textarea{resize:vertical;min-height:80px}
        .field-check{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:4px;cursor:pointer}
        .field-check input{width:16px;height:16px;flex-shrink:0}
        .field-check-label{font-size:12px;color:rgba(255,255,255,0.6);font-family:'Inter',sans-serif}
        .field-check-label strong{color:#eab308}
        .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.07)}
        .btn-cancel{padding:9px 18px;background:transparent;border:1px solid rgba(255,255,255,0.14);border-radius:4px;color:rgba(255,255,255,0.45);font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer}
        .btn-save{padding:9px 22px;background:#cc0000;border:none;border-radius:4px;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer}
        .btn-save:disabled{opacity:0.6;cursor:not-allowed}
        .toast{position:fixed;bottom:28px;right:28px;padding:12px 20px;border-radius:5px;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;z-index:999}
        .toast.ok{background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.35);color:#22c55e}
        .toast.err{background:rgba(200,0,0,0.15);border:1px solid rgba(200,0,0,0.35);color:#ff6666}
        @media(max-width:600px){.sp-card-top{flex-direction:column}.sp-acciones{flex-direction:row;flex-wrap:wrap}.modal-grid{grid-template-columns:1fr}.modal-grid .full{grid-column:1}}
      `}</style>

      <div className="sp-wrap">
        <div className="sp-header">
          <div>
            <div className="sp-titulo">Sponsors <span>GFI®</span></div>
            <div className="sp-sub">Proveedores con suscripción activa — aparecen destacados en el directorio</div>
          </div>
          <button className="sp-btn-nuevo" onClick={abrirNuevo}>+ Nuevo sponsor</button>
        </div>

        <div className="sp-stats">
          <div className="sp-stat"><div className="sp-stat-num">{stats.total}</div><div className="sp-stat-label">Total</div></div>
          <div className="sp-stat"><div className="sp-stat-num verde">{stats.activos}</div><div className="sp-stat-label">Activos</div></div>
          <div className="sp-stat"><div className="sp-stat-num amarillo">{stats.vencidos}</div><div className="sp-stat-label">Vencidos</div></div>
          <div className="sp-stat"><div className="sp-stat-num rojo">{stats.suspendidos}</div><div className="sp-stat-label">Suspendidos</div></div>
          <div className="sp-stat"><div className="sp-stat-num" style={{color:"#cc0000"}}>USD {sponsors.filter(s=>s.suscripcion_estado==="activa").reduce((a,s)=>a+(s.monto_mensual_usd??0),0)}</div><div className="sp-stat-label">Ingresos / mes</div></div>
        </div>

        <div className="sp-filtros">
          {(["todos","activa","vencida","suspendida"] as const).map(f => (
            <button key={f} className={`sp-filtro-btn${filtro===f?" activo":""}`} onClick={()=>setFiltro(f)}>
              {f==="todos"?"Todos":f.charAt(0).toUpperCase()+f.slice(1)}{f!=="todos"&&<span style={{marginLeft:5,opacity:0.6}}>({f==="activa"?stats.activos:f==="vencida"?stats.vencidos:stats.suspendidos})</span>}
            </button>
          ))}
        </div>

        {loading ? <div className="sp-spin-wrap"><div className="sp-spin"/></div>
         : filtrados.length === 0 ? <div className="sp-empty">{sponsors.length === 0 ? "No hay sponsors todavía. Agregá el primero." : "No hay sponsors con ese estado."}</div>
         : <div className="sp-grid">
          {filtrados.map(s => {
            const estado = s.suscripcion_estado ?? "sin-estado";
            const dias = s.suscripcion_vencimiento ? diasHasta(s.suscripcion_vencimiento) : null;
            return (
              <div key={s.id} className={`sp-card ${estado}`}>
                <div className="sp-card-top">
                  {s.logo_url ? <img src={s.logo_url} alt={s.nombre} className="sp-logo"/> : <div className="sp-logo-ph">🏢</div>}
                  <div className="sp-info">
                    <div className="sp-nombre">
                      {s.destacado && <span className="sp-destacado">★</span>}
                      {s.nombre}
                      <span className={`sp-badge-estado ${estado}`}>{estado === "sin-estado" ? "Sin estado" : estado}</span>
                      <span style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>{s.rubro}</span>
                    </div>
                    <div className="sp-meta">
                      {s.monto_mensual_usd ? <span className="sp-meta-item">💰 USD {s.monto_mensual_usd}/mes</span> : null}
                      {s.telefono && <span className="sp-meta-item">📞 {s.telefono}</span>}
                      {s.email && <span className="sp-meta-item">✉️ {s.email}</span>}
                      {s.sitio_web && <a href={s.sitio_web} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#cc0000",textDecoration:"none"}}>🌐 {s.sitio_web.replace(/https?:\/\//,"")}</a>}
                    </div>
                    {s.descripcion && <div className="sp-desc">"{s.descripcion}"</div>}
                    {s.beneficio && <div className="sp-beneficio"><strong>🎁 Beneficio GFI®</strong>{s.beneficio}</div>}
                    {s.nota_admin && <div className="sp-nota-admin">📝 {s.nota_admin}</div>}
                    {s.suscripcion_vencimiento && (
                      <div style={{marginTop:6}}>
                        <span className={`sp-venc ${dias===null?"":dias<=0?"vencido":dias<=15?"pronto":"ok"}`}>
                          {dias !== null && dias <= 0 ? `Venció ${ff(s.suscripcion_vencimiento)}` : `Vence ${ff(s.suscripcion_vencimiento)}${dias!==null&&dias<=30?` · ${dias}d`:""}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="sp-acciones">
                    <button className="sp-btn sp-btn-editar" onClick={() => abrirEditar(s)}>✏️ Editar</button>
                    <button className="sp-btn sp-btn-extender" onClick={() => extenderMes(s)}>+1 mes</button>
                    <button className="sp-btn sp-btn-star" onClick={() => toggleDestacado(s)}>{s.destacado ? "★ Quitar destacado" : "☆ Destacar"}</button>
                    {estado !== "activa" && <button className="sp-btn sp-btn-activar" onClick={() => cambiarEstado(s.id, "activa")}>✓ Activar</button>}
                    {estado === "activa" && <button className="sp-btn sp-btn-suspender" onClick={() => cambiarEstado(s.id, "suspendida")}>⏸ Suspender</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>}
      </div>

      {mostrarForm && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setMostrarForm(false);setEditandoId(null);}}}>
          <div className="modal">
            <div className="modal-titulo">{editandoId ? "Editar" : "Nuevo"} <span>sponsor</span></div>
            <div className="modal-grid">
              <div className="field full"><label>Nombre / Empresa *</label><input placeholder="Ej: Seguros del Sur" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></div>
              <div className="field full"><label>Rubro *</label><select value={form.rubro} onChange={e=>setForm(f=>({...f,rubro:e.target.value}))}><option value="">Seleccioná el rubro</option>{RUBROS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
              <div className="field full"><label>Descripción (visible en el directorio)</label><textarea placeholder="Breve presentación del sponsor..." value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}/></div>
              <div className="field full"><label>Beneficio exclusivo para corredores GFI® 🎁</label><textarea placeholder="Ej: 10% de descuento en seguros para corredores GFI® — presentá tu matrícula al contratar" value={form.beneficio} onChange={e=>setForm(f=>({...f,beneficio:e.target.value}))} style={{minHeight:64}}/></div>
              <div className="field"><label>Teléfono / WhatsApp</label><input placeholder="3412345678" value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))}/></div>
              <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div className="field full"><label>Sitio web</label><input placeholder="https://..." value={form.sitio_web} onChange={e=>setForm(f=>({...f,sitio_web:e.target.value}))}/></div>
              <div className="field full"><label>URL del logo</label><input placeholder="https://... (imagen cuadrada recomendada)" value={form.logo_url} onChange={e=>setForm(f=>({...f,logo_url:e.target.value}))}/></div>
              <div className="field"><label>Monto mensual (USD)</label><input type="number" placeholder="0" value={form.monto_mensual_usd} onChange={e=>setForm(f=>({...f,monto_mensual_usd:e.target.value}))}/></div>
              <div className="field"><label>Vencimiento suscripción</label><input type="date" value={form.suscripcion_vencimiento} onChange={e=>setForm(f=>({...f,suscripcion_vencimiento:e.target.value}))}/></div>
              <div className="field full"><label>Zona / Cobertura</label><input placeholder="Ej: Rosario y Gran Rosario" value={form.zona} onChange={e=>setForm(f=>({...f,zona:e.target.value}))}/></div>
              <div className="field full"><label>Nota interna (solo admin)</label><input placeholder="Contacto comercial, condiciones, etc." value={form.nota_admin} onChange={e=>setForm(f=>({...f,nota_admin:e.target.value}))}/></div>
              <div className="full">
                <label className="field-check" onClick={()=>setForm(f=>({...f,destacado:!f.destacado}))}>
                  <input type="checkbox" checked={form.destacado} onChange={()=>{}} />
                  <span className="field-check-label"><strong>★ Sponsor Destacado</strong> — aparece primero con estrella</span>
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>{setMostrarForm(false);setEditandoId(null);}}>Cancelar</button>
              <button className="btn-save" onClick={guardar} disabled={guardando||!form.nombre||!form.rubro}>{guardando?"Guardando...":editandoId?"Guardar cambios":"Crear sponsor"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
