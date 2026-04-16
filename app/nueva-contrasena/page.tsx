"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function NuevaContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Supabase maneja el token del link automáticamente via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionOk(true);
      }
      setCheckingSession(false);
    });

    // También verificar sesión activa directamente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionOk(true);
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError("No se pudo actualizar la contraseña. El link puede haber expirado.");
      return;
    }

    setListo(true);
    setTimeout(() => router.push("/dashboard"), 2500);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; }
        .nc-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0a; position: relative; overflow: hidden; font-family: 'Inter', sans-serif; padding: 24px; }
        .nc-root::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(180,0,0,0.15) 0%, transparent 70%); pointer-events: none; }
        .nc-card { position: relative; z-index: 1; width: 100%; max-width: 440px; background: rgba(14,14,14,0.95); border: 1px solid rgba(180,0,0,0.22); border-radius: 4px; padding: 44px 40px 40px; box-shadow: 0 24px 80px rgba(0,0,0,0.7); animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes cardIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .nc-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, #e60000, #cc0000, transparent); border-radius: 4px 4px 0 0; }
        .nc-logo { display: flex; justify-content: center; margin-bottom: 28px; }
        .nc-logo img { width: 120px; height: auto; }
        .nc-titulo { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; color: #fff; text-align: center; margin-bottom: 8px; }
        .nc-sub { font-size: 13px; color: rgba(255,255,255,0.35); text-align: center; margin-bottom: 28px; line-height: 1.6; }
        .nc-field { margin-bottom: 14px; }
        .nc-label { display: block; font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 7px; font-family: 'Montserrat', sans-serif; }
        .nc-input { width: 100%; padding: 13px 15px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; font-family: 'Inter', sans-serif; }
        .nc-input:focus { border-color: rgba(200,0,0,0.6); box-shadow: 0 0 0 3px rgba(200,0,0,0.1); }
        .nc-input::placeholder { color: rgba(255,255,255,0.18); }
        .nc-strength { height: 3px; border-radius: 2px; margin-top: 6px; transition: all 0.3s; }
        .nc-strength-txt { font-size: 10px; margin-top: 4px; font-family: 'Montserrat', sans-serif; font-weight: 600; letter-spacing: 0.08em; }
        .nc-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; padding: 10px 14px; margin-bottom: 14px; }
        .nc-btn { width: 100%; padding: 14px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; margin-top: 4px; }
        .nc-btn:hover:not(:disabled) { background: #e60000; }
        .nc-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .nc-spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .nc-listo { text-align: center; padding: 8px 0; }
        .nc-listo-icon { font-size: 40px; margin-bottom: 14px; }
        .nc-listo-titulo { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; color: #22c55e; margin-bottom: 10px; }
        .nc-listo-txt { font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.7; }
        .nc-invalid { text-align: center; }
        .nc-invalid-icon { font-size: 36px; margin-bottom: 14px; }
        .nc-invalid-txt { font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.7; margin-bottom: 20px; }
        .nc-link { display: block; text-align: center; font-size: 12px; color: rgba(200,0,0,0.7); text-decoration: none; margin-top: 16px; }
        .nc-link:hover { color: #cc0000; }
        .nc-brand { text-align: center; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.1); margin-top: 20px; }
        .nc-loading { display: flex; align-items: center; justify-content: center; padding: 40px; }
        .nc-loading-spin { width: 28px; height: 28px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
      `}</style>

      <div className="nc-root">
        <div className="nc-card">
          <div className="nc-logo">
            <img src="/logo.jpg" alt="GFI" />
          </div>

          {checkingSession ? (
            <div className="nc-loading"><div className="nc-loading-spin" /></div>
          ) : listo ? (
            <div className="nc-listo">
              <div className="nc-listo-icon">✅</div>
              <div className="nc-listo-titulo">Contraseña actualizada</div>
              <div className="nc-listo-txt">Tu contraseña fue cambiada correctamente.<br/>Redirigiendo al dashboard...</div>
            </div>
          ) : !sessionOk ? (
            <div className="nc-invalid">
              <div className="nc-invalid-icon">⚠️</div>
              <div className="nc-titulo">Link inválido o expirado</div>
              <div className="nc-invalid-txt">
                Este link ya fue usado o expiró.<br/>
                Solicitá uno nuevo desde el login.
              </div>
              <a className="nc-link" href="/recuperar-contrasena">← Solicitar nuevo link</a>
            </div>
          ) : (
            <>
              <div className="nc-titulo">Nueva contraseña</div>
              <div className="nc-sub">Elegí una contraseña segura para tu cuenta.</div>
              <form onSubmit={handleSubmit} noValidate>
                <div className="nc-field">
                  <label className="nc-label">Nueva contraseña</label>
                  <input
                    className="nc-input"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  {password.length > 0 && (
                    <>
                      <div className="nc-strength" style={{
                        width: password.length < 6 ? "30%" : password.length < 10 ? "60%" : "100%",
                        background: password.length < 6 ? "#cc0000" : password.length < 10 ? "#eab308" : "#22c55e",
                      }} />
                      <div className="nc-strength-txt" style={{
                        color: password.length < 6 ? "#cc0000" : password.length < 10 ? "#eab308" : "#22c55e"
                      }}>
                        {password.length < 6 ? "Muy corta" : password.length < 10 ? "Regular" : "Segura"}
                      </div>
                    </>
                  )}
                </div>
                <div className="nc-field">
                  <label className="nc-label">Confirmar contraseña</label>
                  <input
                    className="nc-input"
                    type="password"
                    placeholder="Repetí la contraseña"
                    value={confirmar}
                    onChange={e => setConfirmar(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                    style={{
                      borderColor: confirmar.length > 0
                        ? confirmar === password ? "rgba(34,197,94,0.5)" : "rgba(200,0,0,0.5)"
                        : undefined
                    }}
                  />
                </div>
                {error && <div className="nc-error">{error}</div>}
                <button className="nc-btn" type="submit" disabled={loading || !password || !confirmar}>
                  {loading && <span className="nc-spinner" />}
                  {loading ? "Guardando..." : "Guardar nueva contraseña"}
                </button>
              </form>
            </>
          )}

          <div className="nc-brand">Grupo Foro Inmobiliario · Rosario</div>
        </div>
      </div>
    </>
  );
}
