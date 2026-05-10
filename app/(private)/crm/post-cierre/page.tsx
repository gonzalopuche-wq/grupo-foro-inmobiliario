"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface PostCierre {
  id: string;
  negocio_id: string | null;
  titulo: string;
  tipo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  completado: boolean;
  fecha_hecho: string | null;
  notas: string | null;
  created_at: string;
  negocio?: { titulo: string } | null;
}

interface Negocio { id: string; titulo: string; etapa: string; }

const TIPOS = [
  { value: "tarea",      label: "Tarea",       icon: "✅" },
  { value: "contacto",   label: "Contacto",    icon: "📞" },
  { value: "documento",  label: "Documento",   icon: "📄" },
  { value: "fecha",      label: "Fecha clave", icon: "📅" },
];

const PLANTILLAS = [
  { titulo: "Enviar documentación de escritura al comprador", tipo: "documento" },
  { titulo: "Coordinar entrega de llaves", tipo: "tarea" },
  { titulo: "Confirmar transferencia de honorarios", tipo: "tarea" },
  { titulo: "Llamar al cliente para satisfacción post-venta", tipo: "contacto" },
  { titulo: "Seguimiento a 30 días del cierre", tipo: "contacto" },
  { titulo: "Solicitar testimonio / reseña", tipo: "contacto" },
  { titulo: "Verificar inhabilitaciones AFIP/ARBA", tipo: "documento" },
  { titulo: "Fecha de posesión efectiva", tipo: "fecha" },
];

const EMPTY: Partial<PostCierre> = {
  titulo: "", tipo: "tarea", descripcion: null, fecha_limite: null, completado: false, notas: null,
};

export default function PostCierrePage() {
  const [items, setItems] = useState<PostCierre[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [filtroNegocio, setFiltroNegocio] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PostCierre>>({ ...EMPTY });
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const cargar = async (uid: string) => {
    const { data } = await supabase
      .from("crm_post_cierre")
      .select("*, negocio:crm_negocios(titulo)")
      .eq("perfil_id", uid)
      .order("completado")
      .order("fecha_limite", { ascending: true, nullsFirst: false });
    setItems((data ?? []) as PostCierre[]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
      const { data: neg } = await supabase.from("crm_negocios").select("id,titulo,etapa")
        .eq("perfil_id", data.user.id).in("etapa", ["reserva", "escritura", "cerrado"]).eq("archivado", false).order("updated_at", { ascending: false });
      setNegocios((neg ?? []) as Negocio[]);
      setLoading(false);
    })();
  }, []);

  const abrirNuevo = (plantilla?: typeof PLANTILLAS[0]) => {
    setEditId(null);
    setForm({ ...EMPTY, ...(plantilla ? { titulo: plantilla.titulo, tipo: plantilla.tipo } : {}) });
    setModal(true);
  };

  const abrirEditar = (item: PostCierre) => { setEditId(item.id); setForm({ ...item }); setModal(true); };

  const guardar = async () => {
    if (!userId || !form.titulo) return;
    setGuardando(true);
    const payload = {
      perfil_id: userId,
      negocio_id: form.negocio_id ?? null,
      titulo: form.titulo,
      tipo: form.tipo ?? "tarea",
      descripcion: form.descripcion || null,
      fecha_limite: form.fecha_limite || null,
      completado: form.completado ?? false,
      fecha_hecho: form.fecha_hecho || null,
      notas: form.notas || null,
    };
    if (editId) {
      await supabase.from("crm_post_cierre").update(payload).eq("id", editId);
    } else {
      await supabase.from("crm_post_cierre").insert(payload);
    }
    await cargar(userId);
    setModal(false);
    setGuardando(false);
    showToast(editId ? "Actualizado" : "Tarea creada");
  };

  const toggleCompletado = async (item: PostCierre) => {
    if (!userId) return;
    const completado = !item.completado;
    const fecha_hecho = completado ? new Date().toISOString().slice(0, 10) : null;
    await supabase.from("crm_post_cierre").update({ completado, fecha_hecho }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, completado, fecha_hecho } : i));
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar?")) return;
    await supabase.from("crm_post_cierre").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const isVencida = (item: PostCierre) =>
    !item.completado && item.fecha_limite && new Date(item.fecha_limite) < new Date();

  let visible = items;
  if (filtroNegocio) visible = visible.filter(i => i.negocio_id === filtroNegocio);
  if (soloActivos) visible = visible.filter(i => !i.completado);

  const pendientes = items.filter(i => !i.completado).length;
  const completados = items.filter(i => i.completado).length;

  if (loading) return <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>{toast}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>📋 Seguimiento Post-cierre</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Tareas y checklist después de cerrar un negocio</p>
        </div>
        <button onClick={() => abrirNuevo()} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          + Nueva tarea
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "14px 20px" }}>
          <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>PENDIENTES</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc" }}>{pendientes}</div>
        </div>
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "14px 20px" }}>
          <div style={{ color: "#22c55e", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>COMPLETADAS</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc" }}>{completados}</div>
        </div>
      </div>

      {/* Plantillas rápidas */}
      <div style={{ background: "#1e293b", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>PLANTILLAS RÁPIDAS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PLANTILLAS.map((p, i) => (
            <button key={i} onClick={() => abrirNuevo(p)}
              style={{ background: "#0f172a", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
              {TIPOS.find(t => t.value === p.tipo)?.icon} {p.titulo}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filtroNegocio} onChange={e => setFiltroNegocio(e.target.value)}
          style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "7px 12px", fontSize: 13 }}>
          <option value="">Todos los negocios</option>
          {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
        </select>
        <button onClick={() => setSoloActivos(!soloActivos)}
          style={{ background: soloActivos ? "#6366f1" : "transparent", color: soloActivos ? "#fff" : "#94a3b8", border: `1px solid ${soloActivos ? "#6366f1" : "#334155"}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>
          {soloActivos ? "Solo pendientes" : "Mostrar todas"}
        </button>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{soloActivos ? "Sin tareas pendientes" : "Sin tareas registradas"}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visible.map(item => {
            const tipo = TIPOS.find(t => t.value === item.tipo);
            const vencida = isVencida(item);
            return (
              <div key={item.id} style={{
                background: "#1e293b", borderRadius: 10, padding: "14px 18px",
                display: "flex", alignItems: "center", gap: 14,
                borderLeft: `3px solid ${item.completado ? "#22c55e" : vencida ? "#ef4444" : "#334155"}`,
                opacity: item.completado ? 0.7 : 1,
              }}>
                <button onClick={() => toggleCompletado(item)}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${item.completado ? "#22c55e" : "#334155"}`, background: item.completado ? "#22c55e" : "transparent", cursor: "pointer", flexShrink: 0, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                  {item.completado ? "✓" : ""}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 16 }}>{tipo?.icon}</span>
                    <span style={{ fontWeight: 600, color: item.completado ? "#64748b" : "#f8fafc", fontSize: 14, textDecoration: item.completado ? "line-through" : "none" }}>{item.titulo}</span>
                    {vencida && <span style={{ background: "#ef444422", color: "#ef4444", fontSize: 11, padding: "1px 8px", borderRadius: 10, fontWeight: 700 }}>VENCIDA</span>}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {item.negocio && <span>{item.negocio.titulo} · </span>}
                    {item.fecha_limite && <span>Límite: {item.fecha_limite}</span>}
                    {item.fecha_hecho && <span> · Hecho: {item.fecha_hecho}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => abrirEditar(item)} style={{ background: "#1e3a5f", color: "#60a5fa", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>✏️</button>
                  <button onClick={() => eliminar(item.id)} style={{ background: "#2d1b1b", color: "#ef4444", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", border: "1px solid #1e293b" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
              {editId ? "Editar tarea" : "Nueva tarea post-cierre"}
            </h2>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Negocio (opcional)</label>
            <select value={form.negocio_id ?? ""} onChange={e => setForm(f => ({ ...f, negocio_id: e.target.value || null }))}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14 }}>
              <option value="">— Sin negocio vinculado —</option>
              {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
            </select>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Título *</label>
            <input value={form.titulo ?? ""} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Tipo</label>
                <select value={form.tipo ?? "tarea"} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14 }}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Fecha límite</label>
                <input type="date" value={form.fecha_limite ?? ""} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value || null }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Notas</label>
            <textarea value={form.notas ?? ""} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={3}
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
