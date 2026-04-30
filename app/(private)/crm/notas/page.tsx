"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

interface NotaCRM {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  negocio_id: string | null;
  titulo: string | null;
  contenido: string;
  tipo: string;
  fijada: boolean;
  etiquetas: string[] | null;
  created_at: string;
  updated_at: string;
}

interface Contacto { id: string; nombre: string; apellido: string; }
interface Negocio  { id: string; titulo: string; }

const TIPOS_NOTA = [
  { value: "general",    label: "General",    icon: "📝" },
  { value: "estrategia", label: "Estrategia", icon: "🎯" },
  { value: "legal",      label: "Legal",      icon: "⚖️" },
  { value: "financiera", label: "Financiera", icon: "💰" },
  { value: "otra",       label: "Otra",       icon: "📌" },
];

const FORM_VACIO = {
  titulo: "", contenido: "", tipo: "general",
  contacto_id: "", negocio_id: "",
};

const fmtFechaHora = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
};

export default function CrmNotasPage() {
  const [uid, setUid]             = useState<string | null>(null);
  const [notas, setNotas]         = useState<NotaCRM[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [negocios, setNegocios]   = useState<Negocio[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [busqueda, setBusqueda]     = useState("");
  const [soloFijadas, setSoloFijadas] = useState(false);
  const [modal, setModal]     = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]     = useState<string | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);

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
    const [{ data: n }, { data: c }, { data: neg }] = await Promise.all([
      supabase.from("crm_notas").select("*").eq("perfil_id", id).order("fijada", { ascending: false }).order("updated_at", { ascending: false }),
      supabase.from("crm_contactos").select("id, nombre, apellido").eq("perfil_id", id).order("apellido"),
      supabase.from("crm_negocios").select("id, titulo").eq("perfil_id", id).eq("archivado", false).order("titulo"),
    ]);
    setNotas((n as NotaCRM[]) ?? []);
    setContactos((c as Contacto[]) ?? []);
    setNegocios((neg as Negocio[]) ?? []);
    setLoading(false);
  };

  const notasFiltradas = useMemo(() => {
    return notas.filter(n => {
      if (soloFijadas && !n.fijada) return false;
      if (filtroTipo && n.tipo !== filtroTipo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!n.contenido.toLowerCase().includes(q) &&
            !(n.titulo ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [notas, filtroTipo, busqueda, soloFijadas]);

  const abrirNueva = () => { setForm(FORM_VACIO); setEditId(null); setModal(true); };
  const abrirEditar = (n: NotaCRM) => {
    setForm({
      titulo: n.titulo ?? "", contenido: n.contenido,
      tipo: n.tipo, contacto_id: n.contacto_id ?? "",
      negocio_id: n.negocio_id ?? "",
    });
    setEditId(n.id);
    setModal(true);
  };

  const guardar = async () => {
    if (!form.contenido.trim() || !uid) return;
    setGuardando(true);
    const payload: Record<string, unknown> = {
      perfil_id: uid,
      titulo: form.titulo.trim() || null,
      contenido: form.contenido.trim(),
      tipo: form.tipo,
      contacto_id: form.contacto_id || null,
      negocio_id: form.negocio_id || null,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from("crm_notas").update(payload).eq("id", editId);
    } else {
      payload.fijada = false;
      await supabase.from("crm_notas").insert(payload);
    }
    setGuardando(false);
    setModal(false);
    showToast(editId ? "Nota actualizada" : "Nota creada");
    cargar(uid);
  };

  const toggleFijada = async (n: NotaCRM) => {
    const nuevaFijada = !n.fijada;
    await supabase.from("crm_notas").update({ fijada: nuevaFijada, updated_at: new Date().toISOString() }).eq("id", n.id);
    setNotas(prev => prev.map(x => x.id === n.id ? { ...x, fijada: nuevaFijada } : x));
    showToast(nuevaFijada ? "Nota fijada" : "Nota desfijada");
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta nota?")) return;
    await supabase.from("crm_notas").delete().eq("id", id);
    setNotas(prev => prev.filter(n => n.id !== id));
    showToast("Nota eliminada");
  };

  const tipoInfo = (v: string) => TIPOS_NOTA.find(t => t.value === v) ?? TIPOS_NOTA[0];
  const contactoNombre = (id: string | null) => {
    if (!id) return null;
    const c = contactos.find(x => x.id === id);
    return c ? `${c.nombre} ${c.apellido}` : null;
  };
  const negocioTitulo = (id: string | null) => {
    if (!id) return null;
    return negocios.find(x => x.id === id)?.titulo ?? null;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .nt-wrap { max-width: 860px; display: flex; flex-direction: column; gap: 16px; }
        .nt-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 16px; transition: border-color 0.15s; cursor: pointer; }
        .nt-card:hover { border-color: rgba(255,255,255,0.14); }
        .nt-card.fijada { border-left: 3px solid #f59e0b; }
        .nt-input { width: 100%; padding: 9px 11px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; box-sizing: border-box; }
        .nt-input:focus { border-color: rgba(200,0,0,0.5); }
        .nt-select { width: 100%; padding: 9px 11px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; }
        .nt-btn { padding: 8px 14px; border: none; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s; }
        .nt-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .nt-field { margin-bottom: 12px; }
        .nt-contenido { white-space: pre-wrap; font-size: 13px; color: rgba(255,255,255,0.7); font-family: 'Inter',sans-serif; line-height: 1.6; }
        .nt-contenido.colapsado { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
      `}</style>

      <div className="nt-wrap">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#fff" }}>
              Notas <span style={{ color: "#cc0000" }}>CRM</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
              {notas.length} nota{notas.length !== 1 ? "s" : ""} · {notas.filter(n => n.fijada).length} fijada{notas.filter(n => n.fijada).length !== 1 ? "s" : ""}
            </div>
          </div>
          <button className="nt-btn" style={{ background: "#cc0000", color: "#fff" }} onClick={abrirNueva}>
            + Nueva nota
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="nt-input" style={{ flex: 1, minWidth: 160 }} placeholder="Buscar en notas..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="nt-select" style={{ width: 150 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPOS_NOTA.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
          <button
            className="nt-btn"
            style={{ background: soloFijadas ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)", color: soloFijadas ? "#f59e0b" : "rgba(255,255,255,0.5)", border: soloFijadas ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.1)" }}
            onClick={() => setSoloFijadas(v => !v)}
          >
            📌 Fijadas
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40, fontFamily: "Inter,sans-serif" }}>Cargando notas...</div>
        ) : notasFiltradas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat,sans-serif" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📝</div>
            <div style={{ fontWeight: 700 }}>No hay notas{busqueda ? " que coincidan" : ""}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notasFiltradas.map(n => {
              const tipo = tipoInfo(n.tipo);
              const abierta = expandida === n.id;
              const esLarga = n.contenido.length > 200;
              return (
                <div key={n.id} className={`nt-card${n.fijada ? " fijada" : ""}`} onClick={() => esLarga && setExpandida(abierta ? null : n.id)}>
                  {/* Header nota */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14 }}>{tipo.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        {n.titulo && (
                          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{n.titulo}</div>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>{tipo.label}</span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif" }}>{fmtFechaHora(n.updated_at)}</span>
                          {contactoNombre(n.contacto_id) && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>👤 {contactoNombre(n.contacto_id)}</span>}
                          {negocioTitulo(n.negocio_id) && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>🤝 {negocioTitulo(n.negocio_id)}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button className="nt-btn"
                        style={{ background: n.fijada ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", color: n.fijada ? "#f59e0b" : "rgba(255,255,255,0.4)", border: n.fijada ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.08)", padding: "4px 8px", fontSize: 12 }}
                        onClick={() => toggleFijada(n)} title={n.fijada ? "Desfijar" : "Fijar"}>
                        📌
                      </button>
                      <button className="nt-btn" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)", padding: "4px 8px", fontSize: 10 }}
                        onClick={() => abrirEditar(n)}>Editar</button>
                      <button className="nt-btn" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", padding: "4px 8px", fontSize: 10 }}
                        onClick={() => eliminar(n.id)}>×</button>
                    </div>
                  </div>
                  {/* Contenido */}
                  <div className={`nt-contenido${esLarga && !abierta ? " colapsado" : ""}`}>
                    {n.contenido}
                  </div>
                  {esLarga && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "rgba(200,0,0,0.7)", fontFamily: "Inter,sans-serif" }}>
                      {abierta ? "▲ Ver menos" : "▼ Ver más"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 20 }}>
              {editId ? "Editar nota" : "Nueva nota"}
            </div>

            <div className="nt-field">
              <label className="nt-label">Tipo</label>
              <select className="nt-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS_NOTA.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>

            <div className="nt-field">
              <label className="nt-label">Título (opcional)</label>
              <input className="nt-input" placeholder="Título breve..." value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div className="nt-field">
              <label className="nt-label">Contenido *</label>
              <textarea className="nt-input" rows={5} style={{ resize: "vertical" }} placeholder="Escribí tu nota aquí..." value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="nt-field">
                <label className="nt-label">Contacto (opcional)</label>
                <select className="nt-select" value={form.contacto_id} onChange={e => setForm(f => ({ ...f, contacto_id: e.target.value }))}>
                  <option value="">— Sin contacto —</option>
                  {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                </select>
              </div>
              <div className="nt-field">
                <label className="nt-label">Negocio (opcional)</label>
                <select className="nt-select" value={form.negocio_id} onChange={e => setForm(f => ({ ...f, negocio_id: e.target.value }))}>
                  <option value="">— Sin negocio —</option>
                  {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button className="nt-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }} onClick={() => setModal(false)}>Cancelar</button>
              <button className="nt-btn" style={{ background: "#cc0000", color: "#fff", opacity: guardando ? 0.6 : 1 }} onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando..." : editId ? "Actualizar" : "Crear nota"}
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
