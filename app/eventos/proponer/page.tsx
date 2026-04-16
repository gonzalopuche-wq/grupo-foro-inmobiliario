"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TIPOS = [
  { value: "gfi", label: "GFI® Oficial", desc: "Evento organizado por el Grupo Foro Inmobiliario" },
  { value: "ci", label: "Corredor Inmobiliario", desc: "Evento organizado por un corredor de la red" },
  { value: "externo", label: "Externo (COCIR / CIR)", desc: "Evento de una institución del sector" },
];

export default function ProponerEventoPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    fecha: "",
    lugar: "",
    link_externo: "",
    tipo: "ci",
    gratuito: true,
    precio_entrada: "",
    capacidad: "",
  });

  const [errores, setErrores] = useState<Record<string, string>>({});

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/login"); return; }
      setUserId(data.user.id);
      setLoading(false);
    };
    init();
  }, []);

  const set = (k: string, v: string | boolean) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrores(p => ({ ...p, [k]: "" }));
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.titulo.trim()) e.titulo = "El título es obligatorio";
    if (!form.fecha) e.fecha = "La fecha es obligatoria";
    else if (new Date(form.fecha) < new Date()) e.fecha = "La fecha debe ser futura";
    if (!form.gratuito && !form.precio_entrada) e.precio_entrada = "Ingresá el precio";
    return e;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validar();
    if (Object.keys(errs).length > 0) { setErrores(errs); return; }
    if (!userId) return;

    setGuardando(true);
    const { error } = await supabase.from("eventos").insert({
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      fecha: new Date(form.fecha).toISOString(),
      lugar: form.lugar || null,
      link_externo: form.link_externo || null,
      tipo: form.tipo,
      gratuito: form.gratuito,
      precio_entrada: !form.gratuito && form.precio_entrada ? parseFloat(form.precio_entrada) : null,
      capacidad: form.capacidad ? parseInt(form.capacidad) : null,
      estado: "solicitado",
      organizador_id: userId,
    });

    setGuardando(false);
    if (error) {
      setErrores({ general: "No se pudo enviar la propuesta. Intentá de nuevo." });
      return;
    }
    setEnviado(true);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "2px solid rgba(200,0,0,0.2)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; }

        .pr-root { min-height: 100vh; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }

        .pr-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .pr-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .pr-topbar-logo span { color: #cc0000; }
        .pr-btn-volver { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .pr-btn-volver:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

        .pr-content { max-width: 640px; margin: 0 auto; padding: 40px 24px; }

        .pr-header { margin-bottom: 32px; }
        .pr-titulo { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .pr-titulo span { color: #cc0000; }
        .pr-sub { font-size: 13px; color: rgba(255,255,255,0.35); line-height: 1.6; }

        .pr-info-box { background: rgba(200,0,0,0.06); border: 1px solid rgba(200,0,0,0.2); border-radius: 5px; padding: 14px 18px; margin-bottom: 28px; }
        .pr-info-box p { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.7; }
        .pr-info-box strong { color: rgba(255,255,255,0.8); }

        .pr-form { display: flex; flex-direction: column; gap: 18px; }
        .pr-field { display: flex; flex-direction: column; gap: 6px; }
        .pr-label { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
        .pr-label .req { color: #cc0000; margin-left: 2px; }
        .pr-input { padding: 11px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s, box-shadow 0.2s; }
        .pr-input:focus { border-color: rgba(200,0,0,0.5); box-shadow: 0 0 0 3px rgba(200,0,0,0.07); }
        .pr-input::placeholder { color: rgba(255,255,255,0.18); }
        .pr-input.error { border-color: rgba(200,0,0,0.5); }
        .pr-textarea { padding: 11px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; resize: vertical; min-height: 90px; transition: border-color 0.2s; }
        .pr-textarea:focus { border-color: rgba(200,0,0,0.5); }
        .pr-textarea::placeholder { color: rgba(255,255,255,0.18); }
        .pr-error-txt { font-size: 11px; color: #ff6666; }

        .pr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .pr-tipos { display: flex; flex-direction: column; gap: 8px; }
        .pr-tipo-btn { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; transition: all 0.2s; text-align: left; }
        .pr-tipo-btn:hover { border-color: rgba(200,0,0,0.3); background: rgba(200,0,0,0.04); }
        .pr-tipo-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.08); }
        .pr-tipo-radio { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; transition: border-color 0.2s; }
        .pr-tipo-btn.activo .pr-tipo-radio { border-color: #cc0000; }
        .pr-tipo-radio-inner { width: 8px; height: 8px; border-radius: 50%; background: #cc0000; display: none; }
        .pr-tipo-btn.activo .pr-tipo-radio-inner { display: block; }
        .pr-tipo-label { font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; color: #fff; }
        .pr-tipo-desc { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }

        .pr-entrada { display: flex; gap: 8px; }
        .pr-toggle { flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .pr-toggle.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }

        .pr-divider { height: 1px; background: rgba(255,255,255,0.07); }

        .pr-error-general { padding: 12px 16px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.25); border-radius: 4px; font-size: 12px; color: #ff6666; }

        .pr-btn-submit { padding: 14px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; }
        .pr-btn-submit:hover:not(:disabled) { background: #e60000; }
        .pr-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .pr-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .pr-enviado { text-align: center; padding: 48px 24px; }
        .pr-enviado-icon { font-size: 48px; margin-bottom: 16px; }
        .pr-enviado-titulo { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 10px; }
        .pr-enviado-titulo span { color: #22c55e; }
        .pr-enviado-txt { font-size: 14px; color: rgba(255,255,255,0.4); line-height: 1.7; margin-bottom: 28px; }
        .pr-btn-volver2 { display: inline-block; padding: 12px 24px; background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: rgba(255,255,255,0.6); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; text-decoration: none; transition: all 0.2s; }
        .pr-btn-volver2:hover { border-color: rgba(255,255,255,0.4); color: #fff; }

        @media (max-width: 600px) { .pr-row { grid-template-columns: 1fr; } .pr-content { padding: 24px 16px; } }
      `}</style>

      <div className="pr-root">
        <header className="pr-topbar">
          <div className="pr-topbar-logo"><span>GFI</span>® · Proponer evento</div>
          <a className="pr-btn-volver" href="/eventos">← Eventos</a>
        </header>

        <main className="pr-content">
          {enviado ? (
            <div className="pr-enviado">
              <div className="pr-enviado-icon">🎉</div>
              <div className="pr-enviado-titulo">¡Propuesta <span>enviada</span>!</div>
              <div className="pr-enviado-txt">
                Tu propuesta fue recibida y está en revisión.<br />
                El equipo de GFI® la revisará y te notificará por email.<br />
                <strong style={{ color: "rgba(255,255,255,0.7)" }}>Los eventos aprobados se publican en la sección de eventos.</strong>
              </div>
              <a className="pr-btn-volver2" href="/eventos">← Ver todos los eventos</a>
            </div>
          ) : (
            <>
              <div className="pr-header">
                <div className="pr-titulo">Proponer un <span>evento</span></div>
                <div className="pr-sub">
                  Completá el formulario y el equipo de GFI® lo revisará. Una vez aprobado, se publicará en la sección de eventos.
                </div>
              </div>

              <div className="pr-info-box">
                <p>
                  <strong>¿Cómo funciona?</strong> Tu propuesta queda en estado <strong>Solicitado</strong>.
                  El admin la revisa, puede definir un costo de publicación y la aprueba o rechaza.
                  Si es aprobada y el pago se confirma, el evento se publica automáticamente.
                </p>
              </div>

              <form className="pr-form" onSubmit={handleSubmit} noValidate>

                {/* Título */}
                <div className="pr-field">
                  <label className="pr-label">Título del evento <span className="req">*</span></label>
                  <input className={`pr-input${errores.titulo ? " error" : ""}`} placeholder="Ej: Desayuno de negocios en Rosario" value={form.titulo} onChange={e => set("titulo", e.target.value)} />
                  {errores.titulo && <span className="pr-error-txt">{errores.titulo}</span>}
                </div>

                {/* Descripción */}
                <div className="pr-field">
                  <label className="pr-label">Descripción</label>
                  <textarea className="pr-textarea" placeholder="Contá de qué se trata el evento, quiénes participan, qué se va a tratar..." value={form.descripcion} onChange={e => set("descripcion", e.target.value)} />
                </div>

                {/* Fecha y lugar */}
                <div className="pr-row">
                  <div className="pr-field">
                    <label className="pr-label">Fecha y hora <span className="req">*</span></label>
                    <input className={`pr-input${errores.fecha ? " error" : ""}`} type="datetime-local" value={form.fecha} onChange={e => set("fecha", e.target.value)} />
                    {errores.fecha && <span className="pr-error-txt">{errores.fecha}</span>}
                  </div>
                  <div className="pr-field">
                    <label className="pr-label">Lugar</label>
                    <input className="pr-input" placeholder="Dirección o lugar" value={form.lugar} onChange={e => set("lugar", e.target.value)} />
                  </div>
                </div>

                {/* Tipo */}
                <div className="pr-field">
                  <label className="pr-label">Tipo de evento</label>
                  <div className="pr-tipos">
                    {TIPOS.map(t => (
                      <button key={t.value} type="button" className={`pr-tipo-btn${form.tipo === t.value ? " activo" : ""}`} onClick={() => set("tipo", t.value)}>
                        <div className="pr-tipo-radio">
                          <div className="pr-tipo-radio-inner" />
                        </div>
                        <div>
                          <div className="pr-tipo-label">{t.label}</div>
                          <div className="pr-tipo-desc">{t.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Entrada */}
                <div className="pr-field">
                  <label className="pr-label">Entrada</label>
                  <div className="pr-entrada">
                    <button type="button" className={`pr-toggle${form.gratuito ? " activo" : ""}`} onClick={() => set("gratuito", true)}>Gratuita</button>
                    <button type="button" className={`pr-toggle${!form.gratuito ? " activo" : ""}`} onClick={() => set("gratuito", false)}>De pago</button>
                    {!form.gratuito && (
                      <input className={`pr-input${errores.precio_entrada ? " error" : ""}`} type="number" placeholder="Precio $" style={{ maxWidth: 120 }} value={form.precio_entrada} onChange={e => set("precio_entrada", e.target.value)} />
                    )}
                  </div>
                  {errores.precio_entrada && <span className="pr-error-txt">{errores.precio_entrada}</span>}
                </div>

                {/* Capacidad y link */}
                <div className="pr-row">
                  <div className="pr-field">
                    <label className="pr-label">Capacidad estimada</label>
                    <input className="pr-input" type="number" placeholder="Ej: 30" value={form.capacidad} onChange={e => set("capacidad", e.target.value)} />
                  </div>
                  <div className="pr-field">
                    <label className="pr-label">Link externo (opcional)</label>
                    <input className="pr-input" placeholder="https://..." value={form.link_externo} onChange={e => set("link_externo", e.target.value)} />
                  </div>
                </div>

                <div className="pr-divider" />

                {errores.general && <div className="pr-error-general">{errores.general}</div>}

                <button className="pr-btn-submit" type="submit" disabled={guardando}>
                  {guardando && <span className="pr-spinner" />}
                  {guardando ? "Enviando propuesta..." : "Enviar propuesta al admin"}
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </>
  );
}
