"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Evento {
  id: string;
  titulo: string;
  fecha: string;
  estado: string;
}

interface Inscripto {
  id: string;
  perfil_id: string;
  asistio: boolean | null;
  perfiles: {
    nombre: string;
    apellido: string;
    matricula: string | null;
    inmobiliaria: string | null;
  };
}

interface RankingItem {
  perfil_id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  total: number;
  ranking: number;
  descuento: number;
}

export default function AsistenciaPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<string | null>(null);
  const [inscriptos, setInscriptos] = useState<Inscripto[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [vista, setVista] = useState<"asistencia" | "ranking">("asistencia");
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [guardandoRanking, setGuardandoRanking] = useState(false);
  const [periodoRanking, setPeriodoRanking] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    const verificar = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (!perfil || perfil.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      cargarEventos();
      cargarRanking();
    };
    verificar();
  }, []);

  const cargarEventos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("eventos")
      .select("id, titulo, fecha, estado")
      .in("estado", ["publicado", "borrador"])
      .order("fecha", { ascending: false });
    setEventos(data ?? []);
    setLoading(false);
  };

  const cargarInscriptos = async (eventoId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("inscripciones_eventos")
      .select("id, perfil_id, asistio, perfiles(nombre, apellido, matricula, inmobiliaria)")
      .eq("evento_id", eventoId);
    setInscriptos((data as unknown as Inscripto[]) ?? []);
    setLoading(false);
  };

  const cargarRanking = async () => {
    const { data: inscData } = await supabase
      .from("inscripciones_eventos")
      .select("perfil_id, asistio, perfiles(nombre, apellido, matricula)")
      .eq("asistio", true);

    if (!inscData) return;

    const conteo: Record<string, { nombre: string; apellido: string; matricula: string | null; total: number }> = {};
    (inscData as unknown as { perfil_id: string; asistio: boolean; perfiles: { nombre: string; apellido: string; matricula: string | null } }[]).forEach(item => {
      if (!conteo[item.perfil_id]) {
        conteo[item.perfil_id] = {
          nombre: item.perfiles.nombre,
          apellido: item.perfiles.apellido,
          matricula: item.perfiles.matricula,
          total: 0,
        };
      }
      conteo[item.perfil_id].total++;
    });

    const sorted = Object.entries(conteo)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([perfil_id, data], index) => ({
        perfil_id,
        ...data,
        ranking: index + 1,
        descuento: index < 3 ? 5 : 0,
      }));

    setRanking(sorted);
  };

  const seleccionarEvento = (id: string) => {
    setEventoSeleccionado(id);
    cargarInscriptos(id);
  };

  const marcarAsistencia = async (inscripcionId: string, asistio: boolean) => {
    setProcesando(inscripcionId);
    await supabase.from("inscripciones_eventos").update({ asistio }).eq("id", inscripcionId);
    if (eventoSeleccionado) await cargarInscriptos(eventoSeleccionado);
    await cargarRanking();
    setProcesando(null);
  };

  const guardarDescuentos = async () => {
    setGuardandoRanking(true);
    const top3 = ranking.slice(0, 3);
    for (const item of top3) {
      await supabase.from("descuentos_asistencia").upsert({
        perfil_id: item.perfil_id,
        periodo: periodoRanking,
        total_asistencias: item.total,
        ranking: item.ranking,
        porcentaje_descuento: 5,
        aplicado: false,
      }, { onConflict: "perfil_id,periodo" });
    }
    setGuardandoRanking(false);
    alert("Descuentos guardados correctamente.");
  };

  const eventoActual = eventos.find(e => e.id === eventoSeleccionado);
  const totalPresentes = inscriptos.filter(i => i.asistio === true).length;
  const totalAusentes = inscriptos.filter(i => i.asistio === false).length;
  const totalSinRegistrar = inscriptos.filter(i => i.asistio === null).length;

  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const imprimirLista = () => window.print();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }

        .as-root { min-height: 100vh; display: flex; flex-direction: column; }
        .as-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; height: 60px;
          background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2);
          position: sticky; top: 0; z-index: 100;
        }
        .as-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .as-topbar-logo span { color: #cc0000; }
        .as-topbar-right { display: flex; gap: 12px; align-items: center; }
        .as-btn-back {
          padding: 7px 16px; background: transparent;
          border: 1px solid rgba(255,255,255,0.12); border-radius: 3px;
          color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s;
        }
        .as-btn-back:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

        .as-content { flex: 1; padding: 32px; max-width: 1100px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }

        .as-header { }
        .as-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .as-header h1 span { color: #cc0000; }
        .as-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }

        .as-tabs { display: flex; gap: 10px; }
        .as-tab {
          padding: 8px 20px; background: rgba(14,14,14,0.9);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 3px;
          font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4);
          cursor: pointer; transition: all 0.2s;
        }
        .as-tab:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .as-tab.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }

        .as-layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; }

        /* LISTA EVENTOS */
        .as-eventos-lista {
          background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px; overflow: hidden;
        }
        .as-eventos-titulo {
          padding: 14px 16px; font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.16em;
          text-transform: uppercase; color: rgba(255,255,255,0.3);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .as-evento-item {
          padding: 14px 16px; cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background 0.15s;
        }
        .as-evento-item:last-child { border-bottom: none; }
        .as-evento-item:hover { background: rgba(255,255,255,0.03); }
        .as-evento-item.activo { background: rgba(200,0,0,0.08); border-left: 2px solid #cc0000; }
        .as-evento-nombre { font-size: 13px; font-weight: 500; color: #fff; line-height: 1.3; }
        .as-evento-fecha { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 3px; }

        /* PANEL ASISTENCIA */
        .as-panel {
          background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px; overflow: hidden;
        }
        .as-panel-header {
          padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
        }
        .as-panel-titulo { font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 800; }
        .as-panel-titulo span { color: #cc0000; }
        .as-stats { display: flex; gap: 16px; }
        .as-stat { font-size: 12px; }
        .as-stat-num { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 16px; }
        .as-stat.presente .as-stat-num { color: #22c55e; }
        .as-stat.ausente .as-stat-num { color: #ff4444; }
        .as-stat.pendiente .as-stat-num { color: rgba(255,255,255,0.4); }
        .as-stat-label { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px; }

        .as-panel-acciones { padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; gap: 10px; }
        .as-btn-imprimir {
          padding: 7px 16px; background: transparent;
          border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
          color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s;
        }
        .as-btn-imprimir:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

        .as-tabla { width: 100%; border-collapse: collapse; }
        .as-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .as-tabla th { padding: 10px 16px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .as-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .as-tabla tbody tr:last-child { border-bottom: none; }
        .as-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .as-tabla td { padding: 12px 16px; font-size: 13px; vertical-align: middle; }
        .as-nombre { font-weight: 500; color: #fff; }
        .as-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }

        .as-asistencia-btns { display: flex; gap: 8px; }
        .as-btn-presente {
          padding: 5px 14px; background: transparent;
          border: 1px solid rgba(34,197,94,0.3); border-radius: 3px;
          color: rgba(34,197,94,0.6); font-family: 'Montserrat', sans-serif;
          font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s;
        }
        .as-btn-presente:hover, .as-btn-presente.activo { background: rgba(34,197,94,0.15); border-color: #22c55e; color: #22c55e; }
        .as-btn-ausente {
          padding: 5px 14px; background: transparent;
          border: 1px solid rgba(200,0,0,0.3); border-radius: 3px;
          color: rgba(200,0,0,0.5); font-family: 'Montserrat', sans-serif;
          font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s;
        }
        .as-btn-ausente:hover, .as-btn-ausente.activo { background: rgba(200,0,0,0.12); border-color: #ff4444; color: #ff4444; }

        .as-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .as-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }
        .as-seleccionar { padding: 64px 32px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; }

        /* RANKING */
        .as-ranking-wrap { display: flex; flex-direction: column; gap: 20px; }
        .as-ranking-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .as-ranking-header h2 { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .as-ranking-header h2 span { color: #cc0000; }
        .as-periodo-input {
          padding: 8px 14px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 3px;
          color: #fff; font-size: 13px; outline: none;
        }
        .as-btn-guardar-ranking {
          padding: 8px 20px; background: #cc0000; border: none; border-radius: 3px;
          color: #fff; font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s;
        }
        .as-btn-guardar-ranking:hover { background: #e60000; }
        .as-btn-guardar-ranking:disabled { opacity: 0.6; cursor: not-allowed; }

        .as-ranking-cards { display: flex; flex-direction: column; gap: 12px; }
        .as-ranking-card {
          background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px; padding: 16px 20px;
          display: flex; align-items: center; gap: 20px;
          transition: border-color 0.2s;
        }
        .as-ranking-card.top1 { border-color: rgba(234,179,8,0.4); background: rgba(234,179,8,0.05); }
        .as-ranking-card.top2 { border-color: rgba(148,163,184,0.3); background: rgba(148,163,184,0.03); }
        .as-ranking-card.top3 { border-color: rgba(180,83,9,0.3); background: rgba(180,83,9,0.04); }

        .as-ranking-pos {
          font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800;
          min-width: 48px; text-align: center; line-height: 1;
        }
        .as-ranking-card.top1 .as-ranking-pos { color: #eab308; }
        .as-ranking-card.top2 .as-ranking-pos { color: #94a3b8; }
        .as-ranking-card.top3 .as-ranking-pos { color: #b45309; }
        .as-ranking-pos-other { color: rgba(255,255,255,0.3); }

        .as-ranking-info { flex: 1; }
        .as-ranking-nombre { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 700; color: #fff; }
        .as-ranking-mat { font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 2px; }

        .as-ranking-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .as-ranking-total { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; color: #fff; }
        .as-ranking-total-label { font-size: 10px; color: rgba(255,255,255,0.3); }
        .as-ranking-descuento {
          font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700;
          color: #22c55e; background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.25); border-radius: 20px;
          padding: 3px 10px;
        }

        @media print {
          .as-topbar, .as-tabs, .as-eventos-lista, .as-panel-acciones, .as-asistencia-btns { display: none !important; }
          .as-layout { grid-template-columns: 1fr; }
          .as-panel { border: none; }
          body { background: #fff; color: #000; }
          .as-tabla td, .as-tabla th { color: #000; }
        }
      `}</style>

      <div className="as-root">
        <header className="as-topbar">
          <div className="as-topbar-logo"><span>GFI</span>® · Asistencia</div>
          <div className="as-topbar-right">
            <a className="as-btn-back" href="/admin/eventos">← Eventos</a>
            <a className="as-btn-back" href="/admin">Panel Admin</a>
          </div>
        </header>

        <main className="as-content">
          <div className="as-header">
            <h1>Asistencia y <span>ranking</span></h1>
            <p>Registrá la asistencia a cada evento y calculá los descuentos del top 3.</p>
          </div>

          <div className="as-tabs">
            <button className={`as-tab${vista === "asistencia" ? " activo" : ""}`} onClick={() => setVista("asistencia")}>📋 Asistencia por evento</button>
            <button className={`as-tab${vista === "ranking" ? " activo" : ""}`} onClick={() => setVista("ranking")}>🏆 Ranking general</button>
          </div>

          {vista === "asistencia" && (
            <div className="as-layout">
              {/* LISTA EVENTOS */}
              <div className="as-eventos-lista">
                <div className="as-eventos-titulo">Eventos</div>
                {eventos.length === 0 ? (
                  <div style={{padding:"24px 16px", color:"rgba(255,255,255,0.2)", fontSize:13, fontStyle:"italic"}}>Sin eventos</div>
                ) : eventos.map(ev => (
                  <div
                    key={ev.id}
                    className={`as-evento-item${eventoSeleccionado === ev.id ? " activo" : ""}`}
                    onClick={() => seleccionarEvento(ev.id)}
                  >
                    <div className="as-evento-nombre">{ev.titulo}</div>
                    <div className="as-evento-fecha">{formatFecha(ev.fecha)}</div>
                  </div>
                ))}
              </div>

              {/* PANEL ASISTENCIA */}
              <div className="as-panel">
                {!eventoSeleccionado ? (
                  <div className="as-seleccionar">← Seleccioná un evento para registrar asistencia</div>
                ) : (
                  <>
                    <div className="as-panel-header">
                      <div>
                        <div className="as-panel-titulo">{eventoActual?.titulo}</div>
                        <div style={{fontSize:12, color:"rgba(255,255,255,0.3)", marginTop:4}}>{eventoActual && formatFecha(eventoActual.fecha)}</div>
                      </div>
                      <div className="as-stats">
                        <div className="as-stat presente">
                          <div className="as-stat-num">{totalPresentes}</div>
                          <div className="as-stat-label">Presentes</div>
                        </div>
                        <div className="as-stat ausente">
                          <div className="as-stat-num">{totalAusentes}</div>
                          <div className="as-stat-label">Ausentes</div>
                        </div>
                        <div className="as-stat pendiente">
                          <div className="as-stat-num">{totalSinRegistrar}</div>
                          <div className="as-stat-label">Sin registrar</div>
                        </div>
                      </div>
                    </div>

                    <div className="as-panel-acciones">
                      <button className="as-btn-imprimir" onClick={imprimirLista}>🖨️ Imprimir lista</button>
                    </div>

                    {loading ? (
                      <div className="as-empty">Cargando inscriptos...</div>
                    ) : inscriptos.length === 0 ? (
                      <div className="as-empty">No hay inscriptos en este evento.</div>
                    ) : (
                      <table className="as-tabla">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Nombre</th>
                            <th>Matrícula</th>
                            <th>Asistencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inscriptos.map((insc, i) => (
                            <tr key={insc.id}>
                              <td style={{color:"rgba(255,255,255,0.3)", fontSize:12}}>{i + 1}</td>
                              <td>
                                <div className="as-nombre">{insc.perfiles.apellido}, {insc.perfiles.nombre}</div>
                                {insc.perfiles.inmobiliaria && <div className="as-sub">{insc.perfiles.inmobiliaria}</div>}
                              </td>
                              <td style={{fontSize:12, color:"rgba(255,255,255,0.4)"}}>{insc.perfiles.matricula ?? "—"}</td>
                              <td>
                                {procesando === insc.id ? (
                                  <span className="as-spinner" />
                                ) : (
                                  <div className="as-asistencia-btns">
                                    <button
                                      className={`as-btn-presente${insc.asistio === true ? " activo" : ""}`}
                                      onClick={() => marcarAsistencia(insc.id, true)}
                                    >✓ Presente</button>
                                    <button
                                      className={`as-btn-ausente${insc.asistio === false ? " activo" : ""}`}
                                      onClick={() => marcarAsistencia(insc.id, false)}
                                    >✗ Ausente</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {vista === "ranking" && (
            <div className="as-ranking-wrap">
              <div className="as-ranking-header">
                <div>
                  <h2>Ranking de <span>asistencia</span></h2>
                  <p style={{fontSize:13, color:"rgba(255,255,255,0.35)", marginTop:4}}>Top 3 reciben 5% de descuento en el abono mensual.</p>
                </div>
                <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
                  <input
                    className="as-periodo-input"
                    type="month"
                    value={periodoRanking}
                    onChange={e => setPeriodoRanking(e.target.value)}
                  />
                  <button className="as-btn-guardar-ranking" onClick={guardarDescuentos} disabled={guardandoRanking || ranking.length === 0}>
                    {guardandoRanking ? "Guardando..." : "Aplicar descuentos top 3"}
                  </button>
                </div>
              </div>

              {ranking.length === 0 ? (
                <div style={{padding:"48px", textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:13, fontStyle:"italic"}}>
                  No hay asistencias registradas todavía.
                </div>
              ) : (
                <div className="as-ranking-cards">
                  {ranking.map((item, i) => (
                    <div key={item.perfil_id} className={`as-ranking-card${i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : ""}`}>
                      <div className={`as-ranking-pos${i >= 3 ? " as-ranking-pos-other" : ""}`}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </div>
                      <div className="as-ranking-info">
                        <div className="as-ranking-nombre">{item.apellido}, {item.nombre}</div>
                        {item.matricula && <div className="as-ranking-mat">Mat. {item.matricula}</div>}
                      </div>
                      <div className="as-ranking-stats">
                        <div className="as-ranking-total">{item.total}</div>
                        <div className="as-ranking-total-label">asistencias</div>
                        {i < 3 && <div className="as-ranking-descuento">5% descuento</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
