"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

interface Negocio {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  titulo: string;
  tipo: string;
  etapa: string;
  monto: number | null;
  moneda: string;
  zona: string | null;
  tipo_propiedad: string | null;
  descripcion: string | null;
  fecha_cierre_estimada: string | null;
  created_at: string;
  updated_at: string;
  crm_contactos?: { nombre: string; apellido: string; telefono: string | null; } | null;
}

interface Contacto { id: string; nombre: string; apellido: string; }

const ETAPAS = [
  { id: "nuevo", label: "Nuevo", color: "#60a5fa", emoji: "🆕" },
  { id: "contactado", label: "Contactado", color: "#a78bfa", emoji: "📞" },
  { id: "visita", label: "Visita", color: "#f97316", emoji: "🏠" },
  { id: "propuesta", label: "Propuesta", color: "#eab308", emoji: "📋" },
  { id: "negociacion", label: "Negociación", color: "#fb923c", emoji: "🤝" },
  { id: "cerrado", label: "Cerrado ✓", color: "#22c55e", emoji: "✅" },
  { id: "perdido", label: "Perdido", color: "#ef4444", emoji: "❌" },
];

const TIPOS = ["venta", "alquiler", "captacion", "alquiler_temporal", "otro"];
const TIPOS_PROP = ["Departamento", "Casa", "Terreno", "Oficina", "Local", "Galpón", "Campo", "Otro"];
const FORM_VACIO = {
  titulo: "", tipo: "venta", etapa: "nuevo",
  contacto_id: "", monto: "", moneda: "USD",
  zona: "", tipo_propiedad: "", descripcion: "",
  fecha_cierre_estimada: "",
};

const formatPeso = (v: number, m: string) =>
  m === "USD" ? `USD ${v.toLocaleString("es-AR")}` :
  `$ ${v.toLocaleString("es-AR")}`;

export default function NegociosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<"kanban" | "lista">("kanban");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [filtroEtapa, setFiltroEtapa] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await Promise.all([cargarNegocios(data.user.id), cargarContactos(data.user.id)]);
    };
    init();
  }, []);

  const cargarNegocios = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_negocios")
      .select("*, crm_contactos(nombre, apellido, telefono)")
      .eq("perfil_id", uid)
      .order("updated_at", { ascending: false });
    setNegocios((data as any[]) ?? []);
    setLoading(false);
  };

  const cargarContactos = async (uid: string) => {
    const { data } = await supabase
      .from("crm_contactos")
      .select("id, nombre, apellido")
      .eq("perfil_id", uid)
      .order("apellido");
    setContactos((data as Contacto[]) ?? []);
  };

  const abrirFormNuevo = (etapa = "nuevo") => {
    setEditandoId(null);
    setForm({ ...FORM_VACIO, etapa });
    setMostrarForm(true);
  };

  const abrirFormEditar = (n: Negocio) => {
    setEditandoId(n.id);
    setForm({
      titulo: n.titulo, tipo: n.tipo, etapa: n.etapa,
      contacto_id: n.contacto_id ?? "",
      monto: n.monto?.toString() ?? "", moneda: n.moneda,
      zona: n.zona ?? "", tipo_propiedad: n.tipo_propiedad ?? "",
      descripcion: n.descripcion ?? "",
      fecha_cierre_estimada: n.fecha_cierre_estimada ?? "",
    });
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!userId || !form.titulo) return;
    setGuardando(true);
    const datos = {
      perfil_id: userId,
      titulo: form.titulo, tipo: form.tipo, etapa: form.etapa,
      contacto_id: form.contacto_id || null,
      monto: form.monto ? parseFloat(form.monto) : null,
      moneda: form.moneda,
      zona: form.zona || null,
      tipo_propiedad: form.tipo_propiedad || null,
      descripcion: form.descripcion || null,
      fecha_cierre_estimada: form.fecha_cierre_estimada || null,
      updated_at: new Date().toISOString(),
    };
    if (editandoId) {
      await supabase.from("crm_negocios").update(datos).eq("id", editandoId);
    } else {
      await supabase.from("crm_negocios").insert(datos);
    }
    setGuardando(false);
    setMostrarForm(false);
    if (userId) cargarNegocios(userId);
  };

  const cambiarEtapa = async (id: string, etapa: string) => {
    await supabase.from("crm_negocios").update({ etapa, updated_at: new Date().toISOString() }).eq("id", id);
    if (userId) cargarNegocios(userId);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este negocio?")) return;
    await supabase.from("crm_negocios").delete().eq("id", id);
    if (userId) cargarNegocios(userId);
  };

  const negociosPorEtapa = useMemo(() => {
    const mapa: Record<string, Negocio[]> = {};
    ETAPAS.forEach(e => { mapa[e.id] = []; });
    negocios.forEach(n => { if (mapa[n.etapa]) mapa[n.etapa].push(n); });
    return mapa;
  }, [negocios]);

  const totalMonto = negocios
    .filter(n => n.etapa !== "perdido" && n.monto)
    .reduce((acc, n) => acc + (n.monto ?? 0), 0);

  const activos = negocios.filter(n => n.etapa !== "cerrado" && n.etapa !== "perdido").length;
  const cerrados = negocios.filter(n => n.etapa === "cerrado").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .neg-wrap { display: flex; flex-direction: column; gap: 16px; height: calc(100vh - 70px); overflow: hidden; }
        .neg-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 0; flex-shrink: 0; }
        .neg-titulo { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .neg-titulo span { color: #cc0000; }
        .neg-stats { display: flex; gap: 16px; flex-wrap: wrap; }
        .neg-stat { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 8px 14px; text-align: center; }
        .neg-stat-val { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; }
        .neg-stat-label { font-size: 9px; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; letter-spacing: 0.1em; text-transform: uppercase; }
        .neg-acciones { display: flex; gap: 8px; align-items: center; }
        .neg-vista-btn { padding: 6px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.4); font-size: 11px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .neg-vista-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.08); color: #fff; }
        .neg-btn-nuevo { padding: 8px 16px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        /* Kanban */
        .neg-kanban { display: flex; gap: 12px; overflow-x: auto; flex: 1; padding-bottom: 8px; }
        .neg-kanban::-webkit-scrollbar { height: 4px; }
        .neg-kanban::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        .neg-col { min-width: 220px; width: 220px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
        .neg-col-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: rgba(14,14,14,0.9); border-radius: 6px; border: 1px solid rgba(255,255,255,0.07); }
        .neg-col-titulo { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .neg-col-count { font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
        .neg-col-items { display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; }
        .neg-col-items::-webkit-scrollbar { width: 2px; }
        .neg-card { background: #111; border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 12px; cursor: pointer; transition: all 0.15s; }
        .neg-card:hover { border-color: rgba(200,0,0,0.25); transform: translateY(-1px); }
        .neg-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .neg-card-contacto { font-size: 10px; color: rgba(255,255,255,0.4); margin-bottom: 6px; }
        .neg-card-monto { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 800; color: #22c55e; margin-bottom: 6px; }
        .neg-card-meta { display: flex; gap: 6px; flex-wrap: wrap; }
        .neg-card-tag { font-size: 8px; padding: 2px 6px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
        .neg-card-acciones { display: flex; gap: 4px; margin-top: 8px; }
        .neg-card-btn { padding: 3px 8px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.35); font-size: 8px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; transition: all 0.1s; }
        .neg-card-btn:hover { border-color: rgba(200,0,0,0.3); color: #fff; }
        .neg-btn-add-col { padding: 8px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.2); font-size: 11px; text-align: center; cursor: pointer; transition: all 0.15s; }
        .neg-btn-add-col:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.5); }
        /* Lista */
        .neg-lista-wrap { flex: 1; overflow-y: auto; }
        .neg-tabla { width: 100%; border-collapse: collapse; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .neg-tabla th { padding: 10px 14px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .neg-tabla td { padding: 12px 14px; font-size: 12px; color: rgba(255,255,255,0.7); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .neg-tabla tr:last-child td { border-bottom: none; }
        .neg-tabla tr:hover td { background: rgba(255,255,255,0.02); }
        .neg-etapa-select { padding: 4px 8px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; outline: none; }
        /* Modal */
        .neg-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: flex-start; justify-content: center; z-index: 300; padding: 24px; overflow-y: auto; }
        .neg-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 8px; padding: 28px 32px; width: 100%; max-width: 520px; margin: auto; position: relative; }
        .neg-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .neg-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 18px; }
        .neg-modal-titulo span { color: #cc0000; }
        .neg-field { margin-bottom: 11px; }
        .neg-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .neg-input { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; }
        .neg-input:focus { border-color: rgba(200,0,0,0.4); }
        .neg-input::placeholder { color: rgba(255,255,255,0.2); }
        .neg-select { width: 100%; padding: 8px 11px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .neg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .neg-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 12px 0; }
        .neg-etapas-selector { display: flex; gap: 5px; flex-wrap: wrap; }
        .neg-etapa-btn { padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .neg-etapa-btn.activo { color: #fff; }
        .neg-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
        .neg-btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        .neg-btn-save { padding: 8px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        .neg-btn-save:disabled { opacity: 0.5; }
        .neg-spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .neg-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }
      `}</style>

      <div className="neg-wrap">

        {/* Header */}
        <div className="neg-header">
          <div>
            <div className="neg-titulo">Negocios <span>GFI®</span></div>
          </div>
          <div className="neg-stats">
            <div className="neg-stat">
              <div className="neg-stat-val">{activos}</div>
              <div className="neg-stat-label">Activos</div>
            </div>
            <div className="neg-stat">
              <div className="neg-stat-val" style={{color:"#22c55e"}}>{cerrados}</div>
              <div className="neg-stat-label">Cerrados</div>
            </div>
            <div className="neg-stat">
              <div className="neg-stat-val" style={{color:"#eab308",fontSize:13}}>
                USD {totalMonto.toLocaleString("es-AR")}
              </div>
              <div className="neg-stat-label">En pipeline</div>
            </div>
          </div>
          <div className="neg-acciones">
            <button className={`neg-vista-btn${vista === "kanban" ? " activo" : ""}`} onClick={() => setVista("kanban")}>Kanban</button>
            <button className={`neg-vista-btn${vista === "lista" ? " activo" : ""}`} onClick={() => setVista("lista")}>Lista</button>
            <button className="neg-btn-nuevo" onClick={() => abrirFormNuevo()}>+ Nuevo negocio</button>
          </div>
        </div>

        {loading ? (
          <div className="neg-empty">Cargando...</div>
        ) : vista === "kanban" ? (
          <div className="neg-kanban">
            {ETAPAS.map(etapa => {
              const cards = negociosPorEtapa[etapa.id] ?? [];
              return (
                <div key={etapa.id} className="neg-col">
                  <div className="neg-col-header">
                    <span className="neg-col-titulo" style={{color: etapa.color}}>
                      {etapa.emoji} {etapa.label}
                    </span>
                    <span className="neg-col-count">{cards.length}</span>
                  </div>
                  <div className="neg-col-items">
                    {cards.map(n => (
                      <div key={n.id} className="neg-card" onClick={() => abrirFormEditar(n)}>
                        <div className="neg-card-titulo">{n.titulo}</div>
                        {n.crm_contactos && (
                          <div className="neg-card-contacto">
                            👤 {n.crm_contactos.apellido ?? ""} {n.crm_contactos.nombre}
                          </div>
                        )}
                        {n.monto && <div className="neg-card-monto">{formatPeso(n.monto, n.moneda)}</div>}
                        <div className="neg-card-meta">
                          {n.tipo && <span className="neg-card-tag">{n.tipo}</span>}
                          {n.tipo_propiedad && <span className="neg-card-tag">{n.tipo_propiedad}</span>}
                          {n.zona && <span className="neg-card-tag">📍 {n.zona}</span>}
                        </div>
                        <div className="neg-card-acciones" onClick={e => e.stopPropagation()}>
                          {ETAPAS.filter(e => e.id !== n.etapa && e.id !== "perdido").slice(0,3).map(e => (
                            <button key={e.id} className="neg-card-btn" onClick={() => cambiarEtapa(n.id, e.id)} title={`Mover a ${e.label}`}>
                              → {e.label}
                            </button>
                          ))}
                          <button className="neg-card-btn" style={{borderColor:"rgba(200,0,0,0.2)",color:"rgba(200,0,0,0.6)"}} onClick={() => eliminar(n.id)}>✗</button>
                        </div>
                      </div>
                    ))}
                    <div className="neg-btn-add-col" onClick={() => abrirFormNuevo(etapa.id)}>
                      + Agregar
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="neg-lista-wrap">
            {negocios.length === 0 ? (
              <div className="neg-empty">Sin negocios todavía. Hacé click en + Nuevo negocio.</div>
            ) : (
              <table className="neg-tabla">
                <thead>
                  <tr>
                    <th>Negocio</th>
                    <th>Contacto</th>
                    <th>Monto</th>
                    <th>Tipo</th>
                    <th>Etapa</th>
                    <th>Cierre est.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {negocios.map(n => {
                    const etapa = ETAPAS.find(e => e.id === n.etapa);
                    return (
                      <tr key={n.id}>
                        <td>
                          <div style={{fontWeight:600,color:"#fff",fontSize:13}}>{n.titulo}</div>
                          {n.zona && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>📍 {n.zona}</div>}
                        </td>
                        <td style={{color:"rgba(255,255,255,0.5)"}}>
                          {n.crm_contactos ? `${n.crm_contactos.apellido ?? ""} ${n.crm_contactos.nombre}` : "—"}
                        </td>
                        <td>
                          {n.monto ? <span style={{fontFamily:"Montserrat,sans-serif",fontWeight:700,color:"#22c55e"}}>{formatPeso(n.monto, n.moneda)}</span> : "—"}
                        </td>
                        <td style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"Montserrat,sans-serif",fontWeight:700,textTransform:"uppercase"}}>{n.tipo}</td>
                        <td>
                          <select
                            className="neg-etapa-select"
                            value={n.etapa}
                            style={{color: etapa?.color ?? "#fff"}}
                            onChange={e => { e.stopPropagation(); cambiarEtapa(n.id, e.target.value); }}
                          >
                            {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.emoji} {e.label}</option>)}
                          </select>
                        </td>
                        <td style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>
                          {n.fecha_cierre_estimada
                            ? new Date(n.fecha_cierre_estimada).toLocaleDateString("es-AR", {day:"2-digit",month:"2-digit",year:"numeric"})
                            : "—"}
                        </td>
                        <td>
                          <div style={{display:"flex",gap:6}}>
                            <button className="neg-card-btn" onClick={() => abrirFormEditar(n)}>Editar</button>
                            <button className="neg-card-btn" style={{borderColor:"rgba(200,0,0,0.2)",color:"rgba(200,0,0,0.6)"}} onClick={() => eliminar(n.id)}>✗</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {mostrarForm && (
        <div className="neg-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="neg-modal">
            <div className="neg-modal-titulo">{editandoId ? "Editar" : "Nuevo"} <span>negocio</span></div>

            <div className="neg-field">
              <label className="neg-label">Título *</label>
              <input className="neg-input" value={form.titulo} onChange={e => setForm(p => ({...p, titulo: e.target.value}))} placeholder="Ej: Venta depto Fisherton" />
            </div>

            <div className="neg-field">
              <label className="neg-label">Etapa</label>
              <div className="neg-etapas-selector">
                {ETAPAS.map(e => (
                  <button key={e.id} className={`neg-etapa-btn${form.etapa === e.id ? " activo" : ""}`}
                    style={form.etapa === e.id ? {borderColor: e.color, background: `${e.color}18`} : {}}
                    onClick={() => setForm(p => ({...p, etapa: e.id}))}>
                    {e.emoji} {e.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="neg-row">
              <div className="neg-field">
                <label className="neg-label">Tipo</label>
                <select className="neg-select" value={form.tipo} onChange={e => setForm(p => ({...p, tipo: e.target.value}))}>
                  {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace("_"," ")}</option>)}
                </select>
              </div>
              <div className="neg-field">
                <label className="neg-label">Contacto</label>
                <select className="neg-select" value={form.contacto_id} onChange={e => setForm(p => ({...p, contacto_id: e.target.value}))}>
                  <option value="">Sin contacto</option>
                  {contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="neg-row">
              <div className="neg-field">
                <label className="neg-label">Monto</label>
                <input className="neg-input" type="number" value={form.monto} onChange={e => setForm(p => ({...p, monto: e.target.value}))} placeholder="150000" />
              </div>
              <div className="neg-field">
                <label className="neg-label">Moneda</label>
                <div style={{display:"flex",gap:6,marginTop:5}}>
                  {["USD","ARS"].map(m => (
                    <button key={m} type="button"
                      style={{padding:"7px 14px",borderRadius:3,border:`1px solid ${form.moneda===m?"#cc0000":"rgba(255,255,255,0.1)"}`,background:form.moneda===m?"rgba(200,0,0,0.1)":"transparent",color:form.moneda===m?"#fff":"rgba(255,255,255,0.4)",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer"}}
                      onClick={() => setForm(p => ({...p, moneda: m}))}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="neg-row">
              <div className="neg-field">
                <label className="neg-label">Tipo propiedad</label>
                <select className="neg-select" value={form.tipo_propiedad} onChange={e => setForm(p => ({...p, tipo_propiedad: e.target.value}))}>
                  <option value="">Sin especificar</option>
                  {TIPOS_PROP.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="neg-field">
                <label className="neg-label">Zona</label>
                <input className="neg-input" value={form.zona} onChange={e => setForm(p => ({...p, zona: e.target.value}))} placeholder="Fisherton, Rosario..." />
              </div>
            </div>

            <div className="neg-row">
              <div className="neg-field">
                <label className="neg-label">Fecha cierre estimada</label>
                <input type="date" className="neg-input" value={form.fecha_cierre_estimada} onChange={e => setForm(p => ({...p, fecha_cierre_estimada: e.target.value}))} />
              </div>
            </div>

            <div className="neg-field">
              <label className="neg-label">Descripción</label>
              <textarea className="neg-input" value={form.descripcion} onChange={e => setForm(p => ({...p, descripcion: e.target.value}))} rows={2} placeholder="Detalles del negocio..." style={{resize:"none"}} />
            </div>

            <div className="neg-modal-actions">
              <button className="neg-btn-cancel" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="neg-btn-save" onClick={guardar} disabled={guardando || !form.titulo}>
                {guardando ? <><span className="neg-spinner"/>Guardando...</> : editandoId ? "Guardar" : "Crear negocio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
