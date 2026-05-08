"use client";

import { useState, FormEvent } from "react";

type Paso = "tipo" | "datos" | "enviado";
type TipoUsuario = "corredor" | "colaborador";
type EstadoMatricula = "idle" | "verificando" | "ok" | "error" | "bypass";

const ESPECIALIDADES = [
  { id: "alquileres", label: "Alquileres", icon: "🔑" },
  { id: "ventas", label: "Ventas", icon: "🏠" },
  { id: "tasaciones", label: "Tasaciones", icon: "📊" },
  { id: "consorcios", label: "Consorcios", icon: "🏢" },
];

export default function RegistroPage() {
  const [paso, setPaso] = useState<Paso>("tipo");
  const [tipo, setTipo] = useState<TipoUsuario>("corredor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [matricula, setMatricula] = useState("");
  const [celularOficina, setCelularOficina] = useState("");
  const [celularPersonal, setCelularPersonal] = useState("");
  const [celularMostrar, setCelularMostrar] = useState<"oficina" | "personal">("personal");
  const [inmobiliaria, setInmobiliaria] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dni, setDni] = useState("");
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [corredorMatricula, setCorredorMatricula] = useState("");

  // Verificación COCIR
  const [estadoMatricula, setEstadoMatricula] = useState<EstadoMatricula>("idle");
  const [mensajeMatricula, setMensajeMatricula] = useState("");
  const [matriculaVerificada, setMatriculaVerificada] = useState(false);
  const [padronVacio, setPadronVacio] = useState(false);
  const [datoscocir, setDatosCocir] = useState<{ nombre: string; apellido: string; inmobiliaria: string } | null>(null);

  const toggleEspecialidad = (id: string) => {
    setEspecialidades(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleMatriculaChange = (val: string) => {
    setMatricula(val);
    if (matriculaVerificada || estadoMatricula !== "idle") {
      setMatriculaVerificada(false);
      setEstadoMatricula("idle");
      setMensajeMatricula("");
      setDatosCocir(null);
      setPadronVacio(false);
      setNombre("");
      setApellido("");
      setInmobiliaria("");
    }
  };

  const verificarMatricula = async () => {
    const mat = matricula.trim();
    if (!mat) {
      setMensajeMatricula("Ingresá tu número de matrícula.");
      setEstadoMatricula("error");
      return;
    }

    setEstadoMatricula("verificando");
    setMensajeMatricula("");

    try {
      const res = await fetch("/api/matricula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula: mat }),
      });
      const json = await res.json();

      if (!res.ok) {
        setEstadoMatricula("error");
        setMensajeMatricula(json.error ?? "Error al verificar la matrícula.");
        setMatriculaVerificada(false);
        return;
      }

      if (json.padron_vacio) {
        setEstadoMatricula("bypass");
        setMensajeMatricula(json.advertencia);
        setMatriculaVerificada(true);
        setPadronVacio(true);
        setDatosCocir({ nombre: "", apellido: "", inmobiliaria: "" });
        return;
      }

      setEstadoMatricula("ok");
      setMensajeMatricula(`✓ ${json.apellido}, ${json.nombre} — matrícula válida`);
      setMatriculaVerificada(true);
      setPadronVacio(false);
      setDatosCocir({ nombre: json.nombre, apellido: json.apellido, inmobiliaria: json.inmobiliaria ?? "" });
      setNombre(json.nombre ?? "");
      setApellido(json.apellido ?? "");
      setInmobiliaria(json.inmobiliaria ?? "");
    } catch {
      setEstadoMatricula("error");
      setMensajeMatricula("Error de conexión. Intentá de nuevo.");
      setMatriculaVerificada(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !nombre || !apellido) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    if (tipo === "corredor") {
      if (!matricula) {
        setError("La matrícula es obligatoria para corredores.");
        return;
      }
      if (!matriculaVerificada) {
        setError("Verificá tu matrícula COCIR antes de continuar.");
        return;
      }
    }
    if (tipo === "colaborador") {
      if (!dni) {
        setError("El DNI es obligatorio para colaboradores.");
        return;
      }
      if (especialidades.length === 0) {
        setError("Seleccioná al menos una especialidad.");
        return;
      }
      if (!corredorMatricula.trim()) {
        setError("Ingresá la matrícula del corredor titular.");
        return;
      }
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, password, tipo,
          nombre, apellido,
          celular_oficina: celularOficina || null,
          celular_personal: celularPersonal || null,
          celular_mostrar: celularMostrar,
          matricula: tipo === "corredor" ? matricula : null,
          padron_vacio: padronVacio,
          dni: tipo === "colaborador" ? dni : null,
          inmobiliaria: tipo === "corredor" ? inmobiliaria : null,
          especialidades: tipo === "colaborador" ? especialidades : null,
          corredor_matricula: tipo === "colaborador" ? corredorMatricula.trim() : null,
        }),
      });
      const json = await res.json();

      setLoading(false);

      if (!res.ok) {
        setError(json.error ?? "Error al crear la cuenta. Intentá de nuevo.");
        return;
      }
    } catch {
      setLoading(false);
      setError("Error de conexión. Intentá de nuevo.");
      return;
    }

    setPaso("enviado");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; }

        .reg-root {
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
        .reg-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(180,0,0,0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .reg-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          background: rgba(14,14,14,0.95);
          border: 1px solid rgba(180,0,0,0.22);
          border-radius: 4px;
          padding: 44px 40px 40px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.7), 0 0 60px rgba(160,0,0,0.1);
          animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .reg-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #cc0000, #e60000, #cc0000, transparent);
          border-radius: 4px 4px 0 0;
        }
        .reg-logo { display: flex; justify-content: center; margin-bottom: 28px; }
        .reg-logo img { width: 160px; height: auto; }
        .reg-titulo {
          font-family: 'Montserrat', sans-serif;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(255,255,255,0.35); text-align: center; margin-bottom: 28px;
        }
        .reg-tipo { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
        .reg-tipo-btn {
          padding: 16px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px; cursor: pointer;
          transition: all 0.2s; text-align: center;
          display: flex; flex-direction: column; gap: 6px; align-items: center;
        }
        .reg-tipo-btn:hover { border-color: rgba(200,0,0,0.4); background: rgba(200,0,0,0.05); }
        .reg-tipo-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); }
        .reg-tipo-icon { font-size: 24px; }
        .reg-tipo-label {
          font-family: 'Montserrat', sans-serif;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; color: rgba(255,255,255,0.7); text-transform: uppercase;
        }
        .reg-tipo-btn.activo .reg-tipo-label { color: #fff; }
        .reg-tipo-desc { font-size: 10px; color: rgba(255,255,255,0.3); line-height: 1.4; }

        .reg-field { margin-bottom: 14px; }
        .reg-label {
          display: block; font-size: 10px; font-weight: 500;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.4); margin-bottom: 7px;
          font-family: 'Montserrat', sans-serif;
        }
        .reg-label span { color: #cc0000; margin-left: 2px; }
        .reg-input {
          width: 100%; padding: 12px 15px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 3px; color: #ffffff; font-size: 14px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .reg-input::placeholder { color: rgba(255,255,255,0.18); }
        .reg-input:focus {
          border-color: rgba(200,0,0,0.6);
          box-shadow: 0 0 0 3px rgba(200,0,0,0.1);
        }
        .reg-input.ok {
          border-color: rgba(0,200,100,0.5);
          background: rgba(0,200,100,0.04);
        }
        .reg-input.err { border-color: rgba(200,0,0,0.5); }
        .reg-input.warn {
          border-color: rgba(234,179,8,0.5);
          background: rgba(234,179,8,0.04);
        }
        .reg-input:-webkit-autofill,
        .reg-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #141414 inset;
          -webkit-text-fill-color: #ffffff;
        }
        .reg-input:disabled { opacity: 0.6; cursor: not-allowed; }
        .reg-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .mat-row { display: flex; gap: 8px; align-items: flex-end; }
        .mat-row .reg-input { flex: 1; }
        .mat-verificar {
          padding: 12px 16px;
          background: rgba(200,0,0,0.15);
          border: 1px solid rgba(200,0,0,0.35);
          border-radius: 3px;
          color: #fff;
          font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          cursor: pointer; white-space: nowrap;
          transition: all 0.2s; flex-shrink: 0;
        }
        .mat-verificar:hover:not(:disabled) { background: rgba(200,0,0,0.3); border-color: rgba(200,0,0,0.6); }
        .mat-verificar:disabled { opacity: 0.5; cursor: not-allowed; }
        .mat-verificar.ok { background: rgba(0,200,100,0.12); border-color: rgba(0,200,100,0.4); color: #4ade80; }
        .mat-verificar.bypass { background: rgba(234,179,8,0.12); border-color: rgba(234,179,8,0.4); color: #eab308; }
        .mat-msg {
          margin-top: 7px; font-size: 11px; line-height: 1.5;
          padding: 8px 12px; border-radius: 3px;
        }
        .mat-msg.ok { color: #4ade80; background: rgba(0,200,100,0.07); border: 1px solid rgba(0,200,100,0.2); }
        .mat-msg.bypass { color: #eab308; background: rgba(234,179,8,0.07); border: 1px solid rgba(234,179,8,0.2); }
        .mat-msg.err { color: #ff6b6b; background: rgba(200,0,0,0.07); border: 1px solid rgba(200,0,0,0.2); }
        .mat-msg.loading { color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }

        .reg-prellenado {
          background: rgba(0,200,100,0.04);
          border: 1px solid rgba(0,200,100,0.15);
          border-radius: 3px; padding: 12px 14px; margin-bottom: 14px;
          font-size: 11px; color: rgba(255,255,255,0.4);
        }
        .reg-prellenado strong { color: rgba(255,255,255,0.65); }

        .reg-especialidades-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .reg-esp-btn {
          padding: 12px 10px; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer;
          transition: all 0.2s; display: flex; align-items: center; gap: 10px;
        }
        .reg-esp-btn:hover { border-color: rgba(200,0,0,0.35); background: rgba(200,0,0,0.05); }
        .reg-esp-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.12); }
        .reg-esp-icon { font-size: 18px; }
        .reg-esp-label {
          font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.6);
        }
        .reg-esp-btn.activo .reg-esp-label { color: #fff; }
        .reg-esp-check {
          margin-left: auto; width: 16px; height: 16px;
          border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; flex-shrink: 0;
        }
        .reg-esp-btn.activo .reg-esp-check { background: #cc0000; border-color: #cc0000; color: #fff; }

        .reg-error {
          font-size: 12px; color: #ff4444;
          background: rgba(200,0,0,0.08);
          border: 1px solid rgba(200,0,0,0.2);
          border-radius: 3px; padding: 10px 14px; margin-bottom: 14px;
        }
        .reg-btn {
          width: 100%; padding: 14px; margin-top: 8px;
          background: #cc0000; border: none; border-radius: 3px;
          color: #fff; font-family: 'Montserrat', sans-serif;
          font-size: 12px; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase; cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .reg-btn:hover:not(:disabled) { background: #e60000; transform: translateY(-1px); }
        .reg-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .reg-spinner {
          display: inline-block; width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
          border-radius: 50%; animation: spin 0.7s linear infinite;
          margin-right: 8px; vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .reg-footer { margin-top: 20px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.3); }
        .reg-footer a { color: rgba(200,0,0,0.7); text-decoration: none; font-weight: 500; }
        .reg-footer a:hover { color: #cc0000; }
        .reg-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 20px 0 16px; }
        .reg-brand {
          text-align: center; font-family: 'Montserrat', sans-serif;
          font-size: 9px; font-weight: 600; letter-spacing: 0.25em;
          text-transform: uppercase; color: rgba(255,255,255,0.12);
        }
        .reg-nota {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 3px; padding: 12px 14px; margin-bottom: 16px;
          font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5;
        }
        .reg-nota strong { color: rgba(255,255,255,0.7); }
        .reg-enviado {
          text-align: center; display: flex; flex-direction: column;
          align-items: center; gap: 16px; padding: 12px 0;
        }
        .reg-enviado-icon { font-size: 48px; }
        .reg-enviado h2 { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .reg-enviado h2 span { color: #cc0000; }
        .reg-enviado p { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.6; max-width: 320px; }
        .reg-enviado-volver { margin-top: 8px; font-size: 12px; color: rgba(200,0,0,0.7); text-decoration: none; font-weight: 500; }
        .reg-enviado-volver:hover { color: #cc0000; }
      `}</style>

      <div className="reg-root">
        <div className="reg-card">
          <div className="reg-logo">
            <img src="/logo.jpg" alt="Grupo Foro Inmobiliario" />
          </div>

          {paso === "enviado" ? (
            <div className="reg-enviado">
              <div className="reg-enviado-icon">✅</div>
              <h2>Solicitud <span>enviada</span></h2>
              <p>Tu solicitud fue recibida. El administrador la revisará y te avisará por email cuando tu cuenta esté aprobada.</p>
              <a className="reg-enviado-volver" href="/">← Volver al inicio</a>
            </div>
          ) : (
            <>
              <p className="reg-titulo">Solicitud de registro</p>

              <div className="reg-tipo">
                <button type="button" className={`reg-tipo-btn${tipo === "corredor" ? " activo" : ""}`} onClick={() => setTipo("corredor")}>
                  <span className="reg-tipo-icon">🏢</span>
                  <span className="reg-tipo-label">Corredor</span>
                  <span className="reg-tipo-desc">Matriculado en COCIR</span>
                </button>
                <button type="button" className={`reg-tipo-btn${tipo === "colaborador" ? " activo" : ""}`} onClick={() => setTipo("colaborador")}>
                  <span className="reg-tipo-icon">👤</span>
                  <span className="reg-tipo-label">Colaborador</span>
                  <span className="reg-tipo-desc">Empleado de un corredor</span>
                </button>
              </div>

              {tipo === "colaborador" && (
                <div className="reg-nota">
                  <strong>Colaboradores:</strong> Necesitás la matrícula del corredor para quien trabajás. Tu acceso será aprobado por el administrador.
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>

                {/* MATRÍCULA CORREDOR CON VERIFICACIÓN COCIR */}
                {tipo === "corredor" && (
                  <div className="reg-field">
                    <label className="reg-label">Matrícula COCIR <span>*</span></label>
                    <div className="mat-row">
                      <input
                        className={`reg-input${estadoMatricula === "ok" ? " ok" : estadoMatricula === "bypass" ? " warn" : estadoMatricula === "error" ? " err" : ""}`}
                        type="text"
                        placeholder="Ej: 2540"
                        value={matricula}
                        onChange={e => handleMatriculaChange(e.target.value)}
                        disabled={loading || estadoMatricula === "verificando"}
                      />
                      <button
                        type="button"
                        className={`mat-verificar${estadoMatricula === "ok" ? " ok" : estadoMatricula === "bypass" ? " bypass" : ""}`}
                        onClick={verificarMatricula}
                        disabled={loading || estadoMatricula === "verificando" || matriculaVerificada}
                      >
                        {estadoMatricula === "verificando" ? "..." : matriculaVerificada ? "✓ OK" : "Verificar"}
                      </button>
                    </div>
                    {mensajeMatricula && (
                      <div className={`mat-msg ${estadoMatricula === "ok" ? "ok" : estadoMatricula === "bypass" ? "bypass" : estadoMatricula === "verificando" ? "loading" : "err"}`}>
                        {estadoMatricula === "verificando" ? "Verificando en el padrón COCIR..." : mensajeMatricula}
                      </div>
                    )}
                  </div>
                )}

                {/* MATRÍCULA DEL CORREDOR PARA COLABORADORES */}
                {tipo === "colaborador" && (
                  <div className="reg-field">
                    <label className="reg-label">Matrícula del corredor titular <span>*</span></label>
                    <input
                      className="reg-input"
                      type="text"
                      placeholder="Ej: 2540"
                      value={corredorMatricula}
                      onChange={e => setCorredorMatricula(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                )}

                {/* DATOS PRELLENADOS DESDE COCIR */}
                {tipo === "corredor" && matriculaVerificada && !padronVacio && datoscocir && (
                  <div className="reg-prellenado">
                    Datos cargados desde el padrón COCIR. Podés editarlos si es necesario.
                  </div>
                )}

                <div className="reg-fila">
                  <div className="reg-field">
                    <label className="reg-label">Nombre <span>*</span></label>
                    <input className="reg-input" type="text" placeholder="Gonzalo"
                      value={nombre} onChange={e => setNombre(e.target.value)} disabled={loading} />
                  </div>
                  <div className="reg-field">
                    <label className="reg-label">Apellido <span>*</span></label>
                    <input className="reg-input" type="text" placeholder="Puche"
                      value={apellido} onChange={e => setApellido(e.target.value)} disabled={loading} />
                  </div>
                </div>

                {tipo === "corredor" && (
                  <>
                    <div className="reg-fila">
                      <div className="reg-field">
                        <label className="reg-label">Celular de oficina</label>
                        <input className="reg-input" type="text" placeholder="3416806480"
                          value={celularOficina} onChange={e => setCelularOficina(e.target.value)} disabled={loading} />
                      </div>
                      <div className="reg-field">
                        <label className="reg-label">Celular personal</label>
                        <input className="reg-input" type="text" placeholder="3416806480"
                          value={celularPersonal} onChange={e => setCelularPersonal(e.target.value)} disabled={loading} />
                      </div>
                    </div>
                    <div className="reg-field">
                      <label className="reg-label">¿Cuál se muestra públicamente?</label>
                      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        {(["oficina", "personal"] as const).map(op => (
                          <button key={op} type="button" onClick={() => setCelularMostrar(op)} disabled={loading}
                            style={{
                              flex: 1, padding: "10px 12px", borderRadius: 3, cursor: "pointer",
                              fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700,
                              letterSpacing: "0.12em", textTransform: "uppercase",
                              border: celularMostrar === op ? "1px solid #cc0000" : "1px solid rgba(255,255,255,0.12)",
                              background: celularMostrar === op ? "rgba(200,0,0,0.12)" : "rgba(255,255,255,0.03)",
                              color: celularMostrar === op ? "#fff" : "rgba(255,255,255,0.4)",
                            }}>
                            {op === "oficina" ? "📋 Oficina" : "📱 Personal"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="reg-field">
                      <label className="reg-label">Inmobiliaria</label>
                      <input className="reg-input" type="text" placeholder="Nombre de la inmobiliaria"
                        value={inmobiliaria} onChange={e => setInmobiliaria(e.target.value)} disabled={loading} />
                    </div>
                  </>
                )}

                {tipo === "colaborador" && (
                  <>
                    <div className="reg-field">
                      <label className="reg-label">DNI <span>*</span></label>
                      <input className="reg-input" type="text" placeholder="25750876"
                        value={dni} onChange={e => setDni(e.target.value)} disabled={loading} />
                    </div>
                    <div className="reg-field">
                      <label className="reg-label">Especialidades <span>*</span></label>
                      <div className="reg-especialidades-grid">
                        {ESPECIALIDADES.map(esp => (
                          <button
                            key={esp.id}
                            type="button"
                            className={`reg-esp-btn${especialidades.includes(esp.id) ? " activo" : ""}`}
                            onClick={() => toggleEspecialidad(esp.id)}
                            disabled={loading}
                          >
                            <span className="reg-esp-icon">{esp.icon}</span>
                            <span className="reg-esp-label">{esp.label}</span>
                            <span className="reg-esp-check">{especialidades.includes(esp.id) ? "✓" : ""}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="reg-field">
                  <label className="reg-label">Email <span>*</span></label>
                  <input className="reg-input" type="email" placeholder="tu@correo.com"
                    value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
                </div>

                <div className="reg-field">
                  <label className="reg-label">Contraseña <span>*</span></label>
                  <input className="reg-input" type="password" placeholder="Mínimo 6 caracteres"
                    value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
                </div>

                {error && <div className="reg-error" role="alert">{error}</div>}

                <button
                  className="reg-btn"
                  type="submit"
                  disabled={loading || (tipo === "corredor" && !matriculaVerificada)}
                >
                  {loading && <span className="reg-spinner" />}
                  {loading ? "Enviando..." : tipo === "corredor" && !matriculaVerificada ? "Verificá tu matrícula primero" : "Enviar solicitud"}
                </button>
              </form>

              <div className="reg-footer">
                ¿Ya tenés cuenta? <a href="/login">Ingresá acá</a>
              </div>
              <div className="reg-divider" />
              <div className="reg-brand">Grupo Foro Inmobiliario · Rosario</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
