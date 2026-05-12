"use client";

import { useState } from "react";

const RUBROS = ["Electricista","Plomero","Gasista","Pintor","Carpintero","Albañil","Arquitecto","Ingeniero","Escribano","Abogado","Contador","Tasador","Fotógrafo","Marketing / Publicidad","Informática / Tecnología","Mudanza","Cerrajero","Aire acondicionado","Seguros","Financiero / Inversiones","Otro"];

export default function SponsorRegistroPage() {
  const [form, setForm] = useState({ empresa:"", rubro:"", descripcion:"", contacto_nombre:"", contacto_email:"", contacto_telefono:"", sitio_web:"", mensaje:"" });
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  const enviar = async () => {
    setError("");
    if (!form.empresa || !form.rubro || !form.contacto_nombre || !form.contacto_email) { setError("Completá los campos obligatorios (*)"); return; }
    setEnviando(true);
    const res = await fetch("/api/sponsors/solicitar", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
    const data = await res.json();
    setEnviando(false);
    if (!res.ok) { setError(data.error ?? "Error al enviar"); return; }
    setOk(true);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", alignItems:"center", justifyContent:"center", padding:"32px 16px", fontFamily:"Inter, Arial, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@300;400;500&display=swap');
        .sr-wrap{width:100%;max-width:540px}
        .sr-logo{display:flex;align-items:center;gap:12px;margin-bottom:32px}
        .sr-logo img{width:40px;height:40px;border-radius:10px}
        .sr-logo-txt{font-family:'Montserrat',sans-serif;font-size:16px;font-weight:900;color:#fff;letter-spacing:0.04em}
        .sr-logo-txt span{color:#cc0000}
        .sr-card{background:#0f0f0f;border:1px solid rgba(200,0,0,0.2);border-radius:10px;padding:32px;position:relative;overflow:hidden}
        .sr-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#cc0000 40%,transparent)}
        .sr-titulo{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:900;color:#fff;margin-bottom:4px}
        .sr-titulo span{color:#cc0000}
        .sr-sub{font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:24px;line-height:1.6}
        .sr-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .sr-grid .full{grid-column:1/-1}
        .field{display:flex;flex-direction:column;gap:5px}
        .field label{font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.35)}
        .field input,.field select,.field textarea{padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:#fff;font-size:13px;outline:none;font-family:'Inter',sans-serif;transition:border-color 0.2s;width:100%;box-sizing:border-box}
        .field input:focus,.field select:focus,.field textarea:focus{border-color:rgba(200,0,0,0.4)}
        .field input::placeholder,.field textarea::placeholder{color:rgba(255,255,255,0.2)}
        .field select{background:#0f0f0f}
        .field textarea{resize:vertical;min-height:80px}
        .sr-nota{font-size:11px;color:rgba(255,255,255,0.25);line-height:1.6;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:4px;margin-top:4px}
        .sr-btn{width:100%;padding:13px;background:#cc0000;border:none;border-radius:5px;color:#fff;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;margin-top:20px;transition:background 0.2s}
        .sr-btn:hover:not(:disabled){background:#e60000}
        .sr-btn:disabled{opacity:0.6;cursor:not-allowed}
        .sr-error{color:#ff6666;font-size:12px;text-align:center;margin-top:10px;padding:8px 12px;background:rgba(200,0,0,0.08);border-radius:4px;border:1px solid rgba(200,0,0,0.2)}
        .sr-ok{text-align:center;padding:32px 0}
        .sr-ok-icon{font-size:40px;margin-bottom:12px}
        .sr-ok-titulo{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:8px}
        .sr-ok-sub{font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7}
        @media(max-width:500px){.sr-grid{grid-template-columns:1fr}.sr-grid .full{grid-column:1}}
      `}</style>

      <div className="sr-wrap">
        <div className="sr-logo">
          <img src="/logo_gfi.png" alt="GFI" />
          <span className="sr-logo-txt">GFI® <span>Sponsors</span></span>
        </div>
        <div className="sr-card">
          {ok ? (
            <div className="sr-ok">
              <div className="sr-ok-icon">✅</div>
              <div className="sr-ok-titulo">¡Solicitud enviada!</div>
              <div className="sr-ok-sub">Recibimos tu información. El equipo GFI® va a revisar tu solicitud y te contactaremos a la brevedad para coordinar los detalles de tu suscripción.</div>
            </div>
          ) : (
            <>
              <div className="sr-titulo">Quiero ser <span>Sponsor GFI®</span></div>
              <div className="sr-sub">Llegá a más de 500 corredores inmobiliarios activos. Completá el formulario y te contactamos.</div>
              <div className="sr-grid">
                <div className="field full"><label>Empresa / Nombre comercial *</label><input placeholder="Ej: Seguros del Sur" value={form.empresa} onChange={e=>setForm(f=>({...f,empresa:e.target.value}))}/></div>
                <div className="field full"><label>Rubro *</label><select value={form.rubro} onChange={e=>setForm(f=>({...f,rubro:e.target.value}))}><option value="">Seleccioná el rubro</option>{RUBROS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                <div className="field full"><label>Descripción breve de tu empresa</label><textarea placeholder="¿A qué se dedica tu empresa? ¿Qué ofrecés a los corredores?" value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}/></div>
                <div className="field"><label>Tu nombre completo *</label><input placeholder="Nombre y apellido" value={form.contacto_nombre} onChange={e=>setForm(f=>({...f,contacto_nombre:e.target.value}))}/></div>
                <div className="field"><label>Email de contacto *</label><input type="email" placeholder="contacto@empresa.com" value={form.contacto_email} onChange={e=>setForm(f=>({...f,contacto_email:e.target.value}))}/></div>
                <div className="field"><label>Teléfono / WhatsApp</label><input placeholder="3412345678" value={form.contacto_telefono} onChange={e=>setForm(f=>({...f,contacto_telefono:e.target.value}))}/></div>
                <div className="field"><label>Sitio web</label><input placeholder="https://..." value={form.sitio_web} onChange={e=>setForm(f=>({...f,sitio_web:e.target.value}))}/></div>
                <div className="field full"><label>¿Qué beneficio pensás ofrecer a los corredores?</label><textarea placeholder="Ej: 10% de descuento en seguros para corredores GFI®..." value={form.mensaje} onChange={e=>setForm(f=>({...f,mensaje:e.target.value}))}/></div>
              </div>
              <div className="sr-nota">Tu información es solo para uso interno de GFI®. No será compartida con terceros sin tu consentimiento.</div>
              <button className="sr-btn" onClick={enviar} disabled={enviando}>{enviando ? "Enviando..." : "Enviar solicitud"}</button>
              {error && <div className="sr-error">{error}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
