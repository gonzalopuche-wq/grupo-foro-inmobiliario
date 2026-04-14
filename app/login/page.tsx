"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Completá email y contraseña.");
      return;
    }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    // Verificar perfil activo
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("tipo, estado")
      .eq("id", data.user.id)
      .single();

    if (!perfil) {
      setError("No se encontró tu perfil. Contactá al administrador.");
      setLoading(false);
      return;
    }

    if (perfil.estado === "pendiente") {
      setError("Tu cuenta está pendiente de aprobación. Te avisaremos por email.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (perfil.estado === "rechazado") {
      setError("Tu solicitud fue rechazada. Contactá al administrador.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // Redirigir según tipo
    if (perfil.tipo === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0a;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
          padding: 24px;
        }
        .login-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(180,0,0,0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          background: rgba(14,14,14,0.95);
          border: 1px solid rgba(180,0,0,0.22);
          border-radius: 4px;
          padding: 44px 40px 40px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.7), 0 0 60px rgba(160,0,0,0.1);
          animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        .login-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #cc0000, #e60000, #cc0000, transparent);
          border-radius: 4px 4px 0 0;
        }
        .login-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 28px;
        }
        .login-logo img {
          width: 160px;
          height: auto;
        }
        .login-titulo {
          font-family: 'Montserrat', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          text-align: center;
          margin-bottom: 28px;
        }
        .login-field { margin-bottom: 16px; }
        .login-label {
          display: block;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          margin-bottom: 7px;
          font-family: 'Montserrat', sans-serif;
        }
        .login-input {
          width: 100%;
          padding: 13px 15px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 3px;
          color: #ffffff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .login-input::placeholder { color: rgba(255,255,255,0.18); }
        .login-input:focus {
          border-color: rgba(200,0,0,0.6);
          box-shadow: 0 0 0 3px rgba(200,0,0,0.1);
        }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #141414 inset;
          -webkit-text-fill-color: #ffffff;
        }
        .login-error {
          font-size: 12px;
          color: #ff4444;
          background: rgba(200,0,0,0.08);
          border: 1px solid rgba(200,0,0,0.2);
          border-radius: 3px;
          padding: 10px 14px;
          margin-bottom: 14px;
        }
        .login-btn {
          width: 100%;
          padding: 14px;
          margin-top: 8px;
          background: #cc0000;
          border: none;
          border-radius: 3px;
          color: #fff;
          font-family: 'Montserrat', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .login-btn:hover:not(:disabled) {
          background: #e60000;
          transform: translateY(-1px);
        }
        .login-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .login-spinner {
          display: inline-block;
          width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-forgot {
          display: block;
          text-align: center;
          margin-top: 16px;
          font-size: 12px;
          color: rgba(255,255,255,0.3);
          text-decoration: none;
          transition: color 0.2s;
        }
        .login-forgot:hover { color: rgba(200,0,0,0.7); }
        .login-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 20px 0 16px;
        }
        .login-footer {
          text-align: center;
          font-size: 12px;
          color: rgba(255,255,255,0.3);
        }
        .login-footer a {
          color: rgba(200,0,0,0.7);
          text-decoration: none;
          font-weight: 500;
        }
        .login-footer a:hover { color: #cc0000; }
        .login-brand {
          text-align: center;
          font-family: 'Montserrat', sans-serif;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.12);
          margin-top: 16px;
        }
      `}</style>

      <div className="login-root">
        <div className="login-card">
          <div className="login-logo">
            <img src="/logo.jpg" alt="Grupo Foro Inmobiliario" />
          </div>

          <p className="login-titulo">Acceso a la plataforma</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label className="login-label">Correo electrónico</label>
              <input
                className="login-input"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="login-field">
              <label className="login-label">Contraseña</label>
              <input
                className="login-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {error && <div className="login-error" role="alert">{error}</div>}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading && <span className="login-spinner" />}
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <a className="login-forgot" href="#">¿Olvidaste tu contraseña?</a>

          <div className="login-divider" />

          <div className="login-footer">
            ¿No tenés cuenta? <a href="/registro">Solicitá tu acceso acá</a>
          </div>

          <div className="login-brand">Grupo Foro Inmobiliario · Rosario</div>
        </div>
      </div>
    </>
  );
}
