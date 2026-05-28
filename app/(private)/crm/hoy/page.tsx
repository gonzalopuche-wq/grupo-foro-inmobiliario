"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  fecha_vencimiento: string | null;
  contacto_id: string | null;
  contacto?: { nombre: string; apellido: string } | null;
}

interface Recordatorio {
  id: string;
  titulo: string | null;
  descripcion: string;
  fecha_recordatorio: string;
  completado: boolean;
  contacto_id: string | null;
  contacto?: { nombre: string; apellido: string } | null;
}

interface HitoUrgente {
  id: string;
  tipo: string;
  fecha: string;
  completado: boolean;
  negocio_id: string;
  negocio?: { titulo: string } | null;
}

interface LeadCaliente {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  ultima_interaccion: string | null;
  etapa_negocio: string | null;
  negocio_id: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const hoy = () => new Date().toISOString().slice(0, 10);
const manana = () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
const enNDias = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const fmtHora = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
};

const DIAS_SEMANA = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MESES_CORTO = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

const PRIORIDAD_COLOR: Record<string, string> = {
  alta:   "#ef4444",
  media:  "#f59e0b",
  baja:   "#3b82f6",
};

const TIPO_HITO_ICON: Record<string, string> = {
  reserva: "📝", boleto: "📋", escritura: "⚖️", posesion: "🔑", liquidacion: "💰", otro: "📌",
};

const ETAPA_COLOR: Record<string, string> = {
  reserva: "#06b6d4", escritura: "#10b981", negociacion: "#f97316",
  oferta_enviada: "#f59e0b", visita_realizada: "#a78bfa",
};

// ── componente ────────────────────────────────────────────────────────────────
export default function CrmHoyPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [hitos, setHitos] = useState<HitoUrgente[]>([]);
  const [leads, setLeads] = useState<LeadCaliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [hora, setHora] = useState(() => new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setHora(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  const cargar = async (userId: string) => {
    setLoading(true);
    const hoyStr   = hoy();
    const manStr   = manana();
    const en7Str   = enNDias(7);

    const [
      { data: tars },
      { data: recs },
      { data: hts },
      { data: ctcs },
      { data: ints },
      { data: negs },
    ] = await Promise.all([
      // Tareas vencidas o que vencen hoy/mañana
      supabase.from("crm_tareas")
        .select("id,titulo,descripcion,estado,prioridad,fecha_vencimiento,contacto_id, contacto:crm_contactos(nombre,apellido)")
        .eq("perfil_id", userId)
        .neq("estado", "completada")
        .lte("fecha_vencimiento", manStr)
        .order("fecha_vencimiento"),
      // Recordatorios de hoy y próximos 3 días
      supabase.from("crm_recordatorios")
        .select("id,titulo,descripcion,fecha_recordatorio,completado,contacto_id, contacto:crm_contactos(nombre,apellido)")
        .eq("perfil_id", userId)
        .eq("completado", false)
        .lte("fecha_recordatorio", enNDias(3))
        .order("fecha_recordatorio"),
      // Hitos próximos 7 días
      supabase.from("crm_escritura_hitos")
        .select("id,tipo,fecha,completado,negocio_id, negocio:crm_negocios(titulo)")
        .eq("perfil_id", userId)
        .eq("completado", false)
        .lte("fecha", en7Str)
        .gte("fecha", hoyStr)
        .order("fecha"),
      // Contactos activos
      supabase.from("crm_contactos")
        .select("id,nombre,apellido,telefono,email")
        .eq("perfil_id", userId)
        .eq("estado", "activo")
        .limit(100),
      // Última interacción de cada contacto
      supabase.from("crm_interacciones")
        .select("contacto_id,created_at")
        .eq("perfil_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),
      // Negocios activos calientes
      supabase.from("crm_negocios")
        .select("id,contacto_id,etapa,updated_at")
        .eq("perfil_id", userId)
        .eq("archivado", false)
        .in("etapa", ["reserva","escritura","negociacion","oferta_enviada","visita_realizada"])
        .order("updated_at", { ascending: false }),
    ]);

    setTareas((tars ?? []) as unknown as Tarea[]);
    setRecordatorios((recs ?? []) as unknown as Recordatorio[]);
    setHitos((hts ?? []) as unknown as HitoUrgente[]);

    // ── Calcular leads calientes ──────────────────────────────────────────
    const ctcList = (ctcs ?? []) as { id: string; nombre: string; apellido: string; telefono: string | null; email: string | null }[];
    const intList = (ints ?? []) as { contacto_id: string; created_at: string }[];
    const negList = (negs ?? []) as { id: string; contacto_id: string | null; etapa: string }[];

    // Última interacción por contacto
    const ultimaInt = new Map<string, string>();
    intList.forEach(i => { if (!ultimaInt.has(i.contacto_id)) ultimaInt.set(i.contacto_id, i.created_at); });

    // Negocio caliente por contacto
    const negPorCont = new Map<string, typeof negList[0]>();
    negList.forEach(n => { if (n.contacto_id && !negPorCont.has(n.contacto_id)) negPorCont.set(n.contacto_id, n); });

    // Leads: contactos activos sin interacción en >7 días o con negocio caliente
    const leadsCalientes: LeadCaliente[] = ctcList
      .filter(c => {
        const last = ultimaInt.get(c.id);
        const diasSin = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : 999;
        const tieneNeg = negPorCont.has(c.id);
        return tieneNeg || diasSin > 7;
      })
      .sort((a, b) => {
        const negA = negPorCont.has(a.id) ? 0 : 1;
        const negB = negPorCont.has(b.id) ? 0 : 1;
        if (negA !== negB) return negA - negB;
        const lastA = ultimaInt.get(a.id) ?? "0";
        const lastB = ultimaInt.get(b.id) ?? "0";
        return lastA.localeCompare(lastB);
      })
      .slice(0, 8)
      .map(c => {
        const neg = negPorCont.get(c.id);
        return {
          id: c.id,
          nombre: c.nombre,
          apellido: c.apellido,
          telefono: c.telefono,
          email: c.email,
          ultima_interaccion: ultimaInt.get(c.id) ?? null,
          etapa_negocio: neg?.etapa ?? null,
          negocio_id: neg?.id ?? null,
        };
      });
    setLeads(leadsCalientes);
    setLoading(false);
  };

  const completarTarea = async (id: string) => {
    if (!uid) return;
    await supabase.from("crm_tareas").update({ estado: "completada", updated_at: new Date().toISOString() }).eq("id", id);
    setTareas(prev => prev.filter(t => t.id !== id));
    showToast("Tarea completada ✓");
  };

  const completarRecordatorio = async (id: string) => {
    if (!uid) return;
    await supabase.from("crm_recordatorios").update({ completado: true, estado: "completado" }).eq("id", id);
    setRecordatorios(prev => prev.filter(r => r.id !== id));
    showToast("Recordatorio completado ✓");
  };

  const registrarInteraccion = async (contactoId: string, tipo: string) => {
    if (!uid) return;
    await supabase.from("crm_interacciones").insert({
      contacto_id: contactoId, perfil_id: uid, tipo,
      descripcion: `Contacto por ${tipo}`, created_at: new Date().toISOString(),
    });
    showToast(`${tipo} registrado`);
    setLeads(prev => prev.filter(l => l.id !== contactoId));
  };

  // ── fecha ──────────────────────────────────────────────────────────────────
  const fechaHoy = useMemo(() => {
    const d = new Date();
    return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  const diasHastaHito = (fecha: string) => {
    const d = Math.floor((new Date(fecha).getTime() - Date.now()) / 86400000);
    if (d <= 0) return <span style={{ color: "#ef4444", fontWeight: 700 }}>HOY</span>;
    if (d === 1) return <span style={{ color: "#f59e0b", fontWeight: 700 }}>mañana</span>;
    return <span style={{ color: "rgba(255,255,255,0.45)" }}>en {d}d</span>;
  };

  const diasSinContacto = (iso: string | null) => {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  };

  const total = tareas.length + recordatorios.length + hitos.length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .hoy-card { background:rgba(14,14,14,0.9); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:16px; }
        .hoy-btn { padding:5px 10px; border:none; border-radius:4px; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; letter-spacing:0.07em; cursor:pointer; transition:opacity 0.15s; white-space:nowrap; }
        .hoy-section { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.3); font-family:'Montserrat',sans-serif; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; }
        .hoy-item { display:flex; gap:10px; align-items:flex-start; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
        .hoy-item:last-child { border-bottom:none; }
        .hoy-check { width:20px; height:20px; border-radius:4px; border:2px solid rgba(255,255,255,0.2); background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; font-size:11px; color:#fff; transition:all 0.15s; }
        .hoy-check:hover { border-color:#22c55e; background:rgba(34,197,94,0.1); }
        @media(max-width:700px){.hoy-cols{flex-direction:column!important;}}
      `}</style>

      <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Header con fecha y hora ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>
              Buenos días <span style={{ color: "#cc0000" }}>🌅</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", marginTop: 3 }}>
              {fechaHoy} · {hora}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {total > 0 && (
              <div style={{ padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 20, fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "#ef4444" }}>
                {total} pendiente{total !== 1 ? "s" : ""}
              </div>
            )}
            <button onClick={() => uid && cargar(uid)}
              style={{ padding: "8px 14px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: "pointer" }}>
              ↻ Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 48, fontFamily: "Inter,sans-serif" }}>Cargando tu agenda...</div>
        ) : (
          <div className="hoy-cols" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

            {/* ── Columna izquierda ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Tareas urgentes */}
              <div className="hoy-card">
                <div className="hoy-section">
                  <span>✅ Tareas urgentes ({tareas.length})</span>
                  <Link href="/crm/tareas" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontFamily: "Montserrat,sans-serif" }}>Ver todas ↗</Link>
                </div>
                {tareas.length === 0 ? (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", textAlign: "center", padding: "12px 0" }}>Sin tareas urgentes 🎉</div>
                ) : tareas.map(t => {
                  const venciday = t.fecha_vencimiento && t.fecha_vencimiento < hoy();
                  const venceHoy = t.fecha_vencimiento === hoy();
                  return (
                    <div key={t.id} className="hoy-item">
                      <button className="hoy-check" onClick={() => completarTarea(t.id)}>✓</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff" }}>{t.titulo}</span>
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 8, fontFamily: "Montserrat,sans-serif", fontWeight: 700, background: `${PRIORIDAD_COLOR[t.prioridad] ?? "#6b7280"}18`, color: PRIORIDAD_COLOR[t.prioridad] ?? "#6b7280", border: `1px solid ${PRIORIDAD_COLOR[t.prioridad] ?? "#6b7280"}35` }}>
                            {t.prioridad}
                          </span>
                          {venciday && <span style={{ fontSize: 10, color: "#ef4444", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>⚠ Vencida</span>}
                          {venceHoy && !venciday && <span style={{ fontSize: 10, color: "#f59e0b", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>Vence hoy</span>}
                        </div>
                        {t.contacto && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>👤 {(t.contacto as { nombre: string; apellido: string }).nombre} {(t.contacto as { nombre: string; apellido: string }).apellido}</div>}
                        {t.descripcion && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>{t.descripcion}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recordatorios */}
              <div className="hoy-card">
                <div className="hoy-section">
                  <span>🔔 Recordatorios próximos ({recordatorios.length})</span>
                  <Link href="/crm/recordatorios" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontFamily: "Montserrat,sans-serif" }}>Ver todos ↗</Link>
                </div>
                {recordatorios.length === 0 ? (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", textAlign: "center", padding: "12px 0" }}>Sin recordatorios pendientes</div>
                ) : recordatorios.map(r => {
                  const venc = r.fecha_recordatorio.slice(0, 10);
                  const esHoy = venc === hoy();
                  const pasado = venc < hoy();
                  const ctc = r.contacto as { nombre: string; apellido: string } | null;
                  return (
                    <div key={r.id} className="hoy-item">
                      <button className="hoy-check" onClick={() => completarRecordatorio(r.id)}>✓</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontFamily: "Inter,sans-serif", color: "#fff", lineHeight: 1.4 }}>{r.titulo || r.descripcion}</div>
                        <div style={{ fontSize: 11, marginTop: 3, fontFamily: "Inter,sans-serif" }}>
                          {ctc && <span style={{ color: "rgba(255,255,255,0.35)", marginRight: 8 }}>👤 {ctc.nombre} {ctc.apellido}</span>}
                          <span style={{ color: pasado ? "#ef4444" : esHoy ? "#f59e0b" : "rgba(255,255,255,0.35)", fontWeight: pasado || esHoy ? 700 : 400 }}>
                            {pasado ? "⚠ Vencido" : esHoy ? "🔔 Hoy" : fmtHora(r.fecha_recordatorio)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hitos urgentes */}
              {hitos.length > 0 && (
                <div className="hoy-card" style={{ border: "1px solid rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.03)" }}>
                  <div className="hoy-section">
                    <span style={{ color: "#06b6d4" }}>⚖️ Hitos próximos 7 días ({hitos.length})</span>
                    <Link href="/crm/escrituras" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontFamily: "Montserrat,sans-serif" }}>Ver todos ↗</Link>
                  </div>
                  {hitos.map(h => {
                    const neg = h.negocio as { titulo: string } | null;
                    return (
                      <div key={h.id} className="hoy-item">
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{TIPO_HITO_ICON[h.tipo] ?? "📌"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff" }}>{h.tipo.charAt(0).toUpperCase() + h.tipo.slice(1)}</div>
                          {neg && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>🤝 {neg.titulo}</div>}
                          <div style={{ fontSize: 11, marginTop: 2, fontFamily: "Inter,sans-serif" }}>
                            {h.fecha.slice(0, 10)} · {diasHastaHito(h.fecha + "T12:00:00")}
                          </div>
                        </div>
                        <Link href={`/crm/negocios/${h.negocio_id}`} style={{ padding: "4px 10px", borderRadius: 4, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textDecoration: "none" }}>↗</Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Columna derecha: leads a contactar ── */}
            <div style={{ flex: "0 0 320px", display: "flex", flexDirection: "column", gap: 14 }}>

              <div className="hoy-card">
                <div className="hoy-section">
                  <span>🎯 Contactar hoy ({leads.length})</span>
                  <Link href="/crm/seguimiento" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textDecoration: "none", fontFamily: "Montserrat,sans-serif" }}>Scoring ↗</Link>
                </div>
                {leads.length === 0 ? (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", textAlign: "center", padding: "20px 0" }}>
                    Sin leads prioritarios. Buen trabajo! 🎉
                  </div>
                ) : leads.map(l => {
                  const dias = diasSinContacto(l.ultima_interaccion);
                  return (
                    <div key={l.id} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: l.etapa_negocio ? `${ETAPA_COLOR[l.etapa_negocio] ?? "#6b7280"}18` : "rgba(255,255,255,0.06)", border: `2px solid ${l.etapa_negocio ? (ETAPA_COLOR[l.etapa_negocio] ?? "#6b7280") + "50" : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 800, color: l.etapa_negocio ? (ETAPA_COLOR[l.etapa_negocio] ?? "#6b7280") : "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                          {l.nombre[0]}{l.apellido[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/crm/contactos/${l.id}`} style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none" }}>
                            {l.nombre} {l.apellido}
                          </Link>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                            {l.etapa_negocio && (
                              <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, fontFamily: "Montserrat,sans-serif", fontWeight: 700, background: `${ETAPA_COLOR[l.etapa_negocio] ?? "#6b7280"}15`, color: ETAPA_COLOR[l.etapa_negocio] ?? "#6b7280" }}>
                                {l.etapa_negocio.replace("_", " ")}
                              </span>
                            )}
                            {dias !== null && (
                              <span style={{ fontSize: 10, color: dias > 14 ? "#f59e0b" : "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>
                                {dias === 0 ? "Hoy" : dias === 1 ? "Ayer" : `Hace ${dias}d`}
                              </span>
                            )}
                            {dias === null && <span style={{ fontSize: 10, color: "#ef4444", fontFamily: "Inter,sans-serif" }}>Sin contacto</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {l.telefono && (
                          <>
                            <a href={`https://wa.me/${l.telefono.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                              onClick={() => registrarInteraccion(l.id, "whatsapp")}
                              style={{ flex: 1, padding: "6px 0", textAlign: "center", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 5, fontSize: 13, textDecoration: "none", cursor: "pointer" }}>
                              💬
                            </a>
                            <a href={`tel:${l.telefono}`}
                              onClick={() => registrarInteraccion(l.id, "llamada")}
                              style={{ flex: 1, padding: "6px 0", textAlign: "center", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 5, fontSize: 13, textDecoration: "none", cursor: "pointer" }}>
                              📞
                            </a>
                          </>
                        )}
                        {l.email && (
                          <a href={`mailto:${l.email}`}
                            onClick={() => registrarInteraccion(l.id, "email")}
                            style={{ flex: 1, padding: "6px 0", textAlign: "center", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 5, fontSize: 13, textDecoration: "none", cursor: "pointer" }}>
                            ✉️
                          </a>
                        )}
                        <button
                          onClick={() => registrarInteraccion(l.id, "nota")}
                          style={{ flex: 1, padding: "6px 0", textAlign: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, fontSize: 13, cursor: "pointer" }}>
                          ✓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Links rápidos */}
              <div className="hoy-card">
                <div className="hoy-section">Accesos rápidos</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { href: "/crm/negocios",       label: "🤝 Pipeline de negocios" },
                    { href: "/crm/contactos",       label: "👥 Contactos" },
                    { href: "/crm/seguimiento",     label: "🎯 Scoring de leads" },
                    { href: "/crm/conversion",      label: "📊 Análisis de conversión" },
                    { href: "/crm/reporte-mensual", label: "📋 Reporte mensual" },
                    { href: "/agenda",              label: "🗓️ Agenda completa" },
                  ].map(l => (
                    <Link key={l.href} href={l.href}
                      style={{ display: "block", padding: "9px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, fontSize: 12, fontFamily: "Inter,sans-serif", color: "rgba(255,255,255,0.55)", textDecoration: "none", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(204,0,0,0.06)"; e.currentTarget.style.color = "#cc0000"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 20px", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}
    </>
  );
}
