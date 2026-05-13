"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Sesion {
  id: string;
  titulo: string;
  mentor_nombre: string;
  descripcion: string | null;
  fecha: string;
  hora: string;
  plataforma: "youtube" | "zoom" | "meet";
  link_live: string | null;
  link_grabacion: string | null;
  estado: "proxima" | "en_vivo" | "grabada";
  created_at: string;
}

interface Consulta {
  id: string;
  sesion_id: string;
  user_id: string;
  consulta: string;
  destacada: boolean;
  votos: number;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
}

const PLATAFORMA_META: Record<string, { label: string; color: string; icon: string }> = {
  youtube: { label: "YouTube Live", color: "#ff0000", icon: "▶" },
  zoom: { label: "Zoom", color: "#2d8cff", icon: "🎥" },
  meet: { label: "Google Meet", color: "#00832d", icon: "📹" },
};

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatFecha(fecha: string, hora: string) {
  const d = new Date(`${fecha}T${hora}`);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${hora.slice(0,5)}hs`;
}

function formatFechaCorta(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

const FORM_VACIO = {
  titulo: "", mentor_nombre: "", descripcion: "", fecha: "", hora: "18:00",
  plataforma: "youtube" as "youtube" | "zoom" | "meet", link_live: "", link_grabacion: "", estado: "proxima" as "proxima" | "en_vivo" | "grabada",
};

export default function CanalEducativoPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [sesionActiva, setSesionActiva] = useState<Sesion | null>(null);
  const [vistaArchivo, setVistaArchivo] = useState(false);

  // Consulta form
  const [nuevaConsulta, setNuevaConsulta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // Admin form
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [reproduciendo, setReproduciendo] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (p?.tipo === "admin") setEsAdmin(true);
      await cargarSesiones();
    };
    init();
  }, []);

  const cargarSesiones = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("canal_sesiones")
      .select("*")
      .order("fecha", { ascending: false });
    const lista: Sesion[] = data ?? [];
    setSesiones(lista);

    // Sesión principal: en_vivo primero, luego la más próxima
    const enVivo = lista.find(s => s.estado === "en_vivo");
    const proxima = lista.filter(s => s.estado === "proxima").sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const principal = enVivo ?? proxima ?? null;
    setSesionActiva(principal);

    if (principal) await cargarConsultas(principal.id);
    setLoading(false);
  };

  const cargarConsultas = async (sesionId: string) => {
    const { data } = await supabase
      .from("canal_consultas")
      .select("*, perfiles(nombre, apellido, matricula)")
      .eq("sesion_id", sesionId)
      .order("destacada", { ascending: false })
      .order("votos", { ascending: false })
      .order("created_at", { ascending: true });
    setConsultas(data ?? []);
  };

  const enviarConsulta = async () => {
    if (!userId || !sesionActiva || !nuevaConsulta.trim()) return;
    setEnviando(true);
    const { error } = await supabase.from("canal_consultas").insert({
      sesion_id: sesionActiva.id,
      user_id: userId,
      consulta: nuevaConsulta.trim(),
    });
    if (!error) {
      setNuevaConsulta("");
      setEnviado(true);
      setTimeout(() => setEnviado(false), 3000);
      await cargarConsultas(sesionActiva.id);
    }
    setEnviando(false);
  };

  const toggleDestacada = async (c: Consulta) => {
    if (!esAdmin) return;
    await supabase.from("canal_consultas").update({ destacada: !c.destacada }).eq("id", c.id);
    if (sesionActiva) await cargarConsultas(sesionActiva.id);
  };

  const notificarEnVivo = async (titulo: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch("/api/canal/notificar-en-vivo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ titulo }),
      });
    } catch {}
  };

  const guardarSesion = async () => {
    if (!form.titulo || !form.mentor_nombre || !form.fecha || !form.hora) return;
    setGuardando(true);
    const payload = {
      titulo: form.titulo.trim(),
      mentor_nombre: form.mentor_nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha: form.fecha,
      hora: form.hora,
      plataforma: form.plataforma,
      link_live: form.link_live.trim() || null,
      link_grabacion: form.link_grabacion.trim() || null,
      estado: form.estado,
    };
    if (editandoId) {
      const sesionAnterior = sesiones.find(s => s.id === editandoId);
      const { error } = await supabase.from("canal_sesiones").update(payload).eq("id", editandoId);
      if (!error && payload.estado === "en_vivo" && sesionAnterior?.estado !== "en_vivo") {
        notificarEnVivo(payload.titulo);
      }
      showToast(error ? "Error al actualizar" : "Sesión actualizada", error ? "err" : "ok");
    } else {
      const { error } = await supabase.from("canal_sesiones").insert(payload);
      if (!error && payload.estado === "en_vivo") notificarEnVivo(payload.titulo);
      showToast(error ? "Error al crear" : "Sesión creada", error ? "err" : "ok");
    }
    setGuardando(false);
    setMostrarForm(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
    await cargarSesiones();
  };

  const eliminarSesion = async (id: string) => {
    if (!confirm("¿Eliminar esta sesión?")) return;
    await supabase.from("canal_sesiones").delete().eq("id", id);
    await cargarSesiones();
  };

  const editarSesion = (s: Sesion) => {
    setForm({
      titulo: s.titulo,
      mentor_nombre: s.mentor_nombre,
      descripcion: s.descripcion ?? "",
      fecha: s.fecha,
      hora: s.hora.slice(0, 5),
      plataforma: s.plataforma as "youtube" | "zoom" | "meet",
      link_live: s.link_live ?? "",
      link_grabacion: s.link_grabacion ?? "",
      estado: s.estado as "proxima" | "en_vivo" | "grabada",
    });
    setEditandoId(s.id);
    setMostrarForm(true);
  };

  const showToast = (msg: string, tipo: "ok" | "err") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const grabadas = sesiones.filter(s => s.estado === "grabada").sort((a, b) => b.fecha.localeCompare(a.fecha));
  const proximas = sesiones.filter(s => s.estado === "proxima").sort((a, b) => a.fecha.localeCompare(b.fecha));

  const yaEnvioConsulta = consultas.some(c => c.user_id === userId);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "0" }}>
      <style>{`
        .ce-header { background: linear-gradient(135deg, #1a0a0a 0%, #0f0a1a 100%); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 32px 24px 24px; }
        .ce-titulo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; font-family: 'Montserrat', sans-serif; }
        .ce-sub { font-size: 13px; color: rgba(255,255,255,0.45); margin-top: 4px; }
        .ce-body { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
        .ce-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
        .ce-card-live { border-color: rgba(255,50,50,0.4); background: rgba(255,30,30,0.06); }
        .ce-card-proxima { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.05); }
        .ce-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; }
        .ce-badge-live { background: rgba(255,30,30,0.15); color: #ff4444; border: 1px solid rgba(255,30,30,0.3); }
        .ce-badge-proxima { background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.25); }
        .ce-badge-grabada { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.1); }
        .ce-mentor { font-size: 13px; color: rgba(255,255,255,0.55); margin-top: 8px; }
        .ce-mentor strong { color: rgba(255,255,255,0.85); }
        .ce-fecha { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 6px; }
        .ce-desc { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6; margin-top: 12px; }
        .ce-btn { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
        .ce-btn-live { background: #ff4444; color: #fff; }
        .ce-btn-live:hover { background: #ff2222; }
        .ce-btn-plat { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1); }
        .ce-btn-plat:hover { background: rgba(255,255,255,0.1); }
        .ce-btn-primary { background: #cc0000; color: #fff; }
        .ce-btn-primary:hover { background: #aa0000; }
        .ce-btn-ghost { background: transparent; color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.1); }
        .ce-btn-ghost:hover { color: #fff; border-color: rgba(255,255,255,0.25); }
        .ce-section-title { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 14px; }
        .ce-consulta-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 12px 14px; font-size: 14px; resize: vertical; min-height: 80px; font-family: inherit; box-sizing: border-box; }
        .ce-consulta-input:focus { outline: none; border-color: rgba(99,102,241,0.4); }
        .ce-consulta-item { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 12px; align-items: flex-start; }
        .ce-consulta-item:last-child { border-bottom: none; }
        .ce-consulta-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.3); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #818cf8; flex-shrink: 0; }
        .ce-consulta-nombre { font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 4px; }
        .ce-consulta-texto { font-size: 14px; color: rgba(255,255,255,0.85); line-height: 1.5; }
        .ce-consulta-destacada { border-left: 2px solid #f59e0b; padding-left: 12px; }
        .ce-tag-destacada { font-size: 10px; font-weight: 700; color: #f59e0b; letter-spacing: 0.05em; text-transform: uppercase; margin-left: 8px; }
        .ce-archivo-item { padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; margin-bottom: 10px; display: flex; gap: 16px; align-items: center; }
        .ce-archivo-fecha { min-width: 56px; text-align: center; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 6px; }
        .ce-archivo-fecha-dia { font-size: 22px; font-weight: 800; color: #fff; line-height: 1; }
        .ce-archivo-fecha-mes { font-size: 10px; text-transform: uppercase; color: rgba(255,255,255,0.35); letter-spacing: 0.08em; margin-top: 2px; }
        .ce-archivo-info { flex: 1; }
        .ce-archivo-titulo { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.9); }
        .ce-archivo-mentor { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 3px; }
        .ce-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
        .ce-tab { padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.45); transition: all 0.15s; }
        .ce-tab.active { background: rgba(204,0,0,0.15); border-color: rgba(204,0,0,0.4); color: #ff6666; }
        .ce-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .ce-modal { background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        .ce-modal-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; }
        .ce-field { margin-bottom: 14px; }
        .ce-label { font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 6px; display: block; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
        .ce-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #fff; padding: 10px 12px; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .ce-input:focus { outline: none; border-color: rgba(204,0,0,0.4); }
        .ce-select { width: 100%; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: #fff; padding: 10px 12px; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        .ce-row { display: flex; gap: 12px; }
        .ce-row .ce-field { flex: 1; }
        .ce-empty { text-align: center; padding: 48px 16px; color: rgba(255,255,255,0.25); }
        .ce-plat-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .ce-toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; z-index: 9999; }
        .ce-toast-ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #4ade80; }
        .ce-toast-err { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
        .pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media (max-width: 600px) { .ce-row { flex-direction: column; } .ce-tabs { flex-wrap: wrap; } }
      `}</style>

      {/* Header */}
      <div className="ce-header">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="ce-titulo">📡 Canal del Foro GFI®</div>
              <div className="ce-sub">Transmisiones en vivo · Zoom · Meet · YouTube · Archivo permanente</div>
            </div>
            {esAdmin && (
              <button className="ce-btn ce-btn-primary" onClick={() => { setForm(FORM_VACIO); setEditandoId(null); setMostrarForm(true); }}>
                + Nueva sesión
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="ce-body">
        {loading ? (
          <div className="ce-empty">Cargando...</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="ce-tabs">
              <button className={`ce-tab ${!vistaArchivo ? "active" : ""}`} onClick={() => setVistaArchivo(false)}>
                Próxima sesión
              </button>
              <button className={`ce-tab ${vistaArchivo ? "active" : ""}`} onClick={() => setVistaArchivo(true)}>
                Archivo ({grabadas.length})
              </button>
            </div>

            {!vistaArchivo ? (
              <>
                {/* Sesión principal */}
                {sesionActiva ? (
                  <div className={`ce-card ${sesionActiva.estado === "en_vivo" ? "ce-card-live" : "ce-card-proxima"}`}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        {sesionActiva.estado === "en_vivo" ? (
                          <span className="ce-badge ce-badge-live">
                            <span className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4444", display: "inline-block" }} />
                            EN VIVO
                          </span>
                        ) : (
                          <span className="ce-badge ce-badge-proxima">PRÓXIMA SESIÓN</span>
                        )}
                        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 10, marginBottom: 0 }}>{sesionActiva.titulo}</h2>
                        <div className="ce-mentor">Mentor: <strong>{sesionActiva.mentor_nombre}</strong></div>
                        <div className="ce-fecha">{formatFecha(sesionActiva.fecha, sesionActiva.hora)}</div>
                        {sesionActiva.descripcion && <div className="ce-desc">{sesionActiva.descripcion}</div>}
                      </div>
                      {esAdmin && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="ce-btn ce-btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => editarSesion(sesionActiva)}>Editar</button>
                        </div>
                      )}
                    </div>

                    {/* Plataforma y link */}
                    {sesionActiva.link_live ? (
                      <div style={{ marginTop: 16 }}>
                        {sesionActiva.estado === "en_vivo" && sesionActiva.plataforma === "youtube" && extractYouTubeId(sesionActiva.link_live) ? (
                          /* Embed YouTube Live directo en la página */
                          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden", background: "#000", marginBottom: 10 }}>
                            <iframe
                              src={`https://www.youtube.com/embed/${extractYouTubeId(sesionActiva.link_live)}?autoplay=1&rel=0`}
                              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              title={sesionActiva.titulo}
                            />
                          </div>
                        ) : sesionActiva.estado === "en_vivo" && (sesionActiva.plataforma === "zoom" || sesionActiva.plataforma === "meet") ? (
                          /* Zoom/Meet: no se puede embedir, botón grande */
                          <div style={{ background: "rgba(255,30,30,0.08)", border: "1px solid rgba(255,30,30,0.25)", borderRadius: 10, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Transmisión en vivo</div>
                              <div style={{ fontSize: 14, color: "#fff" }}>
                                {PLATAFORMA_META[sesionActiva.plataforma]?.label} · Hacé clic para unirte
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4, wordBreak: "break-all" }}>{sesionActiva.link_live}</div>
                            </div>
                            <a href={sesionActiva.link_live} target="_blank" rel="noreferrer">
                              <button className="ce-btn ce-btn-live" style={{ fontSize: 16, padding: "14px 28px" }}>
                                {PLATAFORMA_META[sesionActiva.plataforma]?.icon} Unirse ahora
                              </button>
                            </a>
                          </div>
                        ) : (
                          /* Próxima o plataforma desconocida: link sencillo */
                          <a href={sesionActiva.link_live} target="_blank" rel="noreferrer">
                            <button className="ce-btn ce-btn-plat">
                              {PLATAFORMA_META[sesionActiva.plataforma]?.icon} {sesionActiva.estado === "en_vivo" ? "Ver en vivo" : "Ver en"} {PLATAFORMA_META[sesionActiva.plataforma]?.label}
                            </button>
                          </a>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>El link se publicará antes de la sesión.</div>
                    )}
                  </div>
                ) : (
                  <div className="ce-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>No hay sesiones programadas</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>Las sesiones se publican con anticipación. Volvé en breve.</div>
                  </div>
                )}

                {/* Próximas (si hay más de una) */}
                {proximas.filter(s => s.id !== sesionActiva?.id).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="ce-section-title">Más próximas</div>
                    {proximas.filter(s => s.id !== sesionActiva?.id).map(s => (
                      <div key={s.id} className="ce-archivo-item">
                        <div className="ce-archivo-fecha">
                          <div className="ce-archivo-fecha-dia">{new Date(s.fecha + "T12:00:00").getDate()}</div>
                          <div className="ce-archivo-fecha-mes">{MESES[new Date(s.fecha + "T12:00:00").getMonth()]}</div>
                        </div>
                        <div className="ce-archivo-info">
                          <div className="ce-archivo-titulo">{s.titulo}</div>
                          <div className="ce-archivo-mentor">Mentor: {s.mentor_nombre} · {s.hora.slice(0,5)}hs via {PLATAFORMA_META[s.plataforma]?.label}</div>
                        </div>
                        {esAdmin && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="ce-btn ce-btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => editarSesion(s)}>Editar</button>
                            <button className="ce-btn ce-btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "#f87171" }} onClick={() => eliminarSesion(s.id)}>✕</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Hilo de consultas */}
                {sesionActiva && sesionActiva.estado !== "grabada" && (
                  <div className="ce-card" style={{ marginTop: 20 }}>
                    <div className="ce-section-title">Consultas para esta sesión</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
                      Publicá tu consulta antes de la sesión. El Mentor las revisará y responderá en vivo.
                    </div>

                    {/* Form enviar */}
                    {!yaEnvioConsulta ? (
                      <div style={{ marginBottom: 20 }}>
                        <textarea
                          className="ce-consulta-input"
                          placeholder="¿Qué querés consultarle al mentor?"
                          value={nuevaConsulta}
                          onChange={e => setNuevaConsulta(e.target.value)}
                          maxLength={400}
                        />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{nuevaConsulta.length}/400</span>
                          <button
                            className="ce-btn ce-btn-primary"
                            onClick={enviarConsulta}
                            disabled={enviando || !nuevaConsulta.trim()}
                            style={{ opacity: enviando || !nuevaConsulta.trim() ? 0.5 : 1 }}
                          >
                            {enviado ? "✓ Enviada" : enviando ? "Enviando..." : "Publicar consulta"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 16, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                        ✓ Ya publicaste tu consulta para esta sesión.
                      </div>
                    )}

                    {/* Lista de consultas */}
                    {consultas.length === 0 ? (
                      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "20px 0" }}>
                        Todavía no hay consultas. Sé el primero en publicar.
                      </div>
                    ) : (
                      <div>
                        {consultas.map(c => {
                          const inicial = (c.perfiles?.nombre?.[0] ?? "?").toUpperCase();
                          const nombre = c.perfiles ? `${c.perfiles.nombre} ${c.perfiles.apellido}` : "Corredor";
                          return (
                            <div key={c.id} className={`ce-consulta-item ${c.destacada ? "ce-consulta-destacada" : ""}`}>
                              <div className="ce-consulta-avatar">{inicial}</div>
                              <div style={{ flex: 1 }}>
                                <div className="ce-consulta-nombre">
                                  {nombre}
                                  {c.perfiles?.matricula && <span style={{ opacity: 0.6 }}> · Mat. {c.perfiles.matricula}</span>}
                                  {c.destacada && <span className="ce-tag-destacada">★ Destacada</span>}
                                </div>
                                <div className="ce-consulta-texto">{c.consulta}</div>
                              </div>
                              {esAdmin && (
                                <button
                                  onClick={() => toggleDestacada(c)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: c.destacada ? "#f59e0b" : "rgba(255,255,255,0.2)", fontSize: 16, padding: "4px 6px" }}
                                  title={c.destacada ? "Quitar destacada" : "Destacar"}
                                >
                                  ★
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Archivo de sesiones grabadas */
              <div>
                <div className="ce-section-title">Sesiones grabadas</div>
                {grabadas.length === 0 ? (
                  <div className="ce-empty">
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📼</div>
                    Todavía no hay sesiones grabadas.
                  </div>
                ) : (
                  grabadas.map(s => {
                    const d = new Date(s.fecha + "T12:00:00");
                    const ytId = s.link_grabacion ? extractYouTubeId(s.link_grabacion) : null;
                    const isPlaying = reproduciendo === s.id;
                    return (
                      <div key={s.id} style={{ marginBottom: 10 }}>
                        <div className="ce-archivo-item" style={{ marginBottom: 0, borderBottomLeftRadius: isPlaying ? 0 : undefined, borderBottomRightRadius: isPlaying ? 0 : undefined, borderBottom: isPlaying ? "none" : undefined }}>
                          <div className="ce-archivo-fecha">
                            <div className="ce-archivo-fecha-dia">{d.getDate()}</div>
                            <div className="ce-archivo-fecha-mes">{MESES[d.getMonth()]}</div>
                          </div>
                          <div className="ce-archivo-info">
                            <div className="ce-archivo-titulo">{s.titulo}</div>
                            <div className="ce-archivo-mentor">Mentor: {s.mentor_nombre} · {formatFechaCorta(s.fecha)}</div>
                            {s.descripcion && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{s.descripcion}</div>}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {s.link_grabacion ? (
                              ytId ? (
                                <button
                                  className="ce-btn ce-btn-plat"
                                  style={{ fontSize: 12, padding: "6px 14px", background: isPlaying ? "rgba(255,50,50,0.15)" : undefined, borderColor: isPlaying ? "rgba(255,50,50,0.35)" : undefined, color: isPlaying ? "#ff6666" : undefined }}
                                  onClick={() => setReproduciendo(isPlaying ? null : s.id)}
                                >
                                  {isPlaying ? "✕ Cerrar" : "▶ Reproducir"}
                                </button>
                              ) : (
                                <a href={s.link_grabacion} target="_blank" rel="noreferrer">
                                  <button className="ce-btn ce-btn-plat" style={{ fontSize: 12, padding: "6px 14px" }}>
                                    ▶ Ver grabación
                                  </button>
                                </a>
                              )
                            ) : (
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>Sin grabación</span>
                            )}
                            {esAdmin && (
                              <>
                                <button className="ce-btn ce-btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => editarSesion(s)}>Editar</button>
                                <button className="ce-btn ce-btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "#f87171" }} onClick={() => eliminarSesion(s.id)}>✕</button>
                              </>
                            )}
                          </div>
                        </div>
                        {isPlaying && ytId && (
                          <div style={{ background: "#000", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none", borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: "hidden", aspectRatio: "16/9" }}>
                            <iframe
                              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal crear/editar sesión */}
      {mostrarForm && (
        <div className="ce-modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setMostrarForm(false); setEditandoId(null); } }}>
          <div className="ce-modal">
            <div className="ce-modal-title">{editandoId ? "Editar sesión" : "Nueva sesión"}</div>

            <div className="ce-field">
              <label className="ce-label">Título de la sesión *</label>
              <input className="ce-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Tasación en barrios cerrados" />
            </div>
            <div className="ce-field">
              <label className="ce-label">Nombre del mentor *</label>
              <input className="ce-input" value={form.mentor_nombre} onChange={e => setForm(f => ({ ...f, mentor_nombre: e.target.value }))} placeholder="Nombre y apellido" />
            </div>
            <div className="ce-field">
              <label className="ce-label">Descripción</label>
              <textarea className="ce-input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="¿De qué trata esta sesión?" style={{ minHeight: 64, resize: "vertical" }} />
            </div>
            <div className="ce-row">
              <div className="ce-field">
                <label className="ce-label">Fecha *</label>
                <input type="date" className="ce-input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div className="ce-field">
                <label className="ce-label">Hora *</label>
                <input type="time" className="ce-input" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
              </div>
            </div>
            <div className="ce-row">
              <div className="ce-field">
                <label className="ce-label">Plataforma</label>
                <select className="ce-select" value={form.plataforma} onChange={e => setForm(f => ({ ...f, plataforma: e.target.value as any }))}>
                  <option value="youtube">YouTube Live</option>
                  <option value="zoom">Zoom</option>
                  <option value="meet">Google Meet</option>
                </select>
              </div>
              <div className="ce-field">
                <label className="ce-label">Estado</label>
                <select className="ce-select" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as any }))}>
                  <option value="proxima">Próxima</option>
                  <option value="en_vivo">En vivo</option>
                  <option value="grabada">Grabada</option>
                </select>
              </div>
            </div>
            <div className="ce-field">
              <label className="ce-label">Link al live</label>
              <input className="ce-input" value={form.link_live} onChange={e => setForm(f => ({ ...f, link_live: e.target.value }))} placeholder="https://youtube.com/live/..." />
            </div>
            <div className="ce-field">
              <label className="ce-label">Link a la grabación</label>
              <input className="ce-input" value={form.link_grabacion} onChange={e => setForm(f => ({ ...f, link_grabacion: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="ce-btn ce-btn-ghost" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
              <button
                className="ce-btn ce-btn-primary"
                onClick={guardarSesion}
                disabled={guardando || !form.titulo || !form.mentor_nombre || !form.fecha}
                style={{ opacity: guardando ? 0.6 : 1 }}
              >
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear sesión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`ce-toast ce-toast-${toast.tipo}`}>{toast.msg}</div>
      )}
    </div>
  );
}
