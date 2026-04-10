"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  lugar: string | null;
  link_externo: string | null;
  tipo: string;
  gratuito: boolean;
  precio_entrada: number | null;
  capacidad: number | null;
  organizador_id: string | null;
  inscripto?: boolean;
  total_inscriptos?: number;
}

const TIPO_BADGE: Record<string, { label: string; color: string }> = {
  gfi: { label: "GFI®", color: "badge-gfi" },
  ci: { label: "Corredor", color: "badge-ci" },
  externo: { label: "Externo", color: "badge-externo" },
};

export default function EventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "proximos" | "inscripto">("proximos");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      setUserId(data.user.id);
      await cargarEventos(data.user.id);
    };
    init();
  }, []);

  const cargarEventos = async (uid: string) => {
    setLoading(true);

    const { data: eventosData } = await supabase
      .from("eventos")
      .select("*")
      .eq("estado", "publicado")
      .order("fecha", { ascending: true });

    if (!eventosData) { setLoading(false); return; }

    const { data: inscripcionesData } = await supabase
      .from("inscripciones_eventos")
      .select("evento_id")
      .eq("perfil_id", uid);

    const inscriptos = new Set(inscripcionesData?.map(i => i.evento_id) ?? []);

    const eventosConDatos = await Promise.all(
      eventosData.map(async (ev) => {
        const { count } = await supabase
          .from("inscripciones_eventos")
          .select("*", { count: "exact", head: true })
          .eq("evento_id", ev.id);
        return { ...ev, inscripto: inscriptos.has(ev.id), total_inscriptos: count ?? 0 };
      })
    );

    setEventos(eventosConDatos);
    setLoading(false);
  };

  const toggleInscripcion = async (eventoId: string, yaInscripto: boolean) => {
    if (!userId) return;
    setProcesando(eventoId);

    if (yaInscripto) {
      await supabase.from("inscripciones_eventos")
        .delete().eq("evento_id", eventoId).eq("perfil_id", userId);
    } else {
      await supabase.from("inscripciones_eventos")
        .insert({ evento_id: eventoId, perfil_id: userId });
    }

    await cargarEventos(userId);
    setProcesando(null);
  };

  const formatFecha = (iso: string) => {
    const d = new Date(iso);
    return {
      dia: d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }),
      hora: d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      mes: d.toLocaleDateString("es-AR", { month: "short" }).toUpperCase(),
      num: d.getDate(),
    };
  };

  const esProximo = (iso: string) => new Date(iso) >= new Date();

  const eventosFiltrados = eventos.filter(ev => {
    if (filtro === "proximos") return esProximo(ev.fecha);
    if (filtro === "inscripto") return ev.inscripto;
    return true;
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }

        .ev-root { min-height: 100vh; display: flex; flex-direction: column; }

        .ev-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; height: 60px;
          background: rgba(14,14,14,0.98);
          border-bottom: 1px solid rgba(180,0,0,0.2);
          position: sticky; top: 0; z-index: 100;
        }
        .ev-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .ev-topbar-logo span { color: #cc0000; }
        .ev-btn-volver {
          padding: 7px 16px; background: transparent;
          border: 1px solid rgba(255,255,255,0.12); border-radius: 3px;
          color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; cursor: pointer; text-decoration: none;
          transition: all 0.2s;
        }
        .ev-btn-volver:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

        .ev-content { flex: 1; padding: 32px; max-width: 900px; width: 100%; margin: 0 auto; }

        .ev-header {
          display: flex; align-items: flex-end; justify-content: space-between;
          flex-wrap: wrap; gap: 16px; margin-bottom: 28px;
        }
        .ev-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .ev-header h1 span { color: #cc0000; }
        .ev-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }

        .ev-proponer-btn {
          padding: 10px 20px;
          background: rgba(200,0,0,0.1);
          border: 1px solid rgba(200,0,0,0.35);
          border-radius: 3px; color: #cc0000;
          font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; cursor: pointer;
          text-decoration: none; transition: all 0.2s;
        }
        .ev-proponer-btn:hover { background: rgba(200,0,0,0.2); color: #fff; }

        .ev-filtros { display: flex; gap: 10px; margin-bottom: 24px; }
        .ev-filtro {
          padding: 7px 16px;
          background: rgba(14,14,14,0.9);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 3px; cursor: pointer;
          font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: rgba(255,255,255,0.4);
          transition: all 0.2s;
        }
        .ev-filtro:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .ev-filtro.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }

        .ev-lista { display: flex; flex-direction: column; gap: 16px; }

        .ev-card {
          background: rgba(14,14,14,0.9);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px; overflow: hidden;
          display: grid; grid-template-columns: 80px 1fr auto;
          transition: border-color 0.2s;
          animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
        .ev-card:hover { border-color: rgba(200,0,0,0.25); }

        .ev-fecha-col {
          background: rgba(200,0,0,0.08);
          border-right: 1px solid rgba(200,0,0,0.15);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 16px 8px; gap: 2px;
        }
        .ev-fecha-num { font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800; color: #cc0000; line-height: 1; }
        .ev-fecha-mes { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); }

        .ev-info { padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
        .ev-info-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ev-titulo { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 700; color: #fff; }
        .ev-meta { display: flex; gap: 16px; flex-wrap: wrap; }
        .ev-meta-item { font-size: 12px; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 4px; }
        .ev-desc { font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.5; }

        .ev-acciones {
          padding: 16px; display: flex; flex-direction: column;
          align-items: flex-end; justify-content: center; gap: 10px; min-width: 140px;
        }
        .ev-inscribirse {
          padding: 8px 16px; background: #cc0000;
          border: none; border-radius: 3px; color: #fff;
          font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s;
          white-space: nowrap;
        }
        .ev-inscribirse:hover { background: #e60000; }
        .ev-inscribirse.inscripto {
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.3);
          color: #22c55e;
        }
        .ev-inscribirse.inscripto:hover { background: rgba(34,197,94,0.2); }
        .ev-inscriptos { font-size: 11px; color: rgba(255,255,255,0.3); text-align: right; }

        .badge { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; }
        .badge-gfi { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.3); color: #cc0000; }
        .badge-ci { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; }
        .badge-externo { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.5); }
        .badge-gratuito { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); color: #22c55e; }
        .badge-pago { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.25); color: #eab308; }

        .ev-spinner {
          display: inline-block; width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ev-empty { padding: 64px 32px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; font-style: italic; }
        .ev-loading { padding: 64px 32px; text-align: center; color: rgba(255,255,255,0.25); font-size: 13px; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 600px) {
          .ev-card { grid-template-columns: 60px 1fr; }
          .ev-acciones { grid-column: 1 / -1; flex-direction: row; justify-content: space-between; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); }
          .ev-content { padding: 16px; }
        }
      `}</style>

      <div className="ev-root">
        <header className="ev-topbar">
          <div className="ev-topbar-logo"><span>GFI</span>® · Eventos</div>
          <a className="ev-btn-volver" href="/dashboard">← Dashboard</a>
        </header>

        <main className="ev-content">
          <div className="ev-header">
            <div>
              <h1>Próximos <span>eventos</span></h1>
              <p>Eventos del Grupo Foro Inmobiliario, COCIR y la comunidad.</p>
            </div>
            <a className="ev-proponer-btn" href="/eventos/proponer">+ Proponer evento</a>
          </div>

          <div className="ev-filtros">
            {([["proximos","Próximos"],["inscripto","Mis inscripciones"],["todos","Todos"]] as const).map(([f, l]) => (
              <button key={f} className={`ev-filtro${filtro === f ? " activo" : ""}`} onClick={() => setFiltro(f)}>{l}</button>
            ))}
          </div>

          {loading ? (
            <div className="ev-loading">Cargando eventos...</div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="ev-empty">No hay eventos en esta categoría.</div>
          ) : (
            <div className="ev-lista">
              {eventosFiltrados.map((ev, i) => {
                const fecha = formatFecha(ev.fecha);
                const pasado = !esProximo(ev.fecha);
                return (
                  <div key={ev.id} className="ev-card" style={{
                    animationDelay: `${i * 0.05}s`,
                    opacity: pasado ? 0.5 : 1,
                  }}>
                    <div className="ev-fecha-col">
                      <div className="ev-fecha-num">{fecha.num}</div>
                      <div className="ev-fecha-mes">{fecha.mes}</div>
                    </div>
                    <div className="ev-info">
                      <div className="ev-info-top">
                        <span className="ev-titulo">{ev.titulo}</span>
                        <span className={`badge ${TIPO_BADGE[ev.tipo].color}`}>{TIPO_BADGE[ev.tipo].label}</span>
                        <span className={`badge ${ev.gratuito ? "badge-gratuito" : "badge-pago"}`}>
                          {ev.gratuito ? "Gratuito" : `$${ev.precio_entrada?.toLocaleString("es-AR")}`}
                        </span>
                      </div>
                      <div className="ev-meta">
                        <span className="ev-meta-item">🕐 {fecha.dia} · {fecha.hora}hs</span>
                        {ev.lugar && <span className="ev-meta-item">📍 {ev.lugar}</span>}
                      </div>
                      {ev.descripcion && <div className="ev-desc">{ev.descripcion}</div>}
                    </div>
                    <div className="ev-acciones">
                      {procesando === ev.id ? (
                        <span className="ev-spinner" />
                      ) : (
                        <button
                          className={`ev-inscribirse${ev.inscripto ? " inscripto" : ""}`}
                          onClick={() => toggleInscripcion(ev.id, !!ev.inscripto)}
                          disabled={pasado}
                        >
                          {ev.inscripto ? "✓ Inscripto" : "Inscribirse"}
                        </button>
                      )}
                      <div className="ev-inscriptos">{ev.total_inscriptos} inscriptos</div>
                      {ev.link_externo && (
                        <a href={ev.link_externo} target="_blank" rel="noopener noreferrer"
                          style={{fontSize:11, color:"rgba(200,0,0,0.7)", textDecoration:"none"}}>
                          Ver más →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
