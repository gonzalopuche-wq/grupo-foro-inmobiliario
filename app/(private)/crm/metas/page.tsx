"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Meta {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  periodo: string;
  objetivo: number;
  progreso: number;
  moneda: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  activa: boolean;
  created_at: string;
}

const TIPOS = [
  { value: "operaciones", label: "Operaciones cerradas", icon: "🏠", unit: "ops" },
  { value: "honorarios",  label: "Honorarios cobrados",  icon: "💰", unit: "USD" },
  { value: "contactos",   label: "Nuevos contactos",     icon: "👥", unit: "ctcs" },
  { value: "visitas",     label: "Visitas realizadas",   icon: "📍", unit: "vis" },
  { value: "publicaciones",label: "Propiedades publicadas", icon: "📢", unit: "props" },
];

const PERIODOS = [
  { value: "mensual",     label: "Mensual" },
  { value: "trimestral",  label: "Trimestral" },
  { value: "semestral",   label: "Semestral" },
  { value: "anual",       label: "Anual" },
];

const EMPTY: Partial<Meta> = {
  titulo: "", tipo: "operaciones", periodo: "mensual",
  objetivo: 10, progreso: 0, moneda: "USD", activa: true,
  fecha_inicio: new Date().toISOString().slice(0, 10), fecha_fin: null, descripcion: null,
};

const pct = (progreso: number, objetivo: number) => Math.min(100, Math.round((progreso / objetivo) * 100));

const tipoInfo = (tipo: string) => TIPOS.find(t => t.value === tipo) ?? TIPOS[0];

export default function MetasPage() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Meta>>({ ...EMPTY });
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState("");
  const [soloActivas, setSoloActivas] = useState(true);
  const [reales, setReales] = useState<Record<string, number>>({});
  const [sincronizando, setSincronizando] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const cargar = async (uid: string) => {
    const { data } = await supabase.from("crm_metas").select("*").eq("perfil_id", uid).order("created_at", { ascending: false });
    const lista = (data ?? []) as Meta[];
    setMetas(lista);
    await calcularReales(lista, uid);
  };

  const calcularReales = async (lista: Meta[], uid: string) => {
    if (!lista.length) return;
    const hoy = new Date().toISOString().slice(0, 10);

    const resultados: Record<string, number> = {};

    await Promise.all(lista.map(async (m) => {
      const start = m.fecha_inicio;
      const end = m.fecha_fin ?? hoy;

      if (m.tipo === "operaciones") {
        const { count } = await supabase
          .from("crm_negocios")
          .select("*", { count: "exact", head: true })
          .eq("perfil_id", uid)
          .eq("etapa", "cerrado")
          .gte("updated_at", start)
          .lte("updated_at", end + "T23:59:59");
        resultados[m.id] = count ?? 0;

      } else if (m.tipo === "honorarios") {
        const { data: comisiones } = await supabase
          .from("crm_honorarios")
          .select("honorarios_monto")
          .eq("perfil_id", uid)
          .eq("estado", "cobrado")
          .gte("created_at", start)
          .lte("created_at", end + "T23:59:59");
        resultados[m.id] = Math.round((comisiones ?? []).reduce((s, c) => s + (c.honorarios_monto ?? 0), 0));

      } else if (m.tipo === "contactos") {
        const { count } = await supabase
          .from("crm_contactos")
          .select("*", { count: "exact", head: true })
          .eq("perfil_id", uid)
          .gte("created_at", start)
          .lte("created_at", end + "T23:59:59");
        resultados[m.id] = count ?? 0;

      } else if (m.tipo === "visitas") {
        const { count } = await supabase
          .from("cartera_visitas")
          .select("*", { count: "exact", head: true })
          .eq("perfil_id", uid)
          .eq("estado", "realizada")
          .gte("created_at", start)
          .lte("created_at", end + "T23:59:59");
        resultados[m.id] = count ?? 0;

      } else if (m.tipo === "publicaciones") {
        const { count } = await supabase
          .from("cartera_propiedades")
          .select("*", { count: "exact", head: true })
          .eq("perfil_id", uid)
          .eq("publicada_web", true)
          .gte("created_at", start)
          .lte("created_at", end + "T23:59:59");
        resultados[m.id] = count ?? 0;
      }
    }));

    setReales(resultados);
  };

  const sincronizarTodo = async () => {
    if (!userId) return;
    setSincronizando(true);
    await Promise.all(
      metas.filter(m => m.activa && reales[m.id] !== undefined && reales[m.id] !== m.progreso).map(m =>
        actualizarProgreso(m.id, reales[m.id])
      )
    );
    setSincronizando(false);
    showToast("✅ Progreso sincronizado con datos reales");
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
      setLoading(false);
    })();
  }, []);

  const abrirNuevo = () => { setEditId(null); setForm({ ...EMPTY, fecha_inicio: new Date().toISOString().slice(0, 10) }); setModal(true); };
  const abrirEditar = (m: Meta) => { setEditId(m.id); setForm({ ...m }); setModal(true); };

  const guardar = async () => {
    if (!userId || !form.titulo) return;
    setGuardando(true);
    const payload = {
      perfil_id: userId,
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      tipo: form.tipo ?? "operaciones",
      periodo: form.periodo ?? "mensual",
      objetivo: form.objetivo ?? 10,
      progreso: form.progreso ?? 0,
      moneda: form.moneda ?? "USD",
      fecha_inicio: form.fecha_inicio ?? new Date().toISOString().slice(0, 10),
      fecha_fin: form.fecha_fin || null,
      activa: form.activa ?? true,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from("crm_metas").update(payload).eq("id", editId);
    } else {
      await supabase.from("crm_metas").insert(payload);
    }
    await cargar(userId);
    setModal(false);
    setGuardando(false);
    showToast(editId ? "Meta actualizada" : "Meta creada");
  };

  const actualizarProgreso = async (id: string, progreso: number) => {
    if (!userId) return;
    await supabase.from("crm_metas").update({ progreso, updated_at: new Date().toISOString() }).eq("id", id);
    setMetas(prev => prev.map(m => m.id === id ? { ...m, progreso } : m));
  };

  const toggleActiva = async (m: Meta) => {
    if (!userId) return;
    await supabase.from("crm_metas").update({ activa: !m.activa }).eq("id", m.id);
    await cargar(userId);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta meta?")) return;
    await supabase.from("crm_metas").delete().eq("id", id);
    setMetas(prev => prev.filter(m => m.id !== id));
  };

  const visible = soloActivas ? metas.filter(m => m.activa) : metas;

  if (loading) return <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>{toast}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>🎯 Metas y Objetivos</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Definí y seguí tus objetivos comerciales</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setSoloActivas(!soloActivas)}
            style={{ background: "transparent", color: soloActivas ? "#6366f1" : "#94a3b8", border: `1px solid ${soloActivas ? "#6366f1" : "#334155"}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>
            {soloActivas ? "Solo activas" : "Todas"}
          </button>
          {metas.length > 0 && (
            <button onClick={sincronizarTodo} disabled={sincronizando}
              style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: sincronizando ? 0.6 : 1 }}>
              {sincronizando ? "⏳ Sincronizando..." : "🔄 Sincronizar datos reales"}
            </button>
          )}
          <button onClick={abrirNuevo} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
            + Nueva meta
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Sin metas definidas</div>
          <div style={{ fontSize: 13 }}>Creá objetivos para medir tu crecimiento profesional</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visible.map(m => {
            const info = tipoInfo(m.tipo);
            const p = pct(m.progreso, m.objetivo);
            const cumplida = p >= 100;
            return (
              <div key={m.id} style={{ background: "#1e293b", borderRadius: 14, padding: "20px 22px", border: cumplida ? "1px solid #22c55e44" : "1px solid transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{info.icon}</span>
                      <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: 16 }}>{m.titulo}</span>
                      {cumplida && <span style={{ background: "#22c55e22", color: "#22c55e", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>CUMPLIDA ✓</span>}
                      {!m.activa && <span style={{ background: "#33415522", color: "#64748b", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>INACTIVA</span>}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{info.label} · {PERIODOS.find(p => p.value === m.periodo)?.label} · Inicio: {m.fecha_inicio}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => abrirEditar(m)} style={{ background: "#1e3a5f", color: "#60a5fa", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>✏️</button>
                    <button onClick={() => toggleActiva(m)} style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>{m.activa ? "Pausar" : "Activar"}</button>
                    <button onClick={() => eliminar(m.id)} style={{ background: "#2d1b1b", color: "#ef4444", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>🗑</button>
                  </div>
                </div>

                {/* Progreso */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                    <span>Progreso: <strong style={{ color: "#f8fafc" }}>{m.progreso} {info.unit}</strong> de {m.objetivo} {info.unit}</span>
                    <strong style={{ color: cumplida ? "#22c55e" : "#f8fafc" }}>{p}%</strong>
                  </div>
                  <div style={{ background: "#0f172a", borderRadius: 100, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${p}%`, height: "100%", background: cumplida ? "#22c55e" : "#6366f1", borderRadius: 100, transition: "width 0.4s" }} />
                  </div>
                </div>

                {/* Datos reales calculados */}
                {reales[m.id] !== undefined && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "7px 10px", background: reales[m.id] !== m.progreso ? "rgba(99,102,241,0.08)" : "rgba(34,197,94,0.06)", borderRadius: 8, border: `1px solid ${reales[m.id] !== m.progreso ? "rgba(99,102,241,0.2)" : "rgba(34,197,94,0.15)"}` }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>📊 Datos reales:</span>
                    <strong style={{ fontSize: 13, color: reales[m.id] !== m.progreso ? "#a5b4fc" : "#4ade80" }}>
                      {m.tipo === "honorarios" ? `${m.moneda ?? "USD"} ${reales[m.id].toLocaleString("es-AR")}` : `${reales[m.id]} ${info.unit}`}
                    </strong>
                    {reales[m.id] !== m.progreso && (
                      <button
                        onClick={() => actualizarProgreso(m.id, reales[m.id])}
                        style={{ marginLeft: "auto", padding: "3px 10px", background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, color: "#a5b4fc", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                      >Aplicar →</button>
                    )}
                    {reales[m.id] === m.progreso && <span style={{ marginLeft: "auto", fontSize: 11, color: "#4ade80" }}>✓ Sincronizado</span>}
                  </div>
                )}

                {/* Actualizar progreso inline */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>Manual:</span>
                  <input type="number" defaultValue={m.progreso} onBlur={e => {
                    const v = +e.target.value;
                    if (v !== m.progreso) actualizarProgreso(m.id, v);
                  }}
                    style={{ width: 80, background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: 6, padding: "4px 8px", fontSize: 13 }} />
                  <span style={{ color: "#64748b", fontSize: 12 }}>{info.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", border: "1px solid #1e293b" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
              {editId ? "Editar meta" : "Nueva meta"}
            </h2>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Título *</label>
            <input value={form.titulo ?? ""} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Cerrar 5 ventas en mayo"
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Tipo</label>
                <select value={form.tipo ?? "operaciones"} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14 }}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Período</label>
                <select value={form.periodo ?? "mensual"} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14 }}>
                  {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Objetivo</label>
                <input type="number" value={form.objetivo ?? ""} onChange={e => setForm(f => ({ ...f, objetivo: +e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Progreso actual</label>
                <input type="number" value={form.progreso ?? 0} onChange={e => setForm(f => ({ ...f, progreso: +e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Inicio</label>
                <input type="date" value={form.fecha_inicio ?? ""} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Fin (opcional)</label>
                <input type="date" value={form.fecha_fin ?? ""} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value || null }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Descripción</label>
            <textarea value={form.descripcion ?? ""} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 20, resize: "vertical", boxSizing: "border-box" }} />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "9px 20px", cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando || !form.titulo}
                style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 600, cursor: "pointer", opacity: guardando ? 0.7 : 1 }}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
