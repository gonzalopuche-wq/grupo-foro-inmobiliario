"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
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
  { value: "prospecto",        label: "Prospecto",        color: "var(--gfi-text-muted)",   badgeClass: "gfi-badge--gray"   },
  { value: "contactado",       label: "Contactado",       color: "#60a5fa",                 badgeClass: "gfi-badge--blue"   },
  { value: "visita_coordinada",label: "Visita coord.",    color: "#a78bfa",                 badgeClass: "gfi-badge--gray"   },
  { value: "visita_realizada", label: "Visita realizada", color: "#c084fc",                 badgeClass: "gfi-badge--gray"   },
  { value: "oferta_enviada",   label: "Oferta enviada",   color: "#f97316",                 badgeClass: "gfi-badge--orange" },
  { value: "negociacion",      label: "Negociación",      color: "#fb923c",                 badgeClass: "gfi-badge--orange" },
  { value: "reserva",          label: "Reserva",          color: "#22d3ee",                 badgeClass: "gfi-badge--blue"   },
  { value: "escritura",        label: "Escritura",        color: "var(--gfi-green-text)",   badgeClass: "gfi-badge--green"  },
  { value: "cerrado",          label: "Cerrado ✓",        color: "var(--gfi-green-text)",   badgeClass: "gfi-badge--green"  },
  { value: "perdido",          label: "Perdido",          color: "var(--gfi-red)",          badgeClass: "gfi-badge--red"    },
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
  const [vista, setVista]     = useState<"lista" | "kanban">("lista");

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      await cargar(data.user.id);
      if (new URLSearchParams(window.location.search).get("nuevo") === "1") abrirNuevo();
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
      etapa: nuevaEtapa, updated_at: new Date().toISOString(),
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
  const contactoNombre = (cid: string | null) => {
    if (!cid) return null;
    const c = contactos.find(x => x.id === cid);
    return c ? `${c.nombre} ${c.apellido}` : null;
  };

  return (
    <>
      <style>{`
        /* ── Negocios GFI ── */
        .neg-wrap { display: flex; flex-direction: column; gap: 16px; }

        /* Stats */
        .neg-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
        @media(max-width:600px){ .neg-stats { grid-template-columns: repeat(2,1fr) !important; } }
        .neg-stat {
          background: var(--gfi-bg-card); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg); padding: 14px 16px; text-align: center;
        }
        .neg-stat-n {
          font-family: var(--font-display); font-weight: 900; line-height: 1;
          letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
        }
        .neg-stat-l {
          font-size: 9px; color: var(--gfi-text-muted); font-family: var(--font-display);
          font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 6px;
        }

        /* List card */
        .neg-card {
          background: var(--gfi-bg-card); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg); padding: 15px 18px;
          transition: var(--gfi-transition);
        }
        .neg-card:hover { border-color: var(--gfi-border-bright); box-shadow: var(--gfi-shadow-sm); }

        /* Kanban */
        .neg-kanban-wrap { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 16px; }
        .neg-kanban-col { flex-shrink: 0; width: 210px; display: flex; flex-direction: column; gap: 8px; }
        .neg-kanban-header {
          padding: 7px 12px; border-radius: var(--gfi-radius-md) var(--gfi-radius-md) 0 0;
          font-family: var(--font-display); font-size: 9px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          display: flex; justify-content: space-between; align-items: center;
        }
        .neg-kanban-body { display: flex; flex-direction: column; gap: 6px; min-height: 50px; }
        .neg-kanban-card {
          background: var(--gfi-bg-elevated); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-md); padding: 11px 12px;
          cursor: pointer; transition: var(--gfi-transition);
        }
        .neg-kanban-card:hover { border-color: var(--gfi-border-bright); box-shadow: var(--gfi-shadow-sm); }

        /* Form input */
        .neg-input {
          width: 100%; padding: 9px 12px;
          background: var(--gfi-bg-input); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary);
          font-size: 13px; font-family: var(--font-body); outline: none;
          box-sizing: border-box; transition: var(--gfi-transition);
        }
        .neg-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px rgba(204,0,0,0.10); }
        .neg-input::placeholder { color: var(--gfi-text-muted); }
        .neg-label {
          display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 5px;
          font-family: var(--font-display);
        }
        .neg-field { margin-bottom: 13px; }

        /* Vista toggle */
        .neg-vista-btn {
          padding: 7px 14px;
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-md);
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em; cursor: pointer; transition: var(--gfi-transition);
        }
        .neg-vista-btn.on {
          background: var(--gfi-red-soft); border-color: var(--gfi-red-border); color: var(--gfi-red);
        }
        .neg-vista-btn:not(.on) {
          background: transparent; color: var(--gfi-text-muted);
        }
        .neg-vista-btn:not(.on):hover { color: var(--gfi-text-secondary); border-color: var(--gfi-border-bright); }

        /* Toast */
        .neg-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: var(--gfi-bg-elevated); border: 1px solid var(--gfi-border-bright);
          border-radius: var(--gfi-radius-md); padding: 11px 22px;
          color: var(--gfi-text-primary); font-family: var(--font-body); font-size: 13px;
          z-index: 9999; box-shadow: var(--gfi-shadow-md);
        }

        /* Empty */
        .neg-empty {
          text-align: center; padding: "40px 20px";
          color: var(--gfi-text-muted); font-family: var(--font-display);
          border: 1px dashed var(--gfi-border-subtle);
          border-radius: var(--gfi-radius-lg); padding: 44px 20px;
        }

        @media(max-width:600px){
          .neg-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="neg-wrap">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--gfi-text-primary)", letterSpacing: "-0.01em" }}>
              Negocios <span style={{ color: "var(--gfi-red)" }}>CRM</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--gfi-text-secondary)", marginTop: 2 }}>
              Pipeline de operaciones inmobiliarias
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className={`neg-vista-btn${vista === "lista" ? " on" : ""}`} onClick={() => setVista("lista")}>☰ Lista</button>
            <button className={`neg-vista-btn${vista === "kanban" ? " on" : ""}`} onClick={() => setVista("kanban")}>⬛ Kanban</button>
            <button className="gfi-btn gfi-btn--primary" onClick={abrirNuevo}>+ Nuevo negocio</button>
          </div>
        </div>

        {/* Stats */}
        <div className="neg-stats">
          {[
            { n: stats.total,    l: "Total",         c: "var(--gfi-text-primary)", size: 26 },
            { n: stats.activos,  l: "Activos",       c: "#60a5fa",                 size: 26 },
            { n: stats.cerrados, l: "Cerrados",      c: "var(--gfi-green-text)",   size: 26 },
            { n: `USD ${stats.valor.toLocaleString("es-AR")}`, l: "Valor pipeline", c: "var(--gfi-green-text)", size: 14 },
          ].map(s => (
            <div key={s.l} className="neg-stat">
              <div className="neg-stat-n gfi-mono" style={{ color: s.c, fontSize: s.size }}>{s.n}</div>
              <div className="neg-stat-l">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="gfi-filter-bar">
          <input
            className="neg-input"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Buscar negocio, dirección..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select className="neg-input" style={{ width: 160 }} value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)}>
            <option value="">Todas las etapas</option>
            {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select className="neg-input" style={{ width: 140 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPOS_OP.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button
            className={`gfi-filter-chip${verArchivados ? " active" : ""}`}
            onClick={() => setVerArchivados(v => !v)}
          >
            {verArchivados ? "Ver activos" : "Archivados"}
          </button>
        </div>

        {/* Vista Kanban */}
        {vista === "kanban" && !loading && (
          <div className="neg-kanban-wrap" style={{ maxWidth: "calc(100vw - 240px)" }}>
            {ETAPAS.filter(e => !["perdido"].includes(e.value) || negociosFiltrados.some(n => n.etapa === e.value)).map(etapa => {
              const columna = negociosFiltrados.filter(n => n.etapa === etapa.value && !n.archivado);
              const valorCol = columna.reduce((s, n) => s + (n.valor_operacion ?? 0), 0);
              const idxEtapa = ETAPAS.findIndex(e => e.value === etapa.value);
              const siguiente = ETAPAS[idxEtapa + 1];
              return (
                <div key={etapa.value} className="neg-kanban-col">
                  <div className="neg-kanban-header" style={{ background: `${etapa.color}15`, color: etapa.color, border: `1px solid ${etapa.color}30` }}>
                    <span>{etapa.label}</span>
                    <span style={{ background: `${etapa.color}25`, borderRadius: 10, padding: "1px 7px", fontSize: 9 }}>{columna.length}</span>
                  </div>
                  {valorCol > 0 && (
                    <div style={{ fontSize: 9, color: "var(--gfi-text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, textAlign: "center", padding: "2px 0" }}>
                      USD {Math.round(valorCol).toLocaleString("es-AR")}
                    </div>
                  )}
                  <div className="neg-kanban-body">
                    {columna.length === 0 && (
                      <div style={{ border: "1px dashed var(--gfi-border-subtle)", borderRadius: "var(--gfi-radius-md)", padding: "14px 10px", textAlign: "center", color: "var(--gfi-text-dim)", fontSize: 11 }}>
                        vacío
                      </div>
                    )}
                    {columna.map(n => (
                      <div key={n.id} className="neg-kanban-card" onClick={() => abrirEditar(n)}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, color: "var(--gfi-text-primary)", marginBottom: 6, lineHeight: 1.3 }}>{n.titulo}</div>
                        {n.valor_operacion != null && (
                          <div className="gfi-price-usd" style={{ fontSize: 11, marginBottom: 4 }}>
                            {fmtMoneda(n.valor_operacion, n.moneda)}
                          </div>
                        )}
                        {contactoNombre(n.contacto_id) && (
                          <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", marginBottom: 4 }}>👤 {contactoNombre(n.contacto_id)}</div>
                        )}
                        {n.direccion && (
                          <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {n.direccion}</div>
                        )}
                        <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                          {siguiente && !["cerrado","perdido"].includes(n.etapa) && (
                            <button
                              className="gfi-btn gfi-btn--secondary"
                              style={{ flex: 1, padding: "3px 0", fontSize: 9 }}
                              onClick={e => { e.stopPropagation(); avanzarEtapa(n); }}>
                              → {siguiente.label}
                            </button>
                          )}
                          <Link href={`/crm/negocios/${n.id}`}
                            onClick={e => e.stopPropagation()}
                            className="gfi-btn gfi-btn--ghost"
                            style={{ padding: "3px 8px", fontSize: 9 }}>
                            ↗
                          </Link>
                          <button
                            className="gfi-btn gfi-btn--secondary"
                            style={{ padding: "3px 8px", fontSize: 9, color: "var(--gfi-red)", borderColor: "var(--gfi-red-border)" }}
                            onClick={e => { e.stopPropagation(); eliminar(n.id); }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Vista Lista */}
        {vista === "lista" && (loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[1,2,3].map(i => (
              <div key={i} className="gfi-skeleton" style={{ height: 80, borderRadius: "var(--gfi-radius-lg)" }} />
            ))}
          </div>
        ) : negociosFiltrados.length === 0 ? (
          <div className="neg-empty">
            <div style={{ fontSize: 28, marginBottom: 10 }}>🤝</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>No hay negocios{busqueda ? " que coincidan" : ""}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {negociosFiltrados.map(n => {
              const etapa = etapaInfo(n.etapa);
              const idxEtapa = ETAPAS.findIndex(e => e.value === n.etapa);
              const siguiente = ETAPAS[idxEtapa + 1];
              return (
                <div key={n.id} className="neg-card">
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {/* Etapa indicator */}
                    <div style={{
                      width: 3, alignSelf: "stretch", flexShrink: 0, borderRadius: 4,
                      background: etapa.color,
                      minHeight: 40,
                    }} />
                    {/* Contenido */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--gfi-text-primary)" }}>{n.titulo}</span>
                        <span className={`gfi-badge ${etapa.badgeClass}`}>{etapa.label}</span>
                        <span className="gfi-badge gfi-badge--gray">{tipoLabel(n.tipo_operacion)}</span>
                      </div>
                      <div className="neg-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "3px 14px" }}>
                        {n.direccion && (
                          <span style={{ fontSize: 12, color: "var(--gfi-text-secondary)" }}>📍 {n.direccion}</span>
                        )}
                        {n.valor_operacion != null && (
                          <span className="gfi-price-usd" style={{ fontSize: 12 }}>
                            {fmtMoneda(n.valor_operacion, n.moneda)}
                          </span>
                        )}
                        {contactoNombre(n.contacto_id) && (
                          <span style={{ fontSize: 12, color: "var(--gfi-text-secondary)" }}>👤 {contactoNombre(n.contacto_id)}</span>
                        )}
                        {n.honorarios_pct != null && (
                          <span style={{ fontSize: 12, color: "var(--gfi-text-muted)", fontFamily: "var(--font-mono)" }}>{n.honorarios_pct}% honorarios</span>
                        )}
                        {fmtFecha(n.fecha_visita) && (
                          <span style={{ fontSize: 12, color: "var(--gfi-text-muted)", fontFamily: "var(--font-mono)" }}>Visita: {fmtFecha(n.fecha_visita)}</span>
                        )}
                        {fmtFecha(n.fecha_reserva) && (
                          <span style={{ fontSize: 12, color: "var(--gfi-text-muted)", fontFamily: "var(--font-mono)" }}>Reserva: {fmtFecha(n.fecha_reserva)}</span>
                        )}
                      </div>
                      {n.descripcion && (
                        <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 7 }}>{n.descripcion}</div>
                      )}
                    </div>
                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {siguiente && !["cerrado","perdido"].includes(n.etapa) && (
                        <button className="gfi-btn gfi-btn--secondary" style={{ color: etapa.color, borderColor: `${etapa.color}40`, padding: "5px 10px", fontSize: 9 }}
                          onClick={() => avanzarEtapa(n)}>
                          → {siguiente.label}
                        </button>
                      )}
                      <Link href={`/crm/negocios/${n.id}`} className="gfi-btn gfi-btn--ghost" style={{ padding: "5px 10px", fontSize: 9 }}>Ficha ↗</Link>
                      <button className="gfi-btn gfi-btn--secondary" style={{ padding: "5px 10px", fontSize: 9 }} onClick={() => abrirEditar(n)}>Editar</button>
                      <button className="gfi-btn gfi-btn--secondary" style={{ padding: "5px 10px", fontSize: 9, color: "var(--gfi-text-muted)" }} onClick={() => archivar(n)}>
                        {n.archivado ? "Desarchivar" : "Archivar"}
                      </button>
                      <button className="gfi-btn gfi-btn--secondary" style={{ padding: "5px 10px", fontSize: 9, color: "var(--gfi-red)", borderColor: "var(--gfi-red-border)" }} onClick={() => eliminar(n.id)}>×</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border)", borderRadius: "var(--gfi-radius-xl)", padding: 24, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", position: "relative", boxShadow: "var(--gfi-shadow-lg)" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--gfi-red-gradient)", borderRadius: "var(--gfi-radius-xl) var(--gfi-radius-xl) 0 0" }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "var(--gfi-text-primary)", marginBottom: 20 }}>
              {editId ? "Editar negocio" : <>Nuevo <span style={{ color: "var(--gfi-red)" }}>negocio</span></>}
            </div>

            <div className="neg-field">
              <label className="neg-label">Título *</label>
              <input className="neg-input" placeholder="Ej: Depto 3A Palermo - Venta" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="neg-field">
                <label className="neg-label">Tipo operación</label>
                <select className="neg-input" value={form.tipo_operacion} onChange={e => setForm(f => ({ ...f, tipo_operacion: e.target.value }))}>
                  {TIPOS_OP.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="neg-field">
                <label className="neg-label">Etapa</label>
                <select className="neg-input" value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}>
                  {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>

            <div className="neg-field">
              <label className="neg-label">Dirección</label>
              <input className="neg-input" placeholder="Ej: Av. Corrientes 1234, CABA" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: 12 }}>
              <div className="neg-field">
                <label className="neg-label">Valor operación</label>
                <input className="neg-input" type="number" placeholder="0" value={form.valor_operacion} onChange={e => setForm(f => ({ ...f, valor_operacion: e.target.value }))} />
              </div>
              <div className="neg-field">
                <label className="neg-label">Moneda</label>
                <select className="neg-input" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div className="neg-field">
                <label className="neg-label">Honorarios %</label>
                <input className="neg-input" type="number" step="0.5" placeholder="3" value={form.honorarios_pct} onChange={e => setForm(f => ({ ...f, honorarios_pct: e.target.value }))} />
              </div>
            </div>

            <div className="neg-field">
              <label className="neg-label">Contacto vinculado</label>
              <select className="neg-input" value={form.contacto_id} onChange={e => setForm(f => ({ ...f, contacto_id: e.target.value }))}>
                <option value="">— Sin contacto —</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="neg-field">
                <label className="neg-label">Primer contacto</label>
                <input className="neg-input" type="date" style={{ colorScheme: "dark" }} value={form.fecha_primer_contacto} onChange={e => setForm(f => ({ ...f, fecha_primer_contacto: e.target.value }))} />
              </div>
              <div className="neg-field">
                <label className="neg-label">Fecha visita</label>
                <input className="neg-input" type="date" style={{ colorScheme: "dark" }} value={form.fecha_visita} onChange={e => setForm(f => ({ ...f, fecha_visita: e.target.value }))} />
              </div>
              <div className="neg-field">
                <label className="neg-label">Fecha reserva</label>
                <input className="neg-input" type="date" style={{ colorScheme: "dark" }} value={form.fecha_reserva} onChange={e => setForm(f => ({ ...f, fecha_reserva: e.target.value }))} />
              </div>
              <div className="neg-field">
                <label className="neg-label">Fecha escritura</label>
                <input className="neg-input" type="date" style={{ colorScheme: "dark" }} value={form.fecha_escritura} onChange={e => setForm(f => ({ ...f, fecha_escritura: e.target.value }))} />
              </div>
            </div>

            <div className="neg-field">
              <label className="neg-label">Descripción</label>
              <textarea className="neg-input" rows={2} style={{ resize: "vertical" }} placeholder="Detalles del inmueble u operación..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div className="neg-field">
              <label className="neg-label">Notas internas</label>
              <textarea className="neg-input" rows={2} style={{ resize: "vertical" }} placeholder="Notas privadas..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4, paddingTop: 14, borderTop: "1px solid var(--gfi-border-subtle)" }}>
              <button className="gfi-btn gfi-btn--secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="gfi-btn gfi-btn--primary" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando..." : editId ? "Actualizar" : "Crear negocio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="neg-toast">{toast}</div>}
    </>
  );
}
