"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import PWAInstallWidget from "../components/PWAInstallWidget";

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 60 * 1000; // 1 minuto de espera tras 5 intentos

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Recuperar estado de bloqueo de sessionStorage al montar
  useEffect(() => {
    const locked = sessionStorage.getItem("gfi_login_locked_until");
    const attempts = sessionStorage.getItem("gfi_login_attempts");
    if (locked) setBloqueadoHasta(Number(locked));
    if (attempts) setIntentosFallidos(Number(attempts));
    // Consumir el motivo de cierre (sesión tomada en otro dispositivo) para que
    // no persista en próximos accesos.
    try { localStorage.removeItem("gfi_logout_motivo"); } catch { /* ignore */ }
  }, []);

  // Countdown timer cuando está bloqueado
  useEffect(() => {
    if (!bloqueadoHasta) return;
    const tick = setInterval(() => {
      const remaining = Math.ceil((bloqueadoHasta - Date.now()) / 1000);
      if (remaining <= 0) {
        setBloqueadoHasta(null);
        setCountdown(0);
        sessionStorage.removeItem("gfi_login_locked_until");
        clearInterval(tick);
      } else {
        setCountdown(remaining);
      }
    }, 500);
    return () => clearInterval(tick);
  }, [bloqueadoHasta]);

  const motivoParam = params.get("motivo");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    // Verificar bloqueo activo
    if (bloqueadoHasta && Date.now() < bloqueadoHasta) {
      setError(`Demasiados intentos fallidos. Esperá ${countdown} segundos.`);
      return;
    }

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
      const nuevosIntentos = intentosFallidos + 1;
      setIntentosFallidos(nuevosIntentos);
      sessionStorage.setItem("gfi_login_attempts", String(nuevosIntentos));

      if (nuevosIntentos >= MAX_INTENTOS) {
        const hasta = Date.now() + BLOQUEO_MS;
        setBloqueadoHasta(hasta);
        sessionStorage.setItem("gfi_login_locked_until", String(hasta));
        setError(`Demasiados intentos fallidos. Cuenta bloqueada temporalmente por 60 segundos.`);
      } else {
        const restantes = MAX_INTENTOS - nuevosIntentos;
        setError(`Email o contraseña incorrectos. ${restantes} intento${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""}.`);
      }
      setLoading(false);
      return;
    }

    // Login exitoso — limpiar contadores
    sessionStorage.removeItem("gfi_login_attempts");
    sessionStorage.removeItem("gfi_login_locked_until");
    setIntentosFallidos(0);

    // Log de auditoría (fire-and-forget, no bloquea el acceso)
    fetch("/api/auth/log-login", {
      method: "POST",
      headers: { "Authorization": `Bearer ${data.session?.access_token}` },
    }).catch(() => {});

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

    // Sesión única por dispositivo (solo corredores/colaboradores; el admin puede
    // usar varios dispositivos). Este equipo toma la sesión activa y desplaza
    // cualquier otra sesión abierta del corredor en otro dispositivo (que se
    // cerrará sola al detectar que el id de sesión cambió).
    if (perfil.tipo !== "admin" && perfil.tipo !== "master") {
      const sesionId = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try { localStorage.setItem("gfi_sesion_id", sesionId); } catch { /* storage no disponible */ }
      await supabase.from("perfiles")
        .update({ sesion_activa_id: sesionId, sesion_activa_at: new Date().toISOString() })
        .eq("id", data.user.id);
    }

    if (perfil.tipo === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <>
      <style>{`
        
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #08090b; }
        .login-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #08090b; position: relative; overflow: hidden; font-family: 'Inter', sans-serif; padding: 24px; }
        .login-root::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(140,0,0,0.16) 0%, transparent 70%), radial-gradient(ellipse 60% 45% at 50% 0%, rgba(192,164,104,0.05) 0%, transparent 70%); pointer-events: none; }
        .login-card { position: relative; z-index: 1; width: 100%; max-width: 440px; background: linear-gradient(180deg, rgba(255,255,255,0.022) 0%, transparent 26%), rgba(18,20,25,0.96); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 46px 40px 40px; box-shadow: 0 30px 90px rgba(0,0,0,0.72), 0 0 60px rgba(160,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05); animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes cardIn { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .login-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(192,164,104,0.65), rgba(216,189,132,0.95), rgba(192,164,104,0.65), transparent); border-radius: 6px 6px 0 0; }
        .login-logo { display: flex; justify-content: center; margin-bottom: 18px; }
        .login-logo img { width: 160px; height: auto; }
        .login-titulo { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(255,255,255,0.4); text-align: center; margin-bottom: 28px; position: relative; padding-bottom: 18px; }
        .login-titulo::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 34px; height: 2px; border-radius: 1px; background: linear-gradient(90deg, transparent, rgba(192,164,104,0.8), transparent); }
        .login-field { margin-bottom: 16px; }
        .login-label { display: block; font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.42); margin-bottom: 7px; font-family: 'Montserrat', sans-serif; }
        .login-input { width: 100%; padding: 13px 15px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #ffffff; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; font-family: 'Inter', sans-serif; }
        .login-input::placeholder { color: rgba(255,255,255,0.18); }
        .login-input:focus { border-color: rgba(192,164,104,0.55); box-shadow: 0 0 0 3px rgba(192,164,104,0.12); }
        .login-input:-webkit-autofill, .login-input:-webkit-autofill:focus { -webkit-box-shadow: 0 0 0 1000px #141414 inset; -webkit-text-fill-color: #ffffff; }
        .login-error { font-size: 12px; color: #ff6b6b; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; }
        .login-btn { width: 100%; padding: 14px; margin-top: 8px; background: linear-gradient(135deg, #7d0000 0%, #a30000 60%, #b81414 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; cursor: pointer; transition: box-shadow 0.2s, transform 0.15s; box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 6px 22px rgba(153,0,0,0.3); }
        .login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 30px rgba(153,0,0,0.4); }
        .login-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .login-spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-forgot { display: block; text-align: center; margin-top: 16px; font-size: 12px; color: rgba(255,255,255,0.3); text-decoration: none; cursor: pointer; background: none; border: none; width: 100%; transition: color 0.2s; font-family: 'Inter', sans-serif; }
        .login-forgot:hover { color: rgba(192,164,104,0.85); }
        .login-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 20px 0 16px; }
        .login-footer { text-align: center; font-size: 12px; color: rgba(255,255,255,0.3); }
        .login-footer a { color: rgba(192,164,104,0.85); text-decoration: none; font-weight: 500; }
        .login-footer a:hover { color: #d8bd84; }
        .login-brand { text-align: center; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.14); margin-top: 16px; }
      `}</style>

      <div className="login-root">
        <div className="login-card">
          <div className="login-logo">
            <img src="/logo.jpg" alt="Grupo Foro Inmobiliario" />
          </div>

          <p className="login-titulo">Acceso a la plataforma</p>

          {motivoParam === "inactividad" && (
            <div style={{ fontSize: 12, color: "#d4960c", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", borderRadius: 3, padding: "10px 14px", marginBottom: 14 }}>
              ⏱ Sesión cerrada por inactividad. Volvé a ingresar.
            </div>
          )}

          {motivoParam === "otro_dispositivo" && (
            <div style={{ fontSize: 12, color: "#d4960c", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", borderRadius: 3, padding: "10px 14px", marginBottom: 14 }}>
              📱 Tu sesión se cerró porque ingresaste desde otro dispositivo.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label className="login-label">Correo electrónico</label>
              <input className="login-input" type="email" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} autoComplete="email" />
            </div>
            <div className="login-field">
              <label className="login-label">Contraseña</label>
              <input className="login-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} autoComplete="current-password" />
            </div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button
              className="login-btn"
              type="submit"
              disabled={loading || (bloqueadoHasta != null && Date.now() < bloqueadoHasta)}
            >
              {loading && <span className="login-spinner" />}
              {loading ? "Ingresando..." : bloqueadoHasta && countdown > 0 ? `Bloqueado (${countdown}s)` : "Ingresar"}
            </button>
          </form>

          <a className="login-forgot" href="/recuperar-contrasena">¿Olvidaste tu contraseña?</a>

          <div className="login-divider" />

          <div className="login-footer">
            ¿No tenés cuenta? <a href="/registro">Solicitá tu acceso acá</a>
          </div>

          <PWAInstallWidget />

          <div className="login-brand">Grupo Foro Inmobiliario · Rosario</div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
