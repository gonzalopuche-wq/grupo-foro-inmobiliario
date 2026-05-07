"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Estado = "pendiente" | "confirmada" | "realizada" | "cancelada";
type Vista = "lista" | "calendario";

interface Visita {
  id: string;
  perfil_id: string;
  propiedad_id: string | null;
  contacto_id: string | null;
  fecha: string;
  hora: string;
  duracion_min: number;
  estado: Estado;
  notas: string | null;
  direccion: string | null;
  created_at: string;
  propiedad?: { titulo: string; direccion: string | null; tipo: string } | null;
  contacto?: { nombre: string; apellido: string | null; telefono: string | null } | null;
}

interface Propiedad { id: string; titulo: string; direccion: string | null; tipo: string; }
interface Contacto { id: string; nombre: string; apellido: string | null; telefono: string | null; }

const ESTADOS: Record<Estado, { label: string; color: string; bg: string }> = {
  pendiente:  { label: "Pendiente",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  confirmada: { label: "Confirmada", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  realizada:  { label: "Realizada",  color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  cancelada:  { label: "Cancelada",  color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const fmtFecha = (f: string) => {
  const d = new Date(f + "T12:00:00");
  const hoy = new Date(); const man = new Date(); man.setDate(man.getDate()+1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === man.toDateString()) return "Mañana";
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].slice(0,3)}`;
};

const isoHoy = () => new Date().toISOString().slice(0,10);

export default function VisitasPage() {
  const [userId, setUserId] = useState<string|null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<Estado|"todas">("todas");
  const [vista, setVista] = useState<Vista>("lista");
  const [mesActual, setMesActual] = useState(() => { const h = new Date(); return { y: h.getFullYear(), m: h.getMonth() }; });
  const [form, setForm] = useState({
    propiedad_id: "", contacto_id: "", fecha: isoHoy(), hora: "10:00",
    duracion_min: 30, estado: "pendiente" as Estado, notas: "", direccion: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  const cargar = async (uid: string) => {
    setLoading(true);
    const [{ data: v }, { data: p }, { data: c }] = await Promise.all([
      supabase.from("crm_visitas")
        .select("*, propiedad:cartera_propiedades(titulo,direccion,tipo), contacto:crm_contactos(nombre,apellido,telefono)")
        .eq("perfil_id", uid).order("fecha").order("hora"),
      supabase.from("cartera_propiedades").select("id,titulo,direccion,tipo").eq("perfil_id", uid).eq("estado","activa"),
      supabase.from("crm_contactos").select("id,nombre,apellido,telefono").eq("perfil_id", uid).order("apellido"),
    ]);
    setVisitas((v ?? []) as Visita[]);
    setPropiedades((p ?? []) as Propiedad[]);
    setContactos((c ?? []) as Contacto[]);
    setLoading(false);
  };

  const guardar = async () => {
    if (!userId || !form.fecha || !form.hora) return;
    setGuardando(true);
    const ins: any = {
      perfil_id: userId,
      propiedad_id: form.propiedad_id || null,
      contacto_id: form.contacto_id || null,
      fecha: form.fecha, hora: form.hora,
      duracion_min: form.duracion_min,
      estado: form.estado,
      notas: form.notas || null,
      direccion: form.direccion || null,
    };
    await supabase.from("crm_visitas").insert(ins);
    setModal(false);
    setForm({ propiedad_id: "", contacto_id: "", fecha: isoHoy(), hora: "10:00", duracion_min: 30, estado: "pendiente", notas: "", direccion: "" });
    await cargar(userId);
    setGuardando(false);
  };

  const cambiarEstado = async (id: string, estado: Estado) => {
    await supabase.from("crm_visitas").update({ estado }).eq("id", id);
    setVisitas(prev => prev.map(v => v.id === id ? { ...v, estado } : v));
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta visita?")) return;
    await supabase.from("crm_visitas").delete().eq("id", id);
    setVisitas(prev => prev.filter(v => v.id !== id));
  };

  const sf = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const filtradas = visitas.filter(v => filtroEstado === "todas" || v.estado === filtroEstado);

  // Estadísticas
  const hoy = isoHoy();
  const proximas = visitas.filter(v => v.fecha >= hoy && v.estado !== "cancelada").length;
  const realizadas = visitas.filter(v => v.estado === "realizada").length;
  const pendientes = visitas.filter(v => v.estado === "pendiente").length;

  // Calendario
  const primerDia = new Date(mesActual.y, mesActual.m, 1);
  const diasEnMes = new Date(mesActual.y, mesActual.m + 1, 0).getDate();
  const offsetInicio = primerDia.getDay();
  const visitasPorDia: Record<string, Visita[]> = {};
  visitas.forEach(v => {
    if (!visitasPorDia[v.fecha]) visitasPorDia[v.fecha] = [];
    visitasPorDia[v.fecha].push(v);
  });

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 0 64px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        .vis-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 18px;transition:border-color 0.15s;}
        .vis-card:hover{border-color:rgba(255,255,255,0.12);}
        .vis-chip{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-family:Montserrat,sans-serif;font-weight:700;}
        .vis-btn{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-family:Montserrat,sans-serif;font-size:11px;font-weight:700;transition:all 0.15s;}
        input,select,textarea{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;padding:10px 12px;font-size:13px;font-family:Inter,sans-serif;outline:none;width:100%;box-sizing:border-box;}
        input:focus,select:focus,textarea:focus{border-color:rgba(204,0,0,0.4);}
        select option{background:#1a1a1a;}
        label{font-size:11px;color:rgba(255,255,255,0.4);font-family:Montserrat,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:5px;}
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>CRM</div>
          <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>Visitas a Propiedades</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>Agendá y gestioná todos los showings</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
            {(["lista","calendario"] as Vista[]).map(v => (
              <button key={v} onClick={() => setVista(v)} className="vis-btn" style={{ background: vista === v ? "rgba(204,0,0,0.15)" : "transparent", color: vista === v ? "#ff6666" : "rgba(255,255,255,0.4)", padding: "6px 12px" }}>
                {v === "lista" ? "≡ Lista" : "▦ Mes"}
              </button>
            ))}
          </div>
          <button onClick={() => setModal(true)} className="vis-btn" style={{ background: "#cc0000", color: "#fff", padding: "9px 18px", fontSize: 12 }}>
            + Nueva visita
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Próximas", valor: proximas, color: "#3b82f6" },
          { label: "Pendientes de confirm.", valor: pendientes, color: "#f59e0b" },
          { label: "Realizadas", valor: realizadas, color: "#22c55e" },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 28, fontWeight: 800, color: s.color }}>{s.valor}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {(["todas","pendiente","confirmada","realizada","cancelada"] as const).map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)} className="vis-btn"
            style={{ background: filtroEstado === e ? (e === "todas" ? "rgba(255,255,255,0.1)" : ESTADOS[e]?.bg) : "rgba(255,255,255,0.03)", color: filtroEstado === e ? (e === "todas" ? "#fff" : ESTADOS[e]?.color) : "rgba(255,255,255,0.35)", border: `1px solid ${filtroEstado === e ? (e === "todas" ? "rgba(255,255,255,0.15)" : ESTADOS[e]?.color+"44") : "rgba(255,255,255,0.07)"}` }}>
            {e === "todas" ? "Todas" : ESTADOS[e].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.25)" }}>Cargando...</div>
      ) : vista === "calendario" ? (
        // ── VISTA CALENDARIO ──────────────────────────────────────
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button onClick={() => setMesActual(p => { const d = new Date(p.y, p.m-1); return { y: d.getFullYear(), m: d.getMonth() }; })} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 18, padding: "0 6px" }}>‹</button>
            <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff", fontSize: 14, flex: 1, textAlign: "center" }}>{MESES[mesActual.m]} {mesActual.y}</span>
            <button onClick={() => setMesActual(p => { const d = new Date(p.y, p.m+1); return { y: d.getFullYear(), m: d.getMonth() }; })} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 18, padding: "0 6px" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
            {["D","L","M","X","J","V","S"].map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "4px 0" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {Array.from({ length: offsetInicio }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: diasEnMes }).map((_, i) => {
              const dia = i + 1;
              const fStr = `${mesActual.y}-${String(mesActual.m+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
              const vDia = visitasPorDia[fStr] ?? [];
              const esHoy = fStr === hoy;
              return (
                <div key={dia} style={{ minHeight: 52, background: esHoy ? "rgba(204,0,0,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${esHoy ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.05)"}`, borderRadius: 6, padding: "4px 6px" }}>
                  <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: esHoy ? "#cc0000" : "rgba(255,255,255,0.4)", marginBottom: 2 }}>{dia}</div>
                  {vDia.slice(0,2).map(v => (
                    <div key={v.id} style={{ fontSize: 9, background: ESTADOS[v.estado].bg, color: ESTADOS[v.estado].color, borderRadius: 3, padding: "1px 4px", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.hora.slice(0,5)} {v.propiedad?.titulo ?? v.direccion ?? "Visita"}
                    </div>
                  ))}
                  {vDia.length > 2 && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>+{vDia.length-2}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 0", color: "rgba(255,255,255,0.2)", fontFamily: "Montserrat,sans-serif", fontSize: 13 }}>
          {filtroEstado === "todas" ? "Sin visitas agendadas. Creá la primera." : `Sin visitas en estado "${ESTADOS[filtroEstado].label}".`}
        </div>
      ) : (
        // ── VISTA LISTA ──────────────────────────────────────────
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtradas.map(v => {
            const est = ESTADOS[v.estado];
            const pasada = v.fecha < hoy;
            return (
              <div key={v.id} className="vis-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: pasada && v.estado === "pendiente" ? "#f59e0b" : "#fff" }}>
                        {fmtFecha(v.fecha)} · {v.hora.slice(0,5)}
                      </span>
                      <span className="vis-chip" style={{ background: est.bg, color: est.color }}>{est.label}</span>
                      {pasada && v.estado === "pendiente" && <span style={{ fontSize: 10, color: "#f59e0b", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>⚠ Vencida</span>}
                    </div>
                    {v.propiedad && (
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 3 }}>🏠 {v.propiedad.titulo}</div>
                    )}
                    {(v.direccion || v.propiedad?.direccion) && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>📍 {v.direccion || v.propiedad?.direccion}</div>
                    )}
                    {v.contacto && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span>👤 {v.contacto.nombre} {v.contacto.apellido ?? ""}</span>
                        {v.contacto.telefono && (
                          <a href={`https://wa.me/${v.contacto.telefono.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: "#22c55e", textDecoration: "none", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                            WhatsApp →
                          </a>
                        )}
                      </div>
                    )}
                    {v.notas && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6, fontStyle: "italic" }}>{v.notas}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {v.estado === "pendiente" && (
                        <button onClick={() => cambiarEstado(v.id, "confirmada")} className="vis-btn" style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", fontSize: 10 }}>✓ Confirmar</button>
                      )}
                      {v.estado === "confirmada" && (
                        <button onClick={() => cambiarEstado(v.id, "realizada")} className="vis-btn" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: 10 }}>✓ Realizada</button>
                      )}
                      {v.estado !== "cancelada" && v.estado !== "realizada" && (
                        <button onClick={() => cambiarEstado(v.id, "cancelada")} className="vis-btn" style={{ background: "rgba(107,114,128,0.08)", color: "rgba(255,255,255,0.3)", fontSize: 10 }}>Cancelar</button>
                      )}
                      <button onClick={() => eliminar(v.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{v.duracion_min} min</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nueva visita */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 20 }}>Nueva visita</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => sf("fecha", e.target.value)} />
                </div>
                <div>
                  <label>Hora</label>
                  <input type="time" value={form.hora} onChange={e => sf("hora", e.target.value)} />
                </div>
              </div>
              <div>
                <label>Propiedad</label>
                <select value={form.propiedad_id} onChange={e => sf("propiedad_id", e.target.value)}>
                  <option value="">— Sin propiedad vinculada —</option>
                  {propiedades.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                </select>
              </div>
              <div>
                <label>Dirección (si no hay propiedad vinculada)</label>
                <input value={form.direccion} onChange={e => sf("direccion", e.target.value)} placeholder="Ej: Córdoba 1540 piso 3" />
              </div>
              <div>
                <label>Contacto (cliente / potencial comprador)</label>
                <select value={form.contacto_id} onChange={e => sf("contacto_id", e.target.value)}>
                  <option value="">— Sin contacto vinculado —</option>
                  {contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>Duración (minutos)</label>
                  <select value={form.duracion_min} onChange={e => sf("duracion_min", Number(e.target.value))}>
                    {[15,30,45,60,90,120].map(m => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </div>
                <div>
                  <label>Estado inicial</label>
                  <select value={form.estado} onChange={e => sf("estado", e.target.value as Estado)}>
                    <option value="pendiente">Pendiente</option>
                    <option value="confirmada">Confirmada</option>
                  </select>
                </div>
              </div>
              <div>
                <label>Notas internas</label>
                <textarea value={form.notas} onChange={e => sf("notas", e.target.value)} rows={3} placeholder="Ej: Cliente viene con su pareja. Interesado en terraza." style={{ resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando || !form.fecha || !form.hora} style={{ flex: 2, padding: 12, background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: guardando ? 0.6 : 1 }}>
                {guardando ? "Guardando..." : "Agendar visita"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
