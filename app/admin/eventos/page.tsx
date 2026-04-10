"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  lugar: string | null;
  link_externo: string | null;
  tipo: string;
  estado: string;
  gratuito: boolean;
  precio_entrada: number | null;
  capacidad: number | null;
  imagen_url: string | null;
  video_url: string | null;
  costo_publicacion: number | null;
  pago_confirmado: boolean;
  created_at: string;
}

const ESTADO_BADGE: Record<string, string> = {
  borrador: "badge-borrador",
  solicitado: "badge-solicitado",
  aprobado: "badge-aprobado",
  pago_pendiente: "badge-pago",
  publicado: "badge-publicado",
  rechazado: "badge-rechazado",
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  solicitado: "Solicitado",
  aprobado: "Aprobado",
  pago_pendiente: "Pago pendiente",
  publicado: "Publicado",
  rechazado: "Rechazado",
};

const FORM_VACIO = {
  titulo: "",
  descripcion: "",
  fecha: "",
  lugar: "",
  link_externo: "",
  tipo: "gfi",
  gratuito: true,
  precio_entrada: "",
  capacidad: "",
  imagen_url: "",
  video_url: "",
  costo_publicacion: "",
};

export default function AdminEventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>("todos");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [costoPendiente, setCostoPendiente] = useState<{ id: string; valor: string } | null>(null);

  useEffect(() => {
    const verificar = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (!perfil || perfil.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      cargarEventos();
    };
    verificar();
  }, []);

  const cargarEventos = async () => {
    setLoading(true);
    const { data } = await supabase.from("eventos").select("*").order("fecha", { ascending: true });
    setEventos(data ?? []);
    setLoading(false);
  };

  const handleForm = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const guardarEvento = async () => {
    if (!form.titulo || !form.fecha) return;
    setGuardando(true);

    const payload = {
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      fecha: new Date(form.fecha).toISOString(),
      lugar: form.lugar || null,
      link_externo: form.link_externo || null,
      tipo: form.tipo,
      gratuito: form.gratuito,
      precio_entrada: !form.gratuito && form.precio_entrada ? parseFloat(form.precio_entrada) : null,
      capacidad: form.capacidad ? parseInt(form.capacidad) : null,
      imagen_url: form.imagen_url || null,
      video_url: form.video_url || null,
      estado: "borrador",
    };

    if (editandoId) {
      await supabase.from("eventos").update(payload).eq("id", editandoId);
    } else {
      await supabase.from("eventos").insert(payload);
    }

    setGuardando(false);
    setMostrarForm(false);
    setForm(FORM_VACIO);
    setEditandoId(null);
    cargarEventos();
  };

  const cambiarEstado = async (id: string, estado: string) => {
    setProcesando(id);
    await supabase.from("eventos").update({ estado }).eq("id", id);
    await cargarEventos();
    setProcesando(null);
  };

  const confirmarPago = async (id: string) => {
    setProcesando(id);
    await supabase.from("eventos").update({ pago_confirmado: true, estado: "publicado" }).eq("id", id);
    await cargarEventos();
    setProcesando(null);
  };

  const guardarCosto = async (id: string) => {
    if (!costoPendiente) return;
    setProcesando(id);
    await supabase.from("eventos").update({
      costo_publicacion: parseFloat(costoPendiente.valor),
      estado: "pago_pendiente"
    }).eq("id", id);
    setCostoPendiente(null);
    await cargarEventos();
    setProcesando(null);
  };

  const editarEvento = (ev: Evento) => {
    setForm({
      titulo: ev.titulo,
      descripcion: ev.descripcion ?? "",
      fecha: ev.fecha ? new Date(ev.fecha).toISOString().slice(0, 16) : "",
      lugar: ev.lugar ?? "",
      link_externo: ev.link_externo ?? "",
      tipo: ev.tipo,
      gratuito: ev.gratuito,
      precio_entrada: ev.precio_entrada?.toString() ?? "",
      capacidad: ev.capacidad?.toString() ?? "",
      imagen_url: ev.imagen_url ?? "",
      video_url: ev.video_url ?? "",
      costo_publicacion: ev.costo_publicacion?.toString() ?? "",
    });
    setEditandoId(ev.id);
    setMostrarForm(true);
  };

  const eventosFiltrados = filtro === "todos" ? eventos : eventos.filter(e => e.estado === filtro);

  const contadores: Record<string, number> = { todos: eventos.length };
  eventos.forEach(e => { contadores[e.estado] = (contadores[e.estado] ?? 0) + 1; });

  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }

        .ae-root { min-height: 100vh; display: flex; flex-direction: column; }
        .ae-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; height: 60px;
          background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2);
          position: sticky; top: 0; z-index: 100;
        }
        .ae-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .ae-topbar-logo span { color: #cc0000; }
        .ae-topbar-right { display: flex; gap: 12px; align-items: center; }
        .ae-btn-back {
          padding: 7px 16px; background: transparent;
          border: 1px solid rgba(255,255,255,0.12); border-radius: 3px;
          color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s;
        }
        .ae-btn-back:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .ae-btn-nuevo {
          padding: 8px 18px; background: #cc0000; border: none; border-radius: 3px;
          color: #fff; font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s;
        }
        .ae-btn-nuevo:hover { background: #e60000; }

        .ae-content { flex: 1; padding: 32px; max-width: 1100px; width: 100%; margin: 0 auto; }
        .ae-header { margin-bottom: 24px; }
        .ae-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .ae-header h1 span { color: #cc0000; }
        .ae-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }

        /* FILTROS */
        .ae-filtros { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
        .ae-filtro {
          padding: 7px 14px; background: rgba(14,14,14,0.9);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 3px;
          font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4);
          cursor: pointer; transition: all 0.2s; display: flex; gap: 6px; align-items: center;
        }
        .ae-filtro:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .ae-filtro.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .ae-filtro-n { font-size: 10px; background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 10px; }

        /* TABLA */
        .ae-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .ae-tabla { width: 100%; border-collapse: collapse; }
        .ae-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .ae-tabla th { padding: 12px 16px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .ae-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .ae-tabla tbody tr:last-child { border-bottom: none; }
        .ae-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .ae-tabla td { padding: 14px 16px; font-size: 13px; color: rgba(255,255,255,0.8); vertical-align: middle; }
        .ae-titulo-cell { font-weight: 600; color: #fff; }
        .ae-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }

        .badge { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; white-space: nowrap; }
        .badge-borrador { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.4); }
        .badge-solicitado { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; }
        .badge-aprobado { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); color: #eab308; }
        .badge-pago { background: rgba(251,146,60,0.1); border: 1px solid rgba(251,146,60,0.3); color: #fb923c; }
        .badge-publicado { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
        .badge-rechazado { background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.3); color: #ff4444; }
        .badge-gfi { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.3); color: #cc0000; }
        .badge-ci { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; }
        .badge-externo { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.5); }

        .ae-acciones { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .ae-btn { padding: 5px 12px; border: 1px solid; border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; background: transparent; white-space: nowrap; }
        .ae-btn-pub { border-color: rgba(34,197,94,0.4); color: #22c55e; }
        .ae-btn-pub:hover { background: rgba(34,197,94,0.1); }
        .ae-btn-rech { border-color: rgba(200,0,0,0.4); color: #ff4444; }
        .ae-btn-rech:hover { background: rgba(200,0,0,0.1); }
        .ae-btn-edit { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); }
        .ae-btn-edit:hover { border-color: rgba(255,255,255,0.4); color: #fff; }
        .ae-btn-pago { border-color: rgba(34,197,94,0.4); color: #22c55e; }
        .ae-btn-pago:hover { background: rgba(34,197,94,0.1); }

        .ae-costo-input { padding: 4px 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: #fff; font-size: 12px; width: 80px; outline: none; }
        .ae-costo-input:focus { border-color: #cc0000; }

        .ae-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ae-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }

        /* MODAL FORM */
        .ae-modal-bg {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8);
          display: flex; align-items: center; justify-content: center;
          z-index: 200; padding: 24px;
        }
        .ae-modal {
          background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25);
          border-radius: 6px; padding: 36px; width: 100%; max-width: 560px;
          max-height: 90vh; overflow-y: auto;
          position: relative;
        }
        .ae-modal::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #cc0000, transparent);
          border-radius: 6px 6px 0 0;
        }
        .ae-modal h2 { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; margin-bottom: 24px; }
        .ae-modal h2 span { color: #cc0000; }
        .ae-form-field { margin-bottom: 14px; }
        .ae-form-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-family: 'Montserrat', sans-serif; }
        .ae-form-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter', sans-serif; }
        .ae-form-input:focus { border-color: rgba(200,0,0,0.5); }
        .ae-form-input::placeholder { color: rgba(255,255,255,0.2); }
        .ae-form-textarea { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; resize: vertical; min-height: 80px; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .ae-form-textarea:focus { border-color: rgba(200,0,0,0.5); }
        .ae-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ae-form-select { width: 100%; padding: 10px 14px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .ae-toggle { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
        .ae-toggle-btn { padding: 6px 14px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: 'Montserrat', sans-serif; }
        .ae-toggle-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .ae-form-actions { display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end; }
        .ae-btn-cancelar { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .ae-btn-cancelar:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .ae-btn-guardar { padding: 10px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .ae-btn-guardar:hover { background: #e60000; }
        .ae-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="ae-root">
        <header className="ae-topbar">
          <div className="ae-topbar-logo"><span>GFI</span>® · Eventos Admin</div>
          <div className="ae-topbar-right">
            <a className="ae-btn-back" href="/admin">← Panel Admin</a>
            <button className="ae-btn-nuevo" onClick={() => { setForm(FORM_VACIO); setEditandoId(null); setMostrarForm(true); }}>
              + Nuevo evento
            </button>
          </div>
        </header>

        <main className="ae-content">
          <div className="ae-header">
            <h1>Gestión de <span>eventos</span></h1>
            <p>Creá, aprobá y publicá eventos de GFI® y de la comunidad.</p>
          </div>

          <div className="ae-filtros">
            {[["todos","Todos"], ["borrador","Borrador"], ["solicitado","Solicitado"], ["aprobado","Aprobado"], ["pago_pendiente","Pago pendiente"], ["publicado","Publicado"], ["rechazado","Rechazado"]].map(([f, l]) => (
              <button key={f} className={`ae-filtro${filtro === f ? " activo" : ""}`} onClick={() => setFiltro(f)}>
                {l} <span className="ae-filtro-n">{contadores[f] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="ae-tabla-wrap">
            {loading ? (
              <div className="ae-empty">Cargando eventos...</div>
            ) : eventosFiltrados.length === 0 ? (
              <div className="ae-empty">No hay eventos en esta categoría.</div>
            ) : (
              <table className="ae-tabla">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {eventosFiltrados.map(ev => (
                    <tr key={ev.id}>
                      <td>
                        <div className="ae-titulo-cell">{ev.titulo}</div>
                        {ev.lugar && <div className="ae-sub">📍 {ev.lugar}</div>}
                        {ev.gratuito
                          ? <div className="ae-sub" style={{color:"#22c55e"}}>Gratuito</div>
                          : <div className="ae-sub" style={{color:"#eab308"}}>$ {ev.precio_entrada?.toLocaleString("es-AR")}</div>
                        }
                      </td>
                      <td><span className={`badge badge-${ev.tipo}`}>{ev.tipo.toUpperCase()}</span></td>
                      <td style={{fontSize:12, color:"rgba(255,255,255,0.5)"}}>{formatFecha(ev.fecha)}</td>
                      <td><span className={`badge ${ESTADO_BADGE[ev.estado]}`}>{ESTADO_LABEL[ev.estado]}</span></td>
                      <td>
                        {procesando === ev.id ? (
                          <span className="ae-spinner" />
                        ) : (
                          <div className="ae-acciones">
                            <button className="ae-btn ae-btn-edit" onClick={() => editarEvento(ev)}>Editar</button>

                            {ev.estado === "borrador" && (
                              <button className="ae-btn ae-btn-pub" onClick={() => cambiarEstado(ev.id, "publicado")}>Publicar</button>
                            )}

                            {ev.estado === "solicitado" && (
                              <>
                                {costoPendiente?.id === ev.id ? (
                                  <>
                                    <input
                                      className="ae-costo-input"
                                      placeholder="$ costo"
                                      value={costoPendiente.valor}
                                      onChange={e => setCostoPendiente({ id: ev.id, valor: e.target.value })}
                                    />
                                    <button className="ae-btn ae-btn-pub" onClick={() => guardarCosto(ev.id)}>Confirmar</button>
                                    <button className="ae-btn ae-btn-edit" onClick={() => setCostoPendiente(null)}>Cancelar</button>
                                  </>
                                ) : (
                                  <button className="ae-btn ae-btn-pub" onClick={() => setCostoPendiente({ id: ev.id, valor: "" })}>
                                    Aprobar + costo
                                  </button>
                                )}
                                <button className="ae-btn ae-btn-rech" onClick={() => cambiarEstado(ev.id, "rechazado")}>Rechazar</button>
                              </>
                            )}

                            {ev.estado === "pago_pendiente" && (
                              <button className="ae-btn ae-btn-pago" onClick={() => confirmarPago(ev.id)}>✓ Pago recibido</button>
                            )}

                            {ev.estado === "aprobado" && (
                              <button className="ae-btn ae-btn-pub" onClick={() => cambiarEstado(ev.id, "publicado")}>Publicar</button>
                            )}

                            {ev.estado === "publicado" && (
                              <button className="ae-btn ae-btn-rech" onClick={() => cambiarEstado(ev.id, "borrador")}>Despublicar</button>
                            )}

                            {ev.estado === "rechazado" && (
                              <button className="ae-btn ae-btn-pub" onClick={() => cambiarEstado(ev.id, "borrador")}>Restaurar</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* MODAL FORM */}
      {mostrarForm && (
        <div className="ae-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="ae-modal">
            <h2>{editandoId ? "Editar" : "Nuevo"} <span>evento</span></h2>

            <div className="ae-form-field">
              <label className="ae-form-label">Título *</label>
              <input className="ae-form-input" placeholder="Nombre del evento" value={form.titulo} onChange={e => handleForm("titulo", e.target.value)} />
            </div>

            <div className="ae-form-field">
              <label className="ae-form-label">Descripción</label>
              <textarea className="ae-form-textarea" placeholder="Detalle del evento..." value={form.descripcion} onChange={e => handleForm("descripcion", e.target.value)} />
            </div>

            <div className="ae-form-row">
              <div className="ae-form-field">
                <label className="ae-form-label">Fecha y hora *</label>
                <input className="ae-form-input" type="datetime-local" value={form.fecha} onChange={e => handleForm("fecha", e.target.value)} />
              </div>
              <div className="ae-form-field">
                <label className="ae-form-label">Tipo</label>
                <select className="ae-form-select" value={form.tipo} onChange={e => handleForm("tipo", e.target.value)}>
                  <option value="gfi">GFI® Oficial</option>
                  <option value="ci">Corredor (CI)</option>
                  <option value="externo">Externo (COCIR / CIR)</option>
                </select>
              </div>
            </div>

            <div className="ae-form-row">
              <div className="ae-form-field">
                <label className="ae-form-label">Lugar</label>
                <input className="ae-form-input" placeholder="Dirección o lugar" value={form.lugar} onChange={e => handleForm("lugar", e.target.value)} />
              </div>
              <div className="ae-form-field">
                <label className="ae-form-label">Capacidad</label>
                <input className="ae-form-input" type="number" placeholder="Ej: 50" value={form.capacidad} onChange={e => handleForm("capacidad", e.target.value)} />
              </div>
            </div>

            <div className="ae-form-field">
              <label className="ae-form-label">Entrada</label>
              <div className="ae-toggle">
                <button type="button" className={`ae-toggle-btn${form.gratuito ? " activo" : ""}`} onClick={() => handleForm("gratuito", true)}>Gratuito</button>
                <button type="button" className={`ae-toggle-btn${!form.gratuito ? " activo" : ""}`} onClick={() => handleForm("gratuito", false)}>De pago</button>
                {!form.gratuito && (
                  <input className="ae-form-input" type="number" placeholder="Precio $" style={{maxWidth:120}} value={form.precio_entrada} onChange={e => handleForm("precio_entrada", e.target.value)} />
                )}
              </div>
            </div>

            <div className="ae-form-field">
              <label className="ae-form-label">Link externo / WhatsApp</label>
              <input className="ae-form-input" placeholder="https://..." value={form.link_externo} onChange={e => handleForm("link_externo", e.target.value)} />
            </div>

            <div className="ae-form-field">
              <label className="ae-form-label">URL de imagen</label>
              <input className="ae-form-input" placeholder="https://imagen.jpg" value={form.imagen_url} onChange={e => handleForm("imagen_url", e.target.value)} />
            </div>

            <div className="ae-form-field">
              <label className="ae-form-label">URL de video (YouTube / Vimeo)</label>
              <input className="ae-form-input" placeholder="https://youtube.com/..." value={form.video_url} onChange={e => handleForm("video_url", e.target.value)} />
            </div>

            <div className="ae-form-actions">
              <button className="ae-btn-cancelar" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="ae-btn-guardar" onClick={guardarEvento} disabled={guardando || !form.titulo || !form.fecha}>
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear evento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
