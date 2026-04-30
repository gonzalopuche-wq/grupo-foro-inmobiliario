"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

interface Negocio {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  titulo: string;
  tipo_operacion: string;
  etapa: string;
  descripcion: string | null;
  direccion: string | null;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  fecha_primer_contacto: string | null;
  fecha_visita: string | null;
  fecha_reserva: string | null;
  fecha_escritura: string | null;
  fecha_cierre: string | null;
  colega_id: string | null;
  split_pct: number | null;
  etiquetas: string[] | null;
  notas: string | null;
  archivado: boolean;
  created_at: string;
  updated_at: string;
}

interface Contacto { id: string; nombre: string; apellido: string; }

const ETAPAS = [
  { value: "prospecto",        label: "Prospecto",       color: "#6b7280" },
  { value: "contactado",       label: "Contactado",      color: "#3b82f6" },
  { value: "visita_coordinada",label: "Visita coord.",   color: "#8b5cf6" },
  { value: "visita_realizada", label: "Visita realizada",color: "#a78bfa" },
  { value: "oferta_enviada",   label: "Oferta enviada",  color: "#f59e0b" },
  { value: "negociacion",      label: "Negociación",     color: "#f97316" },
  { value: "reserva",          label: "Reserva",         color: "#06b6d4" },
  { value: "escritura",        label: "Escritura",       color: "#10b981" },
  { value: "cerrado",          label: "Cerrado ✓",       color: "#22c55e" },
  { value: "perdido",          label: "Perdido",         color: "#ef4444" },
];

const TIPOS_OP = [
  { value: "venta",             label: "Venta" },
  { value: "alquiler",          label: "Alquiler" },
  { value: "alquiler_temporal", label: "Alq. temporal" },
  { value: "loteo",             label: "Loteo" },
  { value: "otro",              label: "Otro" },
];

const FORM_VACIO = {
  titulo: "", tipo_operacion: "venta", etapa: "prospecto",
  descripcion: "", direccion: "", valor_operacion: "",
  moneda: "USD", honorarios_pct: "", notas: "",
  contacto_id: "", split_pct: "",
  fecha_primer_contacto: "", fecha_visita: "",
  fecha_reserva: "", fecha_escritura: "",
};

const fmtMoneda = (v: number | null, m: string) => {
  if (v == null) return "—";
  return `${m} ${v.toLocaleString("es-AR")}`;
};

const fmtFecha = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function CrmNegociosPage() {
  const [uid, setUid]             = useState<string | null>(null);
  const [negocios, setNegocios]   = useState<Negocio[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filtroEtapa, setFiltroEtapa]   = useState("");
  const [filtroTipo, setFiltroTipo]     = useState("");
  const [busqueda, setBusqueda]         = useState("");
  const [verArchivados, setVerArchivados] = useState(false);
  const [modal, setModal]     = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]     = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  const cargar = async (id: string) => {
    setLoading(true);
    const [{ data: n }, { data: c }] = await Promise.all([
      supabase.from("crm_negocios").select("*").eq("perfil_id", id).order("updated_at", { ascending: false }),
      supabase.from("crm_contactos").select("id, nombre, apellido").eq("perfil_id", id).order("apellido"),
    ]);
    setNegocios((n as Negocio[]) ?? []);
    setContactos((c as Contacto[]) ?? []);
    setLoading(false);
  };

  const negociosFiltrados = useMemo(() => {
    return negocios.filter(n => {
      if (n.archivado !== verArchivados) return false;
      if (filtroEtapa && n.etapa !== filtroEtapa) return false;
      if (filtroTipo  && n.tipo_operacion !== filtroTipo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!n.titulo.toLowerCase().includes(q) &&
            !(n.direccion ?? "").toLowerCase().includes(q) &&
            !(n.descripcion ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [negocios, filtroEtapa, filtroTipo, busqueda, verArchivados]);

  const stats = useMemo(() => {
    const activos = negocios.filter(n => !n.archivado);
    return {
      total:    activos.length,
      activos:  activos.filter(n => !["cerrado","perdido"].includes(n.etapa)).length,
      cerrados: activos.filter(n => n.etapa === "cerrado").length,
      valor:    activos.filter(n => n.etapa !== "perdido")
                       .reduce((s, n) => s + (n.valor_operacion ?? 0), 0),
    };
  }, [negocios]);

  const abrirNuevo = () => { setForm(FORM_VACIO); setEditId(null); setModal(true); };
  const abrirEditar = (n: Negocio) => {
    setForm({
      titulo: n.titulo, tipo_operacion: n.tipo_operacion, etapa: n.etapa,
      descripcion: n.descripcion ?? "", direccion: n.direccion ?? "",
      valor_operacion: n.valor_operacion != null ? String(n.valor_operacion) : "",
      moneda: n.moneda, honorarios_pct: n.honorarios_pct != null ? String(n.honorarios_pct) : "",
      notas: n.notas ?? "", contacto_id: n.contacto_id ?? "",
      split_pct: n.split_pct != null ? String(n.split_pct) : "",
      fecha_primer_contacto: n.fecha_primer_contacto ?? "",
      fecha_visita: n.fecha_visita ?? "",
      fecha_reserva: n.fecha_reserva ?? "",
      fecha_escritura: n.fecha_escritura ?? "",
    });
    setEditId(n.id);
    setModal(true);
  };

  const guardar = async () => {
    if (!form.titulo.trim() || !uid) return;
    setGuardando(true);
    const payload: Record<string, unknown> = {
      perfil_id: uid,
      titulo: form.titulo.trim(),
      tipo_operacion: form.tipo_operacion,
      etapa: form.etapa,
      descripcion: form.descripcion || null,
      direccion: form.direccion || null,
      valor_operacion: form.valor_operacion ? parseFloat(form.valor_operacion) : null,
      moneda: form.moneda,
      honorarios_pct: form.honorarios_pct ? parseFloat(form.honorarios_pct) : null,
      notas: form.notas || null,
      contacto_id: form.contacto_id || null,
      split_pct: form.split_pct ? parseFloat(form.split_pct) : null,
      fecha_primer_contacto: form.fecha_primer_contacto || null,
      fecha_visita: form.fecha_visita || null,
      fecha_reserva: form.fecha_reserva || null,
      fecha_escritura: form.fecha_escritura || null,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from("crm_negocios").update(payload).eq("id", editId);
    } else {
      payload.archivado = false;
      await supabase.from("crm_negocios").insert(payload);
    }
    setGuardando(false);
    setModal(false);
    showToast(editId ? "Negocio actualizado" : "Negocio creado");
    cargar(uid);
  };

  const avanzarEtapa = async (n: Negocio) => {
    const idx = ETAPAS.findIndex(e => e.value === n.etapa);
    if (idx < 0 || idx >= ETAPAS.length - 1) return;
    const nuevaEtapa = ETAPAS[idx + 1].value;
    await supabase.from("crm_negocios").update({
      etapa: nuevaEtapa,
      updated_at: new Date().toISOString(),
    }).eq("id", n.id);
    setNegocios(prev => prev.map(x => x.id === n.id ? { ...x, etapa: nuevaEtapa } : x));
    showToast(`→ ${ETAPAS[idx + 1].label}`);
  };

  const archivar = async (n: Negocio) => {
    if (!confirm(`¿${n.archivado ? "Desarchivar" : "Archivar"} "${n.titulo}"?`)) return;
    await supabase.from("crm_negocios").update({
      archivado: !n.archivado, updated_at: new Date().toISOString(),
    }).eq("id", n.id);
    showToast(n.archivado ? "Negocio desarchivado" : "Negocio archivado");
    cargar(uid!);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este negocio? Esta acción no se puede deshacer.")) return;
    await supabase.from("crm_negocios").delete().eq("id", id);
    setNegocios(prev => prev.filter(n => n.id !== id));
    showToast("Negocio eliminado");
  };

  const etapaInfo = (v: string) => ETAPAS.find(e => e.value === v) ?? ETAPAS[0];
  const tipoLabel = (v: string) => TIPOS_OP.find(t => t.value === v)?.label ?? v;
  const contactoNombre = (id: string | null) => {
    if (!id) return null;
    const c = contactos.find(x => x.id === id);
    return c ? `${c.nombre} ${c.apellido}` : null;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .n-wrap { max-width: 900px; display: flex; flex-direction: column; gap: 16px; }
        .n-stat { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 12px 16px; text-align: center; }
        .n-stat-n { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; }
        .n-stat-l { font-size: 10px; color: rgba(255,255,255,0.35); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 3px; }
        .n-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 16px; transition: border-color 0.15s; }
        .n-card:hover { border-color: rgba(255,255,255,0.14); }
        .n-input { width: 100%; padding: 9px 11px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; box-sizing: border-box; }
        .n-input:focus { border-color: rgba(200,0,0,0.5); }
        .n-select { width: 100%; padding: 9px 11px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; }
        .n-btn { padding: 8px 14px; border: none; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s; }
        .n-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .n-field { margin-bottom: 12px; }
        .n-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; font-family: 'Montserrat',sans-serif; }
        @media (max-width: 600px) {
          .n-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .n-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="n-wrap">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#fff" }}>
              Negocios <span style={{ color: "#cc0000" }}>CRM</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
              Pipeline de operaciones inmobiliarias
            </div>
          </div>
          <button className="n-btn" style={{ background: "#cc0000", color: "#fff" }} onClick={abrirNuevo}>
            + Nuevo negocio
          </button>
        </div>

        {/* Stats */}
        <div className="n-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {[
            { n: stats.total,    l: "Total", c: "#fff" },
            { n: stats.activos,  l: "Activos", c: "#3b82f6" },
            { n: stats.cerrados, l: "Cerrados", c: "#22c55e" },
            { n: `USD ${stats.valor.toLocaleString("es-AR")}`, l: "Valor pipeline", c: "#f59e0b" },
          ].map(s => (
            <div key={s.l} className="n-stat">
              <div className="n-stat-n" style={{ color: s.c, fontSize: typeof s.n === "string" ? 14 : 22 }}>{s.n}</div>
              <div className="n-stat-l">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="n-input" style={{ flex: 1, minWidth: 160 }} placeholder="Buscar negocio, dirección..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="n-select" style={{ width: 160 }} value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)}>
            <option value="">Todas las etapas</option>
            {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select className="n-select" style={{ width: 140 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPOS_OP.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button
            className="n-btn"
            style={{ background: verArchivados ? "rgba(107,114,128,0.25)" : "rgba(255,255,255,0.06)", color: verArchivados ? "#9ca3af" : "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={() => setVerArchivados(v => !v)}
          >
            {verArchivados ? "Ver activos" : "Archivados"}
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40, fontFamily: "Inter,sans-serif" }}>Cargando negocios...</div>
        ) : negociosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat,sans-serif" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🤝</div>
            <div style={{ fontWeight: 700 }}>No hay negocios{busqueda ? " que coincidan" : ""}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {negociosFiltrados.map(n => {
              const etapa = etapaInfo(n.etapa);
              const idxEtapa = ETAPAS.findIndex(e => e.value === n.etapa);
              const siguiente = ETAPAS[idxEtapa + 1];
              return (
                <div key={n.id} className="n-card">
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {/* Etapa dot */}
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: etapa.color, flexShrink: 0, marginTop: 5 }} />
                    {/* Contenido */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>{n.titulo}</span>
                        <span className="n-badge" style={{ background: `${etapa.color}20`, color: etapa.color, border: `1px solid ${etapa.color}40` }}>{etapa.label}</span>
                        <span className="n-badge" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>{tipoLabel(n.tipo_operacion)}</span>
                      </div>
                      <div className="n-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "4px 16px", marginTop: 8 }}>
                        {n.direccion && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>📍 {n.direccion}</span>}
                        {n.valor_operacion != null && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>💰 {fmtMoneda(n.valor_operacion, n.moneda)}</span>}
                        {contactoNombre(n.contacto_id) && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>👤 {contactoNombre(n.contacto_id)}</span>}
                        {n.honorarios_pct != null && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>📊 {n.honorarios_pct}% honorarios</span>}
                        {fmtFecha(n.fecha_visita) && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>🏠 Visita: {fmtFecha(n.fecha_visita)}</span>}
                        {fmtFecha(n.fecha_reserva) && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>📋 Reserva: {fmtFecha(n.fecha_reserva)}</span>}
                      </div>
                      {n.descripcion && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6, fontFamily: "Inter,sans-serif" }}>{n.descripcion}</div>}
                    </div>
                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {siguiente && !["cerrado","perdido"].includes(n.etapa) && (
                        <button className="n-btn" style={{ background: `${siguiente.color}15`, color: siguiente.color, border: `1px solid ${siguiente.color}35`, padding: "5px 10px", fontSize: 10 }}
                          onClick={() => avanzarEtapa(n)}>
                          → {siguiente.label}
                        </button>
                      )}
                      <button className="n-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", padding: "5px 10px", fontSize: 10 }}
                        onClick={() => abrirEditar(n)}>Editar</button>
                      <button className="n-btn" style={{ background: "rgba(107,114,128,0.12)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.25)", padding: "5px 10px", fontSize: 10 }}
                        onClick={() => archivar(n)}>{n.archivado ? "Desarchivar" : "Archivar"}</button>
                      <button className="n-btn" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", padding: "5px 10px", fontSize: 10 }}
                        onClick={() => eliminar(n.id)}>×</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 24, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 20 }}>
              {editId ? "Editar negocio" : "Nuevo negocio"}
            </div>

            <div className="n-field">
              <label className="n-label">Título *</label>
              <input className="n-input" placeholder="Ej: Depto 3A Palermo - Venta" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="n-field">
                <label className="n-label">Tipo operación</label>
                <select className="n-select" value={form.tipo_operacion} onChange={e => setForm(f => ({ ...f, tipo_operacion: e.target.value }))}>
                  {TIPOS_OP.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="n-field">
                <label className="n-label">Etapa</label>
                <select className="n-select" value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}>
                  {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>

            <div className="n-field">
              <label className="n-label">Dirección</label>
              <input className="n-input" placeholder="Ej: Av. Corrientes 1234, CABA" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: 12 }}>
              <div className="n-field">
                <label className="n-label">Valor operación</label>
                <input className="n-input" type="number" placeholder="0" value={form.valor_operacion} onChange={e => setForm(f => ({ ...f, valor_operacion: e.target.value }))} />
              </div>
              <div className="n-field">
                <label className="n-label">Moneda</label>
                <select className="n-select" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div className="n-field">
                <label className="n-label">Honorarios %</label>
                <input className="n-input" type="number" step="0.5" placeholder="3" value={form.honorarios_pct} onChange={e => setForm(f => ({ ...f, honorarios_pct: e.target.value }))} />
              </div>
            </div>

            <div className="n-field">
              <label className="n-label">Contacto vinculado</label>
              <select className="n-select" value={form.contacto_id} onChange={e => setForm(f => ({ ...f, contacto_id: e.target.value }))}>
                <option value="">— Sin contacto —</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="n-field">
                <label className="n-label">Primer contacto</label>
                <input className="n-input" type="date" value={form.fecha_primer_contacto} onChange={e => setForm(f => ({ ...f, fecha_primer_contacto: e.target.value }))} />
              </div>
              <div className="n-field">
                <label className="n-label">Fecha visita</label>
                <input className="n-input" type="date" value={form.fecha_visita} onChange={e => setForm(f => ({ ...f, fecha_visita: e.target.value }))} />
              </div>
              <div className="n-field">
                <label className="n-label">Fecha reserva</label>
                <input className="n-input" type="date" value={form.fecha_reserva} onChange={e => setForm(f => ({ ...f, fecha_reserva: e.target.value }))} />
              </div>
              <div className="n-field">
                <label className="n-label">Fecha escritura</label>
                <input className="n-input" type="date" value={form.fecha_escritura} onChange={e => setForm(f => ({ ...f, fecha_escritura: e.target.value }))} />
              </div>
            </div>

            <div className="n-field">
              <label className="n-label">Descripción</label>
              <textarea className="n-input" rows={2} style={{ resize: "vertical" }} placeholder="Detalles del inmueble u operación..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div className="n-field">
              <label className="n-label">Notas internas</label>
              <textarea className="n-input" rows={2} style={{ resize: "vertical" }} placeholder="Notas privadas..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button className="n-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }} onClick={() => setModal(false)}>Cancelar</button>
              <button className="n-btn" style={{ background: "#cc0000", color: "#fff", opacity: guardando ? 0.6 : 1 }} onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando..." : editId ? "Actualizar" : "Crear negocio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 20px", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}
    </>
  );
}
