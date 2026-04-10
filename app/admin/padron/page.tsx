"use client";

import { useEffect, useState } from "react";
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

interface Alerta {
  id: string;
  perfil_id: string;
  tipo: string;
  detalle: string;
  estado_padron: string | null;
  leida: boolean;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null; email: string | null; };
}

interface PerfilConEstado {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  email: string | null;
  estado: string;
  tipo: string;
  estado_padron?: string | null;
  en_padron?: boolean;
  es_alerta?: boolean;
}

const ESTADOS_ALERTA = ["suspendido", "suspension", "baja", "dado de baja", "inhabilitado", "inactivo"];

function estadoPadronColor(estado: string | null | undefined): string {
  if (!estado) return "rgba(255,255,255,0.3)";
  const e = estado.toLowerCase();
  if (ESTADOS_ALERTA.some(s => e.includes(s))) return "#ff4444";
  if (e.includes("habilitado") || e.includes("activo") || e.includes("vigente")) return "#22c55e";
  return "#eab308";
}

function estadoPadronEmoji(estado: string | null | undefined, enPadron: boolean): string {
  if (!enPadron) return "❓";
  if (!estado) return "✅";
  const e = estado.toLowerCase();
  if (ESTADOS_ALERTA.some(s => e.includes(s))) return "⛔";
  return "✅";
}

export default function PadronPage() {
  const [vista, setVista] = useState<"alertas" | "verificados" | "padron">("alertas");
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [perfiles, setPerfiles] = useState<PerfilConEstado[]>([]);
  const [padron, setPadron] = useState<RegistroPadron[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);
  const [stats, setStats] = useState({ ok: 0, alertas: 0, noEncontrados: 0, totalPadron: 0 });

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (!perfil || perfil.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      cargarDatos();
    };
    init();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    await Promise.all([cargarAlertas(), cargarPerfilesVerificados(), cargarEstadisticas()]);
    setLoading(false);
  };

  const cargarAlertas = async () => {
    const { data } = await supabase
      .from("cocir_alertas")
      .select("*, perfiles(nombre,apellido,matricula,email)")
      .order("created_at", { ascending: false })
      .limit(100);
    setAlertas((data as unknown as Alerta[]) ?? []);
  };

  const cargarPerfilesVerificados = async () => {
    const { data: profs } = await supabase
      .from("perfiles")
      .select("id,nombre,apellido,matricula,email,estado,tipo")
      .eq("tipo", "corredor")
      .eq("estado", "aprobado")
      .order("apellido");

    if (!profs) return;

    // Para cada perfil, buscar en el padrón
    const perfilesConEstado: PerfilConEstado[] = [];
    for (const p of profs) {
      if (!p.matricula) {
        perfilesConEstado.push({ ...p, en_padron: false, estado_padron: null, es_alerta: false });
        continue;
      }
      const { data: padronRow } = await supabase
        .from("cocir_padron")
        .select("estado")
        .eq("matricula", p.matricula)
        .maybeSingle();

      const en_padron = !!padronRow;
      const estado_padron = padronRow?.estado ?? null;
      const es_alerta = !en_padron || ESTADOS_ALERTA.some(s => (estado_padron ?? "").toLowerCase().includes(s));

      perfilesConEstado.push({ ...p, en_padron, estado_padron, es_alerta });
    }
    setPerfiles(perfilesConEstado);
  };

  const cargarEstadisticas = async () => {
    const [{ count: totalPadron }, { count: totalAlertas }, ultima] = await Promise.all([
      supabase.from("cocir_padron").select("*", { count: "exact", head: true }),
      supabase.from("cocir_alertas").select("*", { count: "exact", head: true }).eq("leida", false),
      supabase.from("cocir_padron").select("actualizado_at").order("actualizado_at", { ascending: false }).limit(1),
    ]);
    if (ultima.data?.[0]) setUltimaActualizacion(ultima.data[0].actualizado_at);
    setStats(prev => ({ ...prev, totalPadron: totalPadron ?? 0, alertas: totalAlertas ?? 0 }));
  };

  const cargarPadron = async () => {
    setLoading(true);
    const query = supabase.from("cocir_padron").select("*").order("apellido").limit(500);
    const { data } = await query;
    setPadron(data ?? []);
    setLoading(false);
  };

  const marcarAlertaLeida = async (id: string) => {
    await supabase.from("cocir_alertas").update({ leida: true }).eq("id", id);
    cargarAlertas();
    cargarEstadisticas();
  };

  const marcarTodasLeidas = async () => {
    await supabase.from("cocir_alertas").update({ leida: true }).eq("leida", false);
    cargarAlertas();
    cargarEstadisticas();
  };

  const suspenderCorrector = async (perfilId: string) => {
    if (!confirm("¿Suspender este corredor en GFI?")) return;
    await supabase.from("perfiles").update({ estado: "suspendido" }).eq("id", perfilId);
    cargarPerfilesVerificados();
  };

  const formatFecha = (iso: string) => new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const alertasFiltradas = alertas.filter(a =>
    !busqueda || JSON.stringify(a).toLowerCase().includes(busqueda.toLowerCase())
  );

  const perfilesFiltrados = perfiles.filter(p =>
    !busqueda ||
    `${p.apellido} ${p.nombre} ${p.matricula}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const padronFiltrado = padron.filter(r =>
    !busqueda ||
    `${r.apellido} ${r.nombre} ${r.matricula} ${r.localidad}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .pad-root { min-height: 100vh; display: flex; flex-direction: column; }
        .pad-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .pad-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .pad-topbar-logo span { color: #cc0000; }
        .pad-btn-back { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .pad-btn-back:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
        .pad-content { flex: 1; padding: 32px; max-width: 1100px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        .pad-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .pad-header h1 span { color: #cc0000; }
        .pad-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .pad-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
        .pad-stat { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; }
        .pad-stat-val { font-family: 'Montserrat', sans-serif; font-size: 24px; font-weight: 800; line-height: 1; }
        .pad-stat-val.rojo { color: #ff4444; }
        .pad-stat-val.verde { color: #22c55e; }
        .pad-stat-val.amarillo { color: #eab308; }
        .pad-stat-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 5px; font-family: 'Montserrat', sans-serif; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
        .pad-ultima { font-size: 11px; color: rgba(255,255,255,0.25); }
        .pad-barra { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .pad-tabs { display: flex; gap: 10px; }
        .pad-tab { padding: 9px 20px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; position: relative; }
        .pad-tab.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .pad-tab-badge { position: absolute; top: -6px; right: -6px; background: #cc0000; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 10px; min-width: 16px; text-align: center; }
        .pad-busqueda { padding: 9px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; width: 260px; }
        .pad-busqueda:focus { border-color: rgba(200,0,0,0.5); }
        .pad-busqueda::placeholder { color: rgba(255,255,255,0.2); }
        .pad-btn-marcar { padding: 8px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .pad-btn-marcar:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .pad-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .pad-tabla { width: 100%; border-collapse: collapse; }
        .pad-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .pad-tabla th { padding: 11px 14px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .pad-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .pad-tabla tbody tr:last-child { border-bottom: none; }
        .pad-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .pad-tabla tbody tr.alerta-row { background: rgba(200,0,0,0.05); }
        .pad-tabla td { padding: 11px 14px; font-size: 13px; vertical-align: middle; }
        .pad-nombre { font-weight: 600; color: #fff; }
        .pad-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .pad-estado-badge { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; }
        .pad-btn-accion { padding: 5px 12px; border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .pad-btn-leer { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.4); }
        .pad-btn-leer:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .pad-btn-suspender { background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.3); color: #cc0000; }
        .pad-btn-suspender:hover { background: rgba(200,0,0,0.2); color: #fff; }
        .pad-alerta-detalle { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.5; }
        .pad-alerta-detalle.no-leida { color: rgba(255,255,255,0.8); }
        .pad-empty { padding: 64px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; font-style: italic; }
        .pad-nota { font-size: 11px; color: rgba(255,255,255,0.25); text-align: center; padding: 10px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; }
        @media (max-width: 900px) { .pad-stats { grid-template-columns: repeat(2,1fr); } .pad-content { padding: 16px; } }
      `}</style>

      <div className="pad-root">
        <header className="pad-topbar">
          <div className="pad-topbar-logo"><span>GFI</span>® · Padrón COCIR</div>
          <a className="pad-btn-back" href="/admin">← Panel Admin</a>
        </header>

        <main className="pad-content">
          <div className="pad-header">
            <h1>Padrón <span>COCIR</span></h1>
            <p>Verificación automática de matriculados habilitados</p>
          </div>

          {/* STATS */}
          <div className="pad-stats">
            <div className="pad-stat">
              <div className="pad-stat-val rojo">{stats.alertas}</div>
              <div className="pad-stat-label">Alertas activas</div>
            </div>
            <div className="pad-stat">
              <div className="pad-stat-val verde">{perfiles.filter(p => !p.es_alerta).length}</div>
              <div className="pad-stat-label">Habilitados OK</div>
            </div>
            <div className="pad-stat">
              <div className="pad-stat-val amarillo">{perfiles.filter(p => p.es_alerta).length}</div>
              <div className="pad-stat-label">Con irregularidades</div>
            </div>
            <div className="pad-stat">
              <div className="pad-stat-val">{stats.totalPadron.toLocaleString("es-AR")}</div>
              <div className="pad-stat-label">Registros en padrón</div>
              {ultimaActualizacion && (
                <div className="pad-ultima">Act: {formatFecha(ultimaActualizacion)}</div>
              )}
            </div>
          </div>

          <div className="pad-barra">
            <div className="pad-tabs">
              <button className={`pad-tab${vista === "alertas" ? " activo" : ""}`} onClick={() => setVista("alertas")}>
                🔔 Alertas
                {alertas.filter(a => !a.leida).length > 0 &&
                  <span className="pad-tab-badge">{alertas.filter(a => !a.leida).length}</span>}
              </button>
              <button className={`pad-tab${vista === "verificados" ? " activo" : ""}`} onClick={() => setVista("verificados")}>
                👥 Corredores GFI
              </button>
              <button className={`pad-tab${vista === "padron" ? " activo" : ""}`}
                onClick={() => { setVista("padron"); if (!padron.length) cargarPadron(); }}>
                📋 Padrón completo
              </button>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <input className="pad-busqueda" placeholder="Buscar..." value={busqueda}
                onChange={e => setBusqueda(e.target.value)} />
              {vista === "alertas" && alertas.some(a => !a.leida) && (
                <button className="pad-btn-marcar" onClick={marcarTodasLeidas}>
                  Marcar todas leídas
                </button>
              )}
            </div>
          </div>

          {/* ALERTAS */}
          {vista === "alertas" && (
            <>
              {loading ? <div className="pad-empty">Cargando...</div> :
               alertasFiltradas.length === 0 ? (
                <div className="pad-empty">
                  {busqueda ? "Sin resultados para la búsqueda" : "✅ No hay alertas pendientes"}
                </div>
               ) : (
                <div className="pad-tabla-wrap">
                  <table className="pad-tabla">
                    <thead>
                      <tr>
                        <th>Corredor</th>
                        <th>Tipo de alerta</th>
                        <th>Estado padrón</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertasFiltradas.map(a => (
                        <tr key={a.id} className={!a.leida ? "alerta-row" : ""}>
                          <td>
                            <div className="pad-nombre">
                              {a.perfiles ? `${a.perfiles.apellido}, ${a.perfiles.nombre}` : "—"}
                              {!a.leida && <span style={{marginLeft:6,fontSize:9,background:"rgba(200,0,0,0.2)",border:"1px solid rgba(200,0,0,0.4)",color:"#cc0000",padding:"1px 6px",borderRadius:10,fontFamily:"Montserrat",fontWeight:700}}>NUEVA</span>}
                            </div>
                            <div className="pad-sub">Mat. {a.perfiles?.matricula ?? "—"} · {a.perfiles?.email ?? "—"}</div>
                          </td>
                          <td>
                            <div className={`pad-alerta-detalle${!a.leida ? " no-leida" : ""}`}>{a.detalle}</div>
                          </td>
                          <td>
                            {a.estado_padron && (
                              <span className="pad-estado-badge" style={{
                                background:`${estadoPadronColor(a.estado_padron)}20`,
                                border:`1px solid ${estadoPadronColor(a.estado_padron)}50`,
                                color:estadoPadronColor(a.estado_padron)
                              }}>
                                {a.estado_padron.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{formatFecha(a.created_at)}</td>
                          <td>
                            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                              {!a.leida && (
                                <button className="pad-btn-accion pad-btn-leer"
                                  onClick={() => marcarAlertaLeida(a.id)}>Marcar leída</button>
                              )}
                              {a.perfil_id && (
                                <button className="pad-btn-accion pad-btn-suspender"
                                  onClick={() => suspenderCorrector(a.perfil_id)}>
                                  Suspender en GFI
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
               )}
              <div className="pad-nota">
                Las alertas se generan automáticamente al ejecutar <code>python cocir_sync.py</code> — o al sincronizar desde el servidor.
                Configurar el script para correr diariamente via tarea programada de Windows.
              </div>
            </>
          )}

          {/* CORREDORES GFI VERIFICADOS */}
          {vista === "verificados" && (
            loading ? <div className="pad-empty">Cargando...</div> :
            perfilesFiltrados.length === 0 ? <div className="pad-empty">No hay corredores aprobados en GFI.</div> :
            <div className="pad-tabla-wrap">
              <table className="pad-tabla">
                <thead>
                  <tr>
                    <th>Corredor GFI</th>
                    <th>Matrícula</th>
                    <th>Estado en padrón COCIR</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {perfilesFiltrados.map(p => {
                    const color = estadoPadronColor(p.en_padron ? p.estado_padron : null);
                    const emoji = estadoPadronEmoji(p.estado_padron, p.en_padron ?? false);
                    return (
                      <tr key={p.id} className={p.es_alerta ? "alerta-row" : ""}>
                        <td>
                          <div className="pad-nombre">{p.apellido}, {p.nombre}</div>
                          <div className="pad-sub">{p.email}</div>
                        </td>
                        <td style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:14}}>
                          {p.matricula ?? "—"}
                        </td>
                        <td>
                          <span className="pad-estado-badge" style={{
                            background:`${color}20`,border:`1px solid ${color}50`,color
                          }}>
                            {emoji} {p.en_padron
                              ? (p.estado_padron?.toUpperCase() || "HABILITADO")
                              : "NO EN PADRÓN"}
                          </span>
                        </td>
                        <td>
                          {p.es_alerta && (
                            <button className="pad-btn-accion pad-btn-suspender"
                              onClick={() => suspenderCorrector(p.id)}>
                              Suspender en GFI
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PADRÓN COMPLETO */}
          {vista === "padron" && (
            loading ? <div className="pad-empty">Cargando padrón...</div> :
            padronFiltrado.length === 0 ? (
              <div className="pad-empty">
                {stats.totalPadron === 0
                  ? "El padrón está vacío. Ejecutá python cocir_sync.py para sincronizar."
                  : "Sin resultados para la búsqueda."}
              </div>
            ) : (
              <>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>
                  Mostrando {padronFiltrado.length} de {stats.totalPadron} registros
                </div>
                <div className="pad-tabla-wrap">
                  <table className="pad-tabla">
                    <thead>
                      <tr>
                        <th>Apellido y Nombre</th>
                        <th>Matrícula</th>
                        <th>Inmobiliaria</th>
                        <th>Localidad</th>
                        <th>Teléfono</th>
                        <th>Estado</th>
                        <th>Actualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {padronFiltrado.map(r => {
                        const color = estadoPadronColor(r.estado);
                        return (
                          <tr key={r.id}>
                            <td>
                              <div className="pad-nombre">{r.apellido}, {r.nombre}</div>
                              {r.email && <div className="pad-sub">{r.email}</div>}
                            </td>
                            <td style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700}}>{r.matricula ?? "—"}</td>
                            <td style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{r.inmobiliaria ?? "—"}</td>
                            <td style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{r.localidad ?? "—"}</td>
                            <td style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{r.telefono ?? "—"}</td>
                            <td>
                              <span className="pad-estado-badge" style={{
                                background:`${color}20`,border:`1px solid ${color}50`,color,fontSize:9
                              }}>
                                {r.estado?.toUpperCase() || "—"}
                              </span>
                            </td>
                            <td style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>
                              {r.actualizado_at ? new Date(r.actualizado_at).toLocaleDateString("es-AR") : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </main>
      </div>
    </>
  );
}
