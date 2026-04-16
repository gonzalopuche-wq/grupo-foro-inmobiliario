"use client";

import { useState, FormEvent } from "react";
import { supabase } from "../lib/supabase";

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) { setError("Ingresá tu email."); return; }
    setLoading(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    });

    setLoading(false);
    if (err) {
      setError("No se pudo enviar el email. Verificá que sea correcto.");
      return;
    }
    setEnviado(true);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; }
        .rc-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0a; position: relative; overflow: hidden; font-family: 'Inter', sans-serif; padding: 24px; }
        .rc-root::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(180,0,0,0.15) 0%, transparent 70%); pointer-events: none; }
        .rc-card { position: relative; z-index: 1; width: 100%; max-width: 440px; background: rgba(14,14,14,0.95); border: 1px solid rgba(180,0,0,0.22); border-radius: 4px; padding: 44px 40px 40px; box-shadow: 0 24px 80px rgba(0,0,0,0.7); animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes cardIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .rc-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, #e60000, #cc0000, transparent); border-radius: 4px 4px 0 0; }
        .rc-logo { display: flex; justify-content: center; margin-bottom: 28px; }
        .rc-logo img { width: 120px; height: auto; }
        .rc-titulo { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; color: #fff; text-align: center; margin-bottom: 8px; }
        .rc-sub { font-size: 13px; color: rgba(255,255,255,0.35); text-align: center; margin-bottom: 28px; line-height: 1.6; }
        .rc-label { display: block; font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 7px; font-family: 'Montserrat', sans-serif; }
        .rc-input { width: 100%; padding: 13px 15px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; font-family: 'Inter', sans-serif; margin-bottom: 14px; }
        .rc-input:focus { border-color: rgba(200,0,0,0.6); box-shadow: 0 0 0 3px rgba(200,0,0,0.1); }
        .rc-input::placeholder { color: rgba(255,255,255,0.18); }
        .rc-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; padding: 10px 14px; margin-bottom: 14px; }
        .rc-btn { width: 100%; padding: 14px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; }
        .rc-btn:hover:not(:disabled) { background: #e60000; }
        .rc-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .rc-spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .rc-enviado { text-align: center; padding: 8px 0; }
        .rc-enviado-icon { font-size: 40px; margin-bottom: 14px; }
        .rc-enviado-titulo { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; color: #22c55e; margin-bottom: 10px; }
        .rc-enviado-txt { font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.7; }
        .rc-volver { display: block; text-align: center; margin-top: 20px; font-size: 12px; color: rgba(255,255,255,0.3); text-decoration: none; transition: color 0.2s; }
        .rc-volver:hover { color: rgba(200,0,0,0.7); }
        .rc-brand { text-align: center; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.1); margin-top: 20px; }
      `}</style>

      <div className="rc-root">
        <div className="rc-card">
          <div className="rc-logo">
            <img src="/logo.jpg" alt="GFI" />
          </div>

          {enviado ? (
            <div className="rc-enviado">
              <div className="rc-enviado-icon">✉️</div>
              <div className="rc-enviado-titulo">Email enviado</div>
              <div className="rc-enviado-txt">
                Te mandamos un link a <strong style={{color:"#fff"}}>{email}</strong>.<br/>
                Revisá tu bandeja de entrada y también el spam.<br/>
                El link expira en 1 hora.
              </div>
              <a className="rc-volver" href="/login">← Volver al login</a>
            </div>
          ) : (
            <>
              <div className="rc-titulo">Recuperar contraseña</div>
              <div className="rc-sub">
                Ingresá tu email y te mandamos un link para crear una nueva contraseña.
              </div>
              <form onSubmit={handleSubmit} noValidate>
                <label className="rc-label">Correo electrónico</label>
                <input
                  className="rc-input"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />
                {error && <div className="rc-error">{error}</div>}
                <button className="rc-btn" type="submit" disabled={loading}>
                  {loading && <span className="rc-spinner" />}
                  {loading ? "Enviando..." : "Enviar link de recuperación"}
                </button>
              </form>
              <a className="rc-volver" href="/login">← Volver al login</a>
            </>
          )}

          <div className="rc-brand">Grupo Foro Inmobiliario · Rosario</div>
        </div>
      </div>
    </>
  );
}
