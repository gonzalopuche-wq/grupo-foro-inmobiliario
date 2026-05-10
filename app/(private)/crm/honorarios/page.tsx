"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Honorario {
  id: string;
  negocio_id: string | null;
  titulo: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  honorarios_monto: number | null;
  split_pct: number | null;
  split_monto: number | null;
  estado: string;
  fecha_cobro: string | null;
  notas: string | null;
  created_at: string;
  negocio?: { titulo: string } | null;
}

interface Negocio { id: string; titulo: string; valor_operacion: number | null; moneda: string; honorarios_pct: number | null; }

const ESTADOS = [
  { value: "pendiente", label: "Pendiente", color: "#f59e0b" },
  { value: "parcial",   label: "Cobrado parcial", color: "#06b6d4" },
  { value: "cobrado",   label: "Cobrado", color: "#22c55e" },
];

const TIPOS = ["venta", "alquiler", "alquiler_temporal", "otro"];

const fmtMonto = (v: number | null, m = "USD") => !v ? "—" :
  m === "USD" ? `USD ${v.toLocaleString("es-AR", { minimumFractionDigits: 0 })}` :
  `$ ${v.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;

const estadoChip = (e: string) => {
  const s = ESTADOS.find(x => x.value === e);
  return s ? <span style={{ background: s.color + "22", color: s.color, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{s.label}</span> : null;
};

const EMPTY: Partial<Honorario> = {
  titulo: "", tipo_operacion: "venta", moneda: "USD",
  honorarios_pct: null, honorarios_monto: null,
  split_pct: null, split_monto: null,
  estado: "pendiente", fecha_cobro: null, notas: null,
};

export default function HonorariosPage() {
  const [items, setItems] = useState<Honorario[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Honorario>>({ ...EMPTY });
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const cargar = async (uid: string) => {
    const { data } = await supabase
      .from("crm_honorarios")
      .select("*, negocio:crm_negocios(titulo)")
      .eq("perfil_id", uid)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Honorario[]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
      const { data: neg } = await supabase.from("crm_negocios").select("id,titulo,valor_operacion,moneda,honorarios_pct").eq("perfil_id", data.user.id).eq("archivado", false).order("created_at", { ascending: false });
      setNegocios((neg ?? []) as Negocio[]);
      setLoading(false);
    })();
  }, []);

  const abrirNuevo = () => { setEditId(null); setForm({ ...EMPTY }); setModal(true); };
  const abrirEditar = (h: Honorario) => { setEditId(h.id); setForm({ ...h }); setModal(true); };

  const calcMonto = (f: Partial<Honorario>) => {
    if (f.valor_operacion && f.honorarios_pct) {
      return +(f.valor_operacion * f.honorarios_pct / 100).toFixed(2);
    }
    return f.honorarios_monto ?? null;
  };

  const onNegocioChange = (id: string) => {
    const neg = negocios.find(n => n.id === id);
    if (!neg) { setForm(f => ({ ...f, negocio_id: null })); return; }
    const monto = neg.valor_operacion && neg.honorarios_pct
      ? +(neg.valor_operacion * neg.honorarios_pct / 100).toFixed(2)
      : null;
    setForm(f => ({
      ...f,
      negocio_id: id,
      titulo: neg.titulo,
      valor_operacion: neg.valor_operacion ?? undefined,
      moneda: neg.moneda,
      honorarios_pct: neg.honorarios_pct ?? undefined,
      honorarios_monto: monto ?? undefined,
    }));
  };

  const guardar = async () => {
    if (!userId || !form.titulo) return;
    setGuardando(true);
    const payload = {
      perfil_id: userId,
      negocio_id: form.negocio_id ?? null,
      titulo: form.titulo,
      tipo_operacion: form.tipo_operacion ?? "venta",
      valor_operacion: form.valor_operacion ?? null,
      moneda: form.moneda ?? "USD",
      honorarios_pct: form.honorarios_pct ?? null,
      honorarios_monto: calcMonto(form),
      split_pct: form.split_pct ?? null,
      split_monto: form.split_monto ?? null,
      estado: form.estado ?? "pendiente",
      fecha_cobro: form.fecha_cobro || null,
      notas: form.notas || null,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from("crm_honorarios").update(payload).eq("id", editId);
    } else {
      await supabase.from("crm_honorarios").insert(payload);
    }
    await cargar(userId);
    setModal(false);
    setGuardando(false);
    showToast(editId ? "Honorario actualizado" : "Honorario registrado");
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este honorario?")) return;
    await supabase.from("crm_honorarios").delete().eq("id", id);
    setItems(prev => prev.filter(h => h.id !== id));
    showToast("Eliminado");
  };

  const marcarCobrado = async (h: Honorario) => {
    if (!userId) return;
    const nuevo = h.estado === "cobrado" ? "pendiente" : "cobrado";
    const fecha = nuevo === "cobrado" ? new Date().toISOString().slice(0, 10) : null;
    await supabase.from("crm_honorarios").update({ estado: nuevo, fecha_cobro: fecha, updated_at: new Date().toISOString() }).eq("id", h.id);
    await cargar(userId);
  };

  const visible = filtroEstado ? items.filter(h => h.estado === filtroEstado) : items;

  const totalPendiente = items.filter(h => h.estado !== "cobrado").reduce((a, h) => a + (h.honorarios_monto ?? 0), 0);
  const totalCobrado = items.filter(h => h.estado === "cobrado").reduce((a, h) => a + (h.honorarios_monto ?? 0), 0);

  if (loading) return <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>💰 Gestión de Honorarios</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Registrá y seguí el cobro de tus comisiones</p>
        </div>
        <button onClick={abrirNuevo} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          + Nuevo honorario
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>POR COBRAR</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc" }}>USD {totalPendiente.toLocaleString("es-AR")}</div>
        </div>
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ color: "#22c55e", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>COBRADO</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc" }}>USD {totalCobrado.toLocaleString("es-AR")}</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[{ value: "", label: "Todos" }, ...ESTADOS].map(e => (
          <button key={e.value} onClick={() => setFiltroEstado(e.value)}
            style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid", fontSize: 13, cursor: "pointer", fontWeight: filtroEstado === e.value ? 700 : 400, background: filtroEstado === e.value ? "#6366f1" : "transparent", borderColor: filtroEstado === e.value ? "#6366f1" : "#334155", color: filtroEstado === e.value ? "#fff" : "#94a3b8" }}>
            {e.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Sin honorarios registrados</div>
          <div style={{ fontSize: 13 }}>Registrá tus comisiones para hacer seguimiento de cobros</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(h => (
            <div key={h.id} style={{ background: "#1e293b", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: 15 }}>{h.titulo}</span>
                  {estadoChip(h.estado)}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>
                  {h.tipo_operacion} {h.valor_operacion ? `· Valor: ${fmtMonto(h.valor_operacion, h.moneda)}` : ""} {h.honorarios_pct ? `· ${h.honorarios_pct}%` : ""}
                  {h.fecha_cobro ? ` · Cobrado: ${h.fecha_cobro}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: h.estado === "cobrado" ? "#22c55e" : "#f59e0b" }}>
                  {fmtMonto(h.honorarios_monto, h.moneda)}
                </div>
                {h.split_pct && <div style={{ fontSize: 11, color: "#64748b" }}>Split: {h.split_pct}% colega</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => marcarCobrado(h)} title={h.estado === "cobrado" ? "Marcar pendiente" : "Marcar cobrado"}
                  style={{ background: h.estado === "cobrado" ? "#16213e" : "#052e16", color: h.estado === "cobrado" ? "#64748b" : "#22c55e", border: "1px solid", borderColor: h.estado === "cobrado" ? "#1e3a5f" : "#166534", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 16 }}>
                  {h.estado === "cobrado" ? "↩" : "✓"}
                </button>
                <button onClick={() => abrirEditar(h)} style={{ background: "#1e3a5f", color: "#60a5fa", border: "1px solid #1e3a5f", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>✏️</button>
                <button onClick={() => eliminar(h.id)} style={{ background: "#2d1b1b", color: "#ef4444", border: "1px solid #2d1b1b", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", border: "1px solid #1e293b" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
              {editId ? "Editar honorario" : "Nuevo honorario"}
            </h2>

            {/* Vincular negocio */}
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Vincular negocio (opcional)</label>
            <select value={form.negocio_id ?? ""} onChange={e => onNegocioChange(e.target.value)}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14 }}>
              <option value="">— Sin negocio vinculado —</option>
              {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
            </select>

            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Título *</label>
            <input value={form.titulo ?? ""} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Venta depto Av. Pellegrini 123"
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Tipo operación</label>
                <select value={form.tipo_operacion ?? "venta"} onChange={e => setForm(f => ({ ...f, tipo_operacion: e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14 }}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Moneda</label>
                <select value={form.moneda ?? "USD"} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14 }}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Valor operación</label>
                <input type="number" value={form.valor_operacion ?? ""} onChange={e => setForm(f => ({ ...f, valor_operacion: +e.target.value || null }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>% Honorarios</label>
                <input type="number" step="0.1" value={form.honorarios_pct ?? ""} onChange={e => setForm(f => ({ ...f, honorarios_pct: +e.target.value || null }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Monto honorario</label>
                <input type="number" value={form.honorarios_monto ?? ""} onChange={e => setForm(f => ({ ...f, honorarios_monto: +e.target.value || null }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>% Split colega</label>
                <input type="number" step="0.5" value={form.split_pct ?? ""} onChange={e => setForm(f => ({ ...f, split_pct: +e.target.value || null }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Estado</label>
                <select value={form.estado ?? "pendiente"} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 14 }}>
                  {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Fecha cobro</label>
                <input type="date" value={form.fecha_cobro ?? ""} onChange={e => setForm(f => ({ ...f, fecha_cobro: e.target.value || null }))}
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
