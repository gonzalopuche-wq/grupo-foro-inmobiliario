"use client";

import { useState, FormEvent } from "react";
import { supabase } from "./lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Completá los dos campos para continuar.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Usuario o contraseña incorrectos.");
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0a; }
        .gfi-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0a;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }
        .gfi-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(180,0,0,0.18) 0%, transparent 70%);
          pointer-events: none;
        }
        .gfi-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          margin: 24px;
          background: rgba(14,14,14,0.95);
          border: 1px solid rgba(180,0,0,0.25);
          border-radius: 4px;
          padding: 48px 40px 44px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.7), 0 0 60px rgba(160,0,0,0.12);
          animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .gfi-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #cc0000, #e60000, #cc0000, transparent);
          border-radius: 4px 4px 0 0;
        }
        .gfi-logo-wrap { display: flex; justify-content: center; margin-bottom: 36px; }
        .gfi-logo-wrap img { width: 210px; height: auto; }
        .gfi-heading {
          font-family: 'Montserrat', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(255,255,255,0.35); text-align: center; margin-bottom: 32px;
        }
        .gfi-field { margin-bottom: 16px; }
        .gfi-label {
          display: block; font-size: 10px; font-weight: 500;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.4); margin-bottom: 8px;
          font-family: 'Montserrat', sans-serif;
        }
        .gfi-input {
          width: 100%; padding: 13px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 3px; color: #ffffff; font-size: 14px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .gfi-input::placeholder { color: rgba(255,255,255,0.18); }
        .gfi-input:focus {
          border-color: rgba(200,0,0,0.6);
          box-shadow: 0 0 0 3px rgba(200,0,0,0.1);
        }
        .gfi-input:-webkit-autofill,
        .gfi-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #141414 inset;
          -webkit-text-fill-color: #ffffff;
        }
        .gfi-error {
          font-size: 12px; color: #ff4444;
          background: rgba(200,0,0,0.08);
          border: 1px solid rgba(200,0,0,0.2);
          border-radius: 3px; padding: 10px 14px; margin-bottom: 16px;
        }
        .gfi-btn {
          width: 100%; padding: 14px; margin-top: 8px;
          background: #cc0000; border: none; border-radius: 3px;
          color: #ffffff; font-family: 'Montserrat', sans-serif;
          font-size: 13px; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase; cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .gfi-btn:hover:not(:disabled) { background: #e60000; transform: translateY(-1px); }
        .gfi-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .gfi-spinner {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
          border-radius: 50%; animation: spin 0.7s linear infinite;
          margin-right: 8px; vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .gfi-footer { margin-top: 24px; text-align: center; }
        .gfi-footer a {
          font-size: 12px; color: rgba(255,255,255,0.3);
          text-decoration: none; transition: color 0.2s;
        }
        .gfi-footer a:hover { color: rgba(200,0,0,0.8); }
        .gfi-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 24px 0 16px; }
        .gfi-registro {
          text-align: center;
          font-size: 12px;
          color: rgba(255,255,255,0.3);
          margin-bottom: 4px;
        }
        .gfi-registro a {
          color: rgba(200,0,0,0.8);
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }
        .gfi-registro a:hover { color: #cc0000; }
        .gfi-brand {
          text-align: center; font-family: 'Montserrat', sans-serif;
          font-size: 9px; font-weight: 600; letter-spacing: 0.25em;
          text-transform: uppercase; color: rgba(255,255,255,0.15);
        }
      `}</style>

      <div className="gfi-root">
        <div className="gfi-card">
          <div className="gfi-logo-wrap">
            <img src="/logo.jpg" alt="Grupo Foro Inmobiliario" />
          </div>
          <p className="gfi-heading">Acceso a la plataforma</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="gfi-field">
              <label className="gfi-label" htmlFor="email">Correo electrónico</label>
              <input
                className="gfi-input" id="email" type="email"
                autoComplete="email" placeholder="tu@correo.com"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}
              />
            </div>
            <div className="gfi-field">
              <label className="gfi-label" htmlFor="password">Contraseña</label>
              <input
                className="gfi-input" id="password" type="password"
                autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
              />
            </div>
            {error && <div className="gfi-error" role="alert">{error}</div>}
            <button className="gfi-btn" type="submit" disabled={loading}>
              {loading && <span className="gfi-spinner" />}
              {loading ? "Verificando..." : "Ingresar"}
            </button>
          </form>
          <div className="gfi-footer">
            <a href="#">¿Olvidaste tu contraseña?</a>
          </div>
          <div className="gfi-divider" />
          <div className="gfi-registro">
            ¿No tenés cuenta? <a href="/registro">Solicitá tu acceso acá</a>
          </div>
          <div style={{marginTop: 16}}>
            <div className="gfi-brand">Grupo Foro Inmobiliario · Rosario</div>
          </div>
        </div>
      </div>
    </>
  );
}
