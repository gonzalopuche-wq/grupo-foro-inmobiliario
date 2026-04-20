"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

interface Tarea {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  fecha_vencimiento: string | null;
  hora_vencimiento: string | null;
  completada: boolean;
  prioridad: string;
  created_at: string;
  crm_contactos?: { nombre: string; apellido: string; } | null;
}

interface Contacto { id: string; nombre: string; apellido: string; }

const TIPOS_TAREA = [
  { value: "tarea", label: "✅ Tarea", color: "#60a5fa" },
  { value: "llamada", label: "📞 Llamada", color: "#22c55e" },
  { value: "reunion", label: "🤝 Reunión", color: "#f97316" },
  { value: "visita", label: "🏠 Visita", color: "#eab308" },
  { value: "email", label: "✉️ Email", color: "#a78bfa" },
  { value: "whatsapp", label: "💬 WhatsApp", color: "#25d366" },
];

const PRIORIDADES = [
  { value: "baja", label: "Baja", color: "#60a5fa" },
  { value: "normal", label: "Normal", color: "#22c55e" },
  { value: "alta", label: "Alta", color: "#eab308" },
  { value: "urgente", label: "Urgente", color: "#ef4444" },
];

const FORM_VACIO = {
  titulo: "", tipo: "tarea", prioridad: "normal",
  contacto_id: "", descripcion: "",
  fecha_vencimiento: "", hora_vencimiento: "",
};

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { weekday:"short", day:"2-digit", month:"short" });

export default function TareasPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [filtro, setFiltro] = useState<"pendientes" | "hoy" | "semana" | "todas">("pendientes");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(new Date());

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await Promise.all([cargarTareas(data.user.id), cargarContactos(data.user.id)]);
    };
    init();
  }, []);

  const cargarTareas = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_tareas")
      .select("*, crm_contactos(nombre, apellido)")
      .eq("perfil_id", uid)
      .order("fecha_vencimiento", { ascending: true });
    setTareas((data as any[]) ?? []);
    setLoading(false);
  };

  const cargarContactos = async (uid: string) => {
    const { data } = await supabase.from("crm_contactos").select("id, nombre, apellido").eq("perfil_id", uid).order("apellido");
    setContactos((data as Contacto[]) ?? []);
  };

  const abrirFormNuevo = () => { setEditandoId(null); setForm(FORM_VACIO); setMostrarForm(true); };
  const abrirFormEditar = (t: Tarea) => {
    setEditandoId(t.id);
    setForm({
      titulo: t.titulo, tipo: t.tipo, prioridad: t.prioridad,
      contacto_id: t.contacto_id ?? "", descripcion: t.descripcion ?? "",
      fecha_vencimiento: t.fecha_vencimiento ?? "", hora_vencimiento: t.hora_vencimiento ?? "",
    });
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!userId || !form.titulo) return;
    setGuardando(true);
    const datos = {
      perfil_id: userId,
      titulo: form.titulo, tipo: form.tipo, prioridad: form.prioridad,
      contacto_id: form.contacto_id || null,
      descripcion: form.descripcion || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      hora_vencimiento: form.hora_vencimiento || null,
      updated_at: new Date().toISOString(),
    };
    if (editandoId) {
      await supabase.from("crm_tareas").update(datos).eq("id", editandoId);
    } else {
      await supabase.from("crm_tareas").insert(datos);
    }
    setGuardando(false);
    setMostrarForm(false);
    if (userId) cargarTareas(userId);
  };

  const toggleCompletada = async (t: Tarea) => {
    await supabase.from("crm_tareas").update({ completada: !t.completada, updated_at: new Date().toISOString() }).eq("id", t.id);
    if (userId) cargarTareas(userId);
  };

  const eliminar = async (id: string) => {
    await supabase.from("crm_tareas").delete().eq("id", id);
    if (userId) cargarTareas(userId);
  };

  const hoy = new Date().toISOString().split("T")[0];
  const finSemana = new Date(); finSemana.setDate(finSemana.getDate() + 7);
  const finSemanaStr = finSemana.toISOString().split("T")[0];

  const tareasFiltradas = useMemo(() => {
    return tareas.filter(t => {
      if (filtro === "pendientes") return !t.completada;
      if (filtro === "hoy") return t.fecha_vencimiento === hoy && !t.completada;
      if (filtro === "semana") return t.fecha_vencimiento && t.fecha_vencimiento >= hoy && t.fecha_vencimiento <= finSemanaStr && !t.completada;
      return true;
    });
  }, [tareas, filtro]);

  const vencidas = tareas.filter(t => !t.completada && t.fecha_vencimiento && t.fecha_vencimiento < hoy).length;
  const hoyCount = tareas.filter(t => !t.completada && t.fecha_vencimiento === hoy).length;

  // Calendario
  const diasDelMes = useMemo(() => {
    const año = mesCalendario.getFullYear();
    const mes = mesCalendario.getMonth();
    const primerDia = new Date(año, mes, 1).getDay();
    const diasEnMes = new Date(año, mes + 1, 0).getDate();
    const dias: (number | null)[] = [];
    for (let i = 0; i < (primerDia === 0 ? 6 : primerDia - 1); i++) dias.push(null);
    for (let i = 1; i <= diasEnMes; i++) dias.push(i);
    return dias;
  }, [mesCalendario]);

  const tareasPorDia = useMemo(() => {
    const map: Record<string, Tarea[]> = {};
    tareas.forEach(t => {
      if (t.fecha_vencimiento) {
        if (!map[t.fecha_vencimiento]) map[t.fecha_vencimiento] = [];
        map[t.fecha_vencimiento].push(t);
      }
    });
    return map;
  }, [tareas]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .tar-wrap { display: flex; flex-direction: column; gap: 16px; }
        .tar-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .tar-titulo { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .tar-titulo span { color: #cc0000; }
        .tar-acciones { display: flex; gap: 8px; align-items: center; }
        .tar-vista-btn { padding: 6px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.4); font-size: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; }
        .tar-vista-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.08); color: #fff; }
        .tar-btn-nuevo { padding: 8px 16px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .tar-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
        .tar-filtro { padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .tar-filtro:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .tar-filtro.activo { border-color: #cc0000; background: rgba(200,0,0,0.08); color: #fff; }
        .tar-alerta { padding: 8px 14px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 6px; font-size: 11px; color: rgba(255,255,255,0.6); display: flex; gap: 8px; align-items: center; }
        .tar-lista { display: flex; flex-direction: column; gap: 6px; }
        .tar-item { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; transition: all 0.15s; }
        .tar-item:hover { border-color: rgba(255,255,255,0.1); }
        .tar-item.completada { opacity: 0.4; }
        .tar-item.vencida { border-color: rgba(200,0,0,0.2); background: rgba(200,0,0,0.03); }
        .tar-check { width: 20px; height: 20px; border-radius: 5px; border: 2px solid rgba(255,255,255,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
        .tar-check.hecho { background: #22c55e; border-color: #22c55e; }
        .tar-item-body { flex: 1; }
        .tar-item-titulo { font-size: 13px; color: #fff; font-weight: 500; font-family: 'Inter',sans-serif; }
        .tar-item-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; align-items: center; }
        .tar-meta-chip { font-size: 9px; padding: 1px 7px; border-radius: 8px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.05em; }
        .tar-item-acciones { display: flex; gap: 6px; }
        .tar-btn-sm { padding: 4px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.35); font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; }
        .tar-btn-sm:hover { border-color: rgba(200,0,0,0.3); color: #fff; }
        .tar-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        /* Calendario */
        .cal-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden; }
        .cal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .cal-mes { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #fff; text-transform: capitalize; }
        .cal-nav { display: flex; gap: 8px; }
        .cal-nav-btn { padding: 5px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
        .cal-dia-header { padding: 8px 4px; text-align: center; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); border-bottom: 1px solid rgba(255,255,255,0.05); }
        .cal-dia { min-height: 80px; padding: 6px; border-right: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .cal-dia:nth-child(7n) { border-right: none; }
        .cal-dia-num { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.3); margin-bottom: 4px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .cal-dia-num.hoy { background: #cc0000; color: #fff; }
        .cal-tarea-chip { font-size: 9px; padding: 2px 5px; border-radius: 3px; color: #fff; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; font-family: 'Inter',sans-serif; }
        /* Modal */
        .tar-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: flex-start; justify-content: center; z-index: 300; padding: 24px; overflow-y: auto; }
        .tar-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 8px; padding: 28px 32px; width: 100%; max-width: 500px; margin: auto; position: relative; }
        .tar-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .tar-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 18px; }
        .tar-modal-titulo span { color: #cc0000; }
        .tar-field { margin-bottom: 11px; }
        .tar-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .tar-input { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; }
        .tar-input:focus { border-color: rgba(200,0,0,0.4); }
        .tar-input::placeholder { color: rgba(255,255,255,0.2); }
        .tar-select { width: 100%; padding: 8px 11px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .tar-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .tar-tipo-btns { display: flex; gap: 5px; flex-wrap: wrap; }
        .tar-tipo-btn { padding: 5px 9px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .tar-tipo-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .tar-prio-btns { display: flex; gap: 5px; }
        .tar-prio-btn { flex: 1; padding: 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; text-align: center; cursor: pointer; transition: all 0.15s; }
        .tar-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
        .tar-btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        .tar-btn-save { padding: 8px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        .tar-btn-save:disabled { opacity: 0.5; }
        .tar-spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="tar-wrap">
        {/* Header */}
        <div className="tar-header">
          <div className="tar-titulo">Tareas <span>GFI®</span></div>
          <div className="tar-acciones">
            <button className={`tar-vista-btn${vista === "lista" ? " activo" : ""}`} onClick={() => setVista("lista")}>Lista</button>
            <button className={`tar-vista-btn${vista === "calendario" ? " activo" : ""}`} onClick={() => setVista("calendario")}>📅 Calendario</button>
            <button className="tar-btn-nuevo" onClick={abrirFormNuevo}>+ Nueva tarea</button>
          </div>
        </div>

        {/* Alertas */}
        {vencidas > 0 && (
          <div className="tar-alerta">
            ⚠️ Tenés <strong style={{color:"#cc0000"}}>{vencidas} tarea{vencidas > 1 ? "s" : ""} vencida{vencidas > 1 ? "s" : ""}</strong>
          </div>
        )}
        {hoyCount > 0 && (
          <div className="tar-alerta" style={{borderColor:"rgba(234,179,8,0.2)",background:"rgba(234,179,8,0.06)"}}>
            📅 Hoy tenés <strong style={{color:"#eab308"}}>{hoyCount} tarea{hoyCount > 1 ? "s" : ""}</strong> para hacer
          </div>
        )}

        {vista === "lista" && (
          <>
            {/* Filtros */}
            <div className="tar-filtros">
              {[
                { id: "pendientes", label: `Pendientes (${tareas.filter(t => !t.completada).length})` },
                { id: "hoy", label: `Hoy (${hoyCount})` },
                { id: "semana", label: "Esta semana" },
                { id: "todas", label: `Todas (${tareas.length})` },
              ].map(f => (
                <button key={f.id} className={`tar-filtro${filtro === f.id ? " activo" : ""}`} onClick={() => setFiltro(f.id as any)}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Lista */}
            {loading ? (
              <div className="tar-empty">Cargando...</div>
            ) : tareasFiltradas.length === 0 ? (
              <div className="tar-empty">
                {filtro === "hoy" ? "No hay tareas para hoy 🎉" :
                 filtro === "semana" ? "No hay tareas para esta semana" :
                 "No hay tareas pendientes 🎉"}
              </div>
            ) : (
              <div className="tar-lista">
                {tareasFiltradas.map(t => {
                  const tipo = TIPOS_TAREA.find(x => x.value === t.tipo);
                  const prio = PRIORIDADES.find(x => x.value === t.prioridad);
                  const vencida = !t.completada && t.fecha_vencimiento && t.fecha_vencimiento < hoy;
                  const esHoy = t.fecha_vencimiento === hoy;
                  return (
                    <div key={t.id} className={`tar-item${t.completada ? " completada" : vencida ? " vencida" : ""}`}>
                      <div className={`tar-check${t.completada ? " hecho" : ""}`} onClick={() => toggleCompletada(t)}>
                        {t.completada && <span style={{fontSize:11,color:"#fff"}}>✓</span>}
                      </div>
                      <div className="tar-item-body">
                        <div className="tar-item-titulo" style={{textDecoration: t.completada ? "line-through" : "none"}}>
                          {t.titulo}
                        </div>
                        <div className="tar-item-meta">
                          {tipo && (
                            <span className="tar-meta-chip" style={{background:`${tipo.color}18`,border:`1px solid ${tipo.color}40`,color:tipo.color}}>
                              {tipo.label}
                            </span>
                          )}
                          {prio && prio.value !== "normal" && (
                            <span className="tar-meta-chip" style={{background:`${prio.color}18`,border:`1px solid ${prio.color}40`,color:prio.color}}>
                              {prio.label}
                            </span>
                          )}
                          {t.crm_contactos && (
                            <span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>
                              👤 {t.crm_contactos.apellido ?? ""} {t.crm_contactos.nombre}
                            </span>
                          )}
                          {t.fecha_vencimiento && (
                            <span style={{fontSize:10,color: vencida ? "#ff4444" : esHoy ? "#eab308" : "rgba(255,255,255,0.3)"}}>
                              {vencida ? "⚠️ " : esHoy ? "📅 " : "📆 "}
                              {vencida ? "Vencida " : ""}{formatFecha(t.fecha_vencimiento)}
                              {t.hora_vencimiento ? ` ${t.hora_vencimiento.slice(0,5)}` : ""}
                            </span>
                          )}
                        </div>
                        {t.descripcion && (
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:4,lineHeight:1.4}}>{t.descripcion}</div>
                        )}
                      </div>
                      <div className="tar-item-acciones">
                        <button className="tar-btn-sm" onClick={() => abrirFormEditar(t)}>Editar</button>
                        <button className="tar-btn-sm" style={{borderColor:"rgba(200,0,0,0.2)",color:"rgba(200,0,0,0.6)"}} onClick={() => eliminar(t.id)}>✗</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {vista === "calendario" && (
          <div className="cal-wrap">
            <div className="cal-header">
              <button className="cal-nav-btn" onClick={() => setMesCalendario(d => { const n = new Date(d); n.setMonth(n.getMonth()-1); return n; })}>← Anterior</button>
              <div className="cal-mes">
                {mesCalendario.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
              </div>
              <button className="cal-nav-btn" onClick={() => setMesCalendario(d => { const n = new Date(d); n.setMonth(n.getMonth()+1); return n; })}>Siguiente →</button>
            </div>
            <div className="cal-grid">
              {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d => (
                <div key={d} className="cal-dia-header">{d}</div>
              ))}
              {diasDelMes.map((dia, idx) => {
                if (!dia) return <div key={`empty-${idx}`} className="cal-dia" style={{background:"rgba(0,0,0,0.2)"}} />;
                const fechaStr = `${mesCalendario.getFullYear()}-${String(mesCalendario.getMonth()+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
                const tareasDelDia = tareasPorDia[fechaStr] ?? [];
                const esHoyDia = fechaStr === hoy;
                return (
                  <div key={dia} className="cal-dia">
                    <div className={`cal-dia-num${esHoyDia ? " hoy" : ""}`}>{dia}</div>
                    {tareasDelDia.slice(0,3).map(t => {
                      const tipo = TIPOS_TAREA.find(x => x.value === t.tipo);
                      return (
                        <div key={t.id} className="cal-tarea-chip"
                          style={{background: t.completada ? "rgba(255,255,255,0.05)" : `${tipo?.color ?? "#60a5fa"}28`,
                                  textDecoration: t.completada ? "line-through" : "none",
                                  color: t.completada ? "rgba(255,255,255,0.3)" : (tipo?.color ?? "#60a5fa")}}
                          onClick={() => abrirFormEditar(t)}
                          title={t.titulo}>
                          {t.titulo}
                        </div>
                      );
                    })}
                    {tareasDelDia.length > 3 && (
                      <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontFamily:"Montserrat,sans-serif"}}>+{tareasDelDia.length-3} más</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {mostrarForm && (
        <div className="tar-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="tar-modal">
            <div className="tar-modal-titulo">{editandoId ? "Editar" : "Nueva"} <span>tarea</span></div>

            <div className="tar-field">
              <label className="tar-label">Título *</label>
              <input className="tar-input" value={form.titulo} onChange={e => setForm(p => ({...p, titulo: e.target.value}))} placeholder="¿Qué hay que hacer?" />
            </div>

            <div className="tar-field">
              <label className="tar-label">Tipo</label>
              <div className="tar-tipo-btns">
                {TIPOS_TAREA.map(t => (
                  <button key={t.value} className={`tar-tipo-btn${form.tipo === t.value ? " activo" : ""}`}
                    onClick={() => setForm(p => ({...p, tipo: t.value}))}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="tar-field">
              <label className="tar-label">Prioridad</label>
              <div className="tar-prio-btns">
                {PRIORIDADES.map(p => (
                  <button key={p.value} className={`tar-prio-btn${form.prioridad === p.value ? " activo" : ""}`}
                    style={form.prioridad === p.value ? {borderColor: p.color, background: `${p.color}18`, color: p.color} : {}}
                    onClick={() => setForm(f => ({...f, prioridad: p.value}))}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="tar-row">
              <div className="tar-field">
                <label className="tar-label">Fecha</label>
                <input type="date" className="tar-input" value={form.fecha_vencimiento} onChange={e => setForm(p => ({...p, fecha_vencimiento: e.target.value}))} />
              </div>
              <div className="tar-field">
                <label className="tar-label">Hora</label>
                <input type="time" className="tar-input" value={form.hora_vencimiento} onChange={e => setForm(p => ({...p, hora_vencimiento: e.target.value}))} />
              </div>
            </div>

            <div className="tar-field">
              <label className="tar-label">Contacto relacionado</label>
              <select className="tar-select" value={form.contacto_id} onChange={e => setForm(p => ({...p, contacto_id: e.target.value}))}>
                <option value="">Sin contacto</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}
              </select>
            </div>

            <div className="tar-field">
              <label className="tar-label">Descripción</label>
              <textarea className="tar-input" value={form.descripcion} onChange={e => setForm(p => ({...p, descripcion: e.target.value}))} rows={2} placeholder="Detalles opcionales..." style={{resize:"none"}} />
            </div>

            <div className="tar-modal-actions">
              <button className="tar-btn-cancel" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="tar-btn-save" onClick={guardar} disabled={guardando || !form.titulo}>
                {guardando ? <><span className="tar-spinner"/>Guardando...</> : editandoId ? "Guardar" : "Crear tarea"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
