"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

interface RegistroPadron {
  id: string;
  matricula: string | null;
  apellido: string;
  nombre: string;
  inmobiliaria: string | null;
  direccion: string | null;
  localidad: string | null;
  telefono: string | null;
  email: string | null;
  estado: string | null;
  actualizado_at: string;
}

const ESTADOS_ALERTA = ["suspendido", "suspension", "baja", "dado de baja", "inhabilitado", "inactivo"];

const estadoColor = (estado: string | null) => {
  if (!estado) return "#22c55e";
  const e = estado.toLowerCase();
  if (ESTADOS_ALERTA.some(s => e.includes(s))) return "#ff4444";
  if (e.includes("habilitado") || e.includes("activo") || e.includes("vigente")) return "#22c55e";
  return "#eab308";
};

const estadoEmoji = (estado: string | null) => {
  if (!estado) return "✅";
  const e = estado.toLowerCase();
  if (ESTADOS_ALERTA.some(s => e.includes(s))) return "⛔";
  return "✅";
};

export default function PadronPage() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<RegistroPadron[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [totalPadron, setTotalPadron] = useState<number | null>(null);

  // Cargar total al montar
  useState(() => {
    supabase.from("cocir_padron").select("*", { count: "exact", head: true })
      .then(({ count }) => setTotalPadron(count));
  });

  const buscar = async () => {
    const q = busqueda.trim();
    if (!q) return;
    setLoading(true);
    setBuscado(true);

    // Buscar por matrícula exacta primero, luego por nombre
    const { data } = await supabase
      .from("cocir_padron")
      .select("*")
      .or(
        `matricula.ilike.%${q}%,apellido.ilike.%${q}%,nombre.ilike.%${q}%,inmobiliaria.ilike.%${q}%`
      )
      .order("apellido")
      .limit(50);

    setResultados(data ?? []);
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") buscar();
  };

  const limpiar = () => {
    setBusqueda("");
    setResultados([]);
    setBuscado(false);
  };

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');

        .pad-wrap { display: flex; flex-direction: column; gap: 20px; }

        /* Header */
        .pad-header { display: flex; flex-direction: column; gap: 4px; }
        .pad-titulo { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .pad-titulo span { color: #cc0000; }
        .pad-sub { font-size: 13px; color: rgba(255,255,255,0.35); }

        /* Stats bar */
        .pad-statsbar { display: flex; align-items: center; gap: 20px; padding: 12px 18px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; flex-wrap: wrap; }
        .pad-stat { display: flex; flex-direction: column; gap: 2px; }
        .pad-stat-val { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; line-height: 1; }
        .pad-stat-label { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); font-family: 'Montserrat', sans-serif; }
        .pad-stat-sep { width: 1px; height: 36px; background: rgba(255,255,255,0.08); }
        .pad-cocir-nota { font-size: 11px; color: rgba(255,255,255,0.25); margin-left: auto; font-style: italic; }

        /* Buscador */
        .pad-buscador { display: flex; gap: 10px; align-items: center; }
        .pad-search-wrap { flex: 1; position: relative; }
        .pad-search-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); font-size: 14px; color: rgba(255,255,255,0.25); }
        .pad-input { width: 100%; padding: 12px 14px 12px 38px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: #fff; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s, box-shadow 0.2s; }
        .pad-input:focus { border-color: rgba(200,0,0,0.5); box-shadow: 0 0 0 3px rgba(200,0,0,0.08); }
        .pad-input::placeholder { color: rgba(255,255,255,0.18); }
        .pad-btn-buscar { padding: 12px 24px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: background 0.2s; }
        .pad-btn-buscar:hover:not(:disabled) { background: #e60000; }
        .pad-btn-buscar:disabled { opacity: 0.6; cursor: not-allowed; }
        .pad-btn-limpiar { padding: 12px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
        .pad-btn-limpiar:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .pad-search-hint { font-size: 11px; color: rgba(255,255,255,0.2); margin-top: 6px; }

        /* Resultado único (verificación) */
        .pad-verificacion { background: rgba(14,14,14,0.95); border-radius: 6px; overflow: hidden; }
        .pad-veri-top { padding: 3px 0 0; }

        /* Tarjetas resultado */
        .pad-resultados-header { display: flex; align-items: center; justify-content: space-between; }
        .pad-resultados-count { font-size: 12px; color: rgba(255,255,255,0.3); }
        .pad-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
        .pad-card { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; transition: border-color 0.2s; }
        .pad-card:hover { border-color: rgba(255,255,255,0.14); }
        .pad-card.alerta { border-color: rgba(200,0,0,0.25); background: rgba(200,0,0,0.03); }
        .pad-card-top { padding: 14px 16px 12px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .pad-card-nombre { font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 800; color: #fff; line-height: 1.3; }
        .pad-card-mat { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 3px; font-family: 'Montserrat', sans-serif; font-weight: 600; }
        .pad-estado-pill { display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; flex-shrink: 0; }
        .pad-card-body { padding: 0 16px 14px; display: flex; flex-direction: column; gap: 7px; }
        .pad-card-row { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; }
        .pad-card-row-icon { font-size: 13px; flex-shrink: 0; margin-top: 1px; }
        .pad-card-row-val { color: rgba(255,255,255,0.6); line-height: 1.4; }
        .pad-card-row-val a { color: rgba(200,0,0,0.7); text-decoration: none; }
        .pad-card-row-val a:hover { color: #cc0000; }
        .pad-card-footer { padding: 9px 16px; background: rgba(255,255,255,0.02); border-top: 1px solid rgba(255,255,255,0.05); font-size: 10px; color: rgba(255,255,255,0.2); font-family: 'Montserrat', sans-serif; }

        /* Empty / loading */
        .pad-empty { padding: 64px 32px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        .pad-spinner { display: flex; align-items: center; justify-content: center; padding: 48px; }
        .pad-spin { width: 28px; height: 28px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Intro cuando no se buscó nada */
        .pad-intro { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .pad-intro-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px; text-align: center; }
        .pad-intro-icon { font-size: 28px; margin-bottom: 10px; }
        .pad-intro-titulo { font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
        .pad-intro-desc { font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.6; }

        @media (max-width: 700px) {
          .pad-buscador { flex-wrap: wrap; }
          .pad-grid { grid-template-columns: 1fr; }
          .pad-intro { grid-template-columns: 1fr; }
          .pad-statsbar { gap: 12px; }
          .pad-cocir-nota { margin-left: 0; }
        }
      `}</style>

      <div className="pad-wrap">

        {/* Header */}
        <div className="pad-header">
          <div className="pad-titulo">Padrón <span>COCIR</span></div>
          <div className="pad-sub">2da Circunscripción · Corredores matriculados habilitados</div>
        </div>

        {/* Stats bar */}
        <div className="pad-statsbar">
          <div className="pad-stat">
            <div className="pad-stat-val">{totalPadron?.toLocaleString("es-AR") ?? "..."}</div>
            <div className="pad-stat-label">Matriculados</div>
          </div>
          <div className="pad-stat-sep" />
          <div className="pad-stat">
            <div className="pad-stat-val" style={{color:"#22c55e"}}>✓</div>
            <div className="pad-stat-label">Actualizado</div>
          </div>
          <div className="pad-stat-sep" />
          <div className="pad-stat">
            <div className="pad-stat-val" style={{color:"#cc0000"}}>COCIR</div>
            <div className="pad-stat-label">Fuente oficial</div>
          </div>
          <div className="pad-cocir-nota">
            Datos sincronizados desde el padrón oficial de COCIR · Solo lectura
          </div>
        </div>

        {/* Buscador */}
        <div>
          <div className="pad-buscador">
            <div className="pad-search-wrap">
              <span className="pad-search-ico">🔍</span>
              <input
                className="pad-input"
                placeholder="Buscar por nombre, apellido, matrícula o inmobiliaria..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onKeyDown={handleKey}
              />
            </div>
            <button className="pad-btn-buscar" onClick={buscar} disabled={loading || !busqueda.trim()}>
              {loading ? "Buscando..." : "Buscar"}
            </button>
            {buscado && (
              <button className="pad-btn-limpiar" onClick={limpiar}>Limpiar</button>
            )}
          </div>
          <div className="pad-search-hint">
            Presioná Enter o hacé click en Buscar · Mínimo 2 caracteres
          </div>
        </div>

        {/* Resultados */}
        {loading ? (
          <div className="pad-spinner"><div className="pad-spin" /></div>
        ) : buscado ? (
          resultados.length === 0 ? (
            <div className="pad-empty">
              No se encontraron matriculados con ese criterio.<br/>
              <span style={{fontSize:12,marginTop:8,display:"block"}}>
                Intentá con el apellido, nombre completo o número de matrícula.
              </span>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div className="pad-resultados-header">
                <div className="pad-resultados-count">
                  {resultados.length} resultado{resultados.length !== 1 ? "s" : ""} para &quot;{busqueda}&quot;
                  {resultados.length === 50 && " (mostrando los primeros 50)"}
                </div>
              </div>
              <div className="pad-grid">
                {resultados.map(r => {
                  const color = estadoColor(r.estado);
                  const emoji = estadoEmoji(r.estado);
                  const esAlerta = r.estado && ESTADOS_ALERTA.some(s => r.estado!.toLowerCase().includes(s));
                  return (
                    <div key={r.id} className={`pad-card${esAlerta ? " alerta" : ""}`}>
                      <div className="pad-card-top">
                        <div>
                          <div className="pad-card-nombre">{r.apellido}, {r.nombre}</div>
                          {r.matricula && (
                            <div className="pad-card-mat">Mat. {r.matricula}</div>
                          )}
                        </div>
                        <div className="pad-estado-pill" style={{
                          background: `${color}18`,
                          border: `1px solid ${color}45`,
                          color,
                        }}>
                          {emoji} {r.estado?.toUpperCase() || "HABILITADO"}
                        </div>
                      </div>
                      <div className="pad-card-body">
                        {r.inmobiliaria && (
                          <div className="pad-card-row">
                            <span className="pad-card-row-icon">🏢</span>
                            <span className="pad-card-row-val">{r.inmobiliaria}</span>
                          </div>
                        )}
                        {r.direccion && (
                          <div className="pad-card-row">
                            <span className="pad-card-row-icon">📍</span>
                            <span className="pad-card-row-val">
                              {r.direccion}{r.localidad ? ` · ${r.localidad}` : ""}
                            </span>
                          </div>
                        )}
                        {r.telefono && (
                          <div className="pad-card-row">
                            <span className="pad-card-row-icon">📞</span>
                            <span className="pad-card-row-val">
                              <a href={`https://wa.me/54${r.telefono.replace(/\D/g,"")}`}
                                target="_blank" rel="noopener noreferrer">
                                {r.telefono}
                              </a>
                            </span>
                          </div>
                        )}
                        {r.email && (
                          <div className="pad-card-row">
                            <span className="pad-card-row-icon">✉️</span>
                            <span className="pad-card-row-val">
                              <a href={`mailto:${r.email}`}>{r.email}</a>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="pad-card-footer">
                        Actualizado: {formatFecha(r.actualizado_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* Intro cuando no se buscó nada */
          <div className="pad-intro">
            <div className="pad-intro-card">
              <div className="pad-intro-icon">🔍</div>
              <div className="pad-intro-titulo">Buscar corredor</div>
              <div className="pad-intro-desc">
                Encontrá cualquier corredor matriculado en la 2da Circunscripción por nombre, apellido o matrícula.
              </div>
            </div>
            <div className="pad-intro-card">
              <div className="pad-intro-icon">✅</div>
              <div className="pad-intro-titulo">Verificar habilitación</div>
              <div className="pad-intro-desc">
                Consultá el estado de matrícula de un colega antes de cerrar una operación compartida.
              </div>
            </div>
            <div className="pad-intro-card">
              <div className="pad-intro-icon">📋</div>
              <div className="pad-intro-titulo">Datos de contacto</div>
              <div className="pad-intro-desc">
                Accedé a teléfono, email e inmobiliaria directamente desde el padrón oficial de COCIR.
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
