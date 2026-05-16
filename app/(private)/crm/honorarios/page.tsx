"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Comision {
  id: string;
  descripcion: string;
  tipo_operacion: string;
  monto_comision: number;
  moneda_comision: string;
  monto_cobrado: number;
  estado: "pendiente" | "cobrada" | "parcial" | "perdida";
  fecha_operacion: string | null;
  cliente_nombre: string | null;
  notas: string | null;
  created_at: string;
}

const TIPOS_OP = [
  "venta", "locacion", "alquiler_temporal", "comercial", "desarrollo", "otro",
];
const TIPO_LABELS: Record<string, string> = {
  venta: "Venta",
  locacion: "Locación",
  alquiler_temporal: "Alquiler Temporal",
  comercial: "Comercial",
  desarrollo: "Desarrollo",
  otro: "Otro",
};
const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  cobrada:   { label: "Cobrada",    color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  parcial:   { label: "Parcial",    color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  perdida:   { label: "Perdida",    color: "#ef4444", bg: "rgba(239,68,68,0.1)"  },
};

const MONEDAS = ["ARS", "USD", "EUR"];

const FORM_VACIO = {
  descripcion: "", tipo_operacion: "venta",
  monto_comision: "", moneda_comision: "ARS",
  monto_cobrado: "", estado: "pendiente",
  fecha_operacion: "", cliente_nombre: "", notas: "",
};

function fmtNum(n: number, moneda: string) {
  const fmt = n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  return moneda === "ARS" ? `$${fmt}` : `${moneda} ${fmt}`;
}

function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + "T12:00").toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function HonorariosPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<Comision[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "pendiente" | "cobrada" | "parcial" | "perdida">("todos");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const mostrarToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  const cargar = async (id: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("comisiones")
      .select("*")
      .eq("perfil_id", id)
      .order("fecha_operacion", { ascending: false, nullsFirst: false });
    setItems((data ?? []) as Comision[]);
    setLoading(false);
  };

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const abrirNuevo = () => {
    setEditId(null);
    setForm({ ...FORM_VACIO, fecha_operacion: new Date().toISOString().slice(0, 10) });
    setModal(true);
  };

  const abrirEditar = (c: Comision) => {
    setEditId(c.id);
    setForm({
      descripcion: c.descripcion,
      tipo_operacion: c.tipo_operacion,
      monto_comision: String(c.monto_comision),
      moneda_comision: c.moneda_comision,
      monto_cobrado: String(c.monto_cobrado),
      estado: c.estado,
      fecha_operacion: c.fecha_operacion ?? "",
      cliente_nombre: c.cliente_nombre ?? "",
      notas: c.notas ?? "",
    });
    setModal(true);
  };

  const guardar = async () => {
    if (!uid || !form.descripcion.trim()) {
      mostrarToast("Ingresá una descripción", "err");
      return;
    }
    const monto = parseFloat(form.monto_comision.replace(/\./g, "").replace(",", "."));
    const cobrado = parseFloat(form.monto_cobrado.replace(/\./g, "").replace(",", ".")) || 0;
    if (isNaN(monto) || monto <= 0) {
      mostrarToast("Ingresá un monto válido", "err");
      return;
    }
    setGuardando(true);
    const payload = {
      descripcion: form.descripcion.trim(),
      tipo_operacion: form.tipo_operacion,
      monto_comision: monto,
      moneda_comision: form.moneda_comision,
      monto_cobrado: cobrado,
      estado: form.estado,
      fecha_operacion: form.fecha_operacion || null,
      cliente_nombre: form.cliente_nombre.trim() || null,
      notas: form.notas.trim() || null,
    };
    if (editId) {
      const { error } = await supabase.from("comisiones").update(payload).eq("id", editId);
      if (error) { mostrarToast("Error al actualizar", "err"); setGuardando(false); return; }
      mostrarToast("Comisión actualizada ✓");
    } else {
      const { error } = await supabase.from("comisiones").insert({ ...payload, perfil_id: uid });
      if (error) { mostrarToast("Error al guardar", "err"); setGuardando(false); return; }
      mostrarToast("Comisión registrada ✓");
    }
    setGuardando(false);
    setModal(false);
    cargar(uid);
  };

  const cambiarEstado = async (id: string, estado: Comision["estado"]) => {
    await supabase.from("comisiones").update({ estado }).eq("id", id);
    setItems(prev => prev.map(c => c.id === id ? { ...c, estado } : c));
    mostrarToast(
      estado === "cobrada" ? "✅ Marcada como cobrada" :
      estado === "parcial" ? "Pago parcial registrado" :
      estado === "perdida" ? "Operación perdida" : "Estado actualizado"
    );
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta comisión?")) return;
    await supabase.from("comisiones").delete().eq("id", id);
    setItems(prev => prev.filter(c => c.id !== id));
    mostrarToast("Eliminada");
  };

  const filtrados = filtro === "todos" ? items : items.filter(c => c.estado === filtro);

  // KPIs
  const total    = items.reduce((s, c) => s + c.monto_comision, 0);
  const cobrado  = items.filter(c => c.estado === "cobrada" || c.estado === "parcial")
                        .reduce((s, c) => s + (c.estado === "cobrada" ? c.monto_comision : c.monto_cobrado), 0);
  const pendiente = items.filter(c => c.estado === "pendiente" || c.estado === "parcial")
                         .reduce((s, c) => s + (c.monto_comision - c.monto_cobrado), 0);
  const pctCobro = total > 0 ? Math.round((cobrado / total) * 100) : 0;

  const LABEL_FILT = [
    { key: "todos", label: "Todos" },
    { key: "pendiente", label: "Pendientes" },
    { key: "cobrada",   label: "Cobradas" },
    { key: "parcial",   label: "Parciales" },
    { key: "perdida",   label: "Perdidas" },
  ] as const;

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "0 0 64px" }}>
      <style>{`
        .hon-input { width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:7px; color:#fff; padding:9px 12px; font-size:13px; font-family:Inter,sans-serif; outline:none; box-sizing:border-box; }
        .hon-input:focus { border-color:rgba(204,0,0,0.4); }
        .hon-select { width:100%; background:#111; border:1px solid rgba(255,255,255,0.1); border-radius:7px; color:#fff; padding:9px 12px; font-size:13px; font-family:Inter,sans-serif; outline:none; }
        .hon-label { font-size:10px; font-family:Montserrat,sans-serif; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:5px; display:block; }
        .hon-field { margin-bottom:13px; }
        .hon-row2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:520px){.hon-row2{grid-template-columns:1fr;}}
      `}</style>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, padding: "10px 20px", borderRadius: 8, fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 700, zIndex: 9999, background: toast.tipo === "err" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)", border: `1px solid ${toast.tipo === "err" ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`, color: toast.tipo === "err" ? "#ef4444" : "#22c55e" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>CRM — Gestión de Honorarios</div>
          <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>Honorarios y Comisiones</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            {items.length} operación{items.length !== 1 ? "es" : ""} registrada{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={abrirNuevo} style={{ padding: "10px 20px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          + Nueva comisión
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total registrado", valor: `$${total.toLocaleString("es-AR")}`, sub: `${items.length} ops`, color: "#fff" },
          { label: "Cobrado", valor: `$${cobrado.toLocaleString("es-AR")}`, sub: `${pctCobro}% de cobro`, color: "#22c55e" },
          { label: "Pendiente de cobro", valor: `$${pendiente.toLocaleString("es-AR")}`, sub: `${items.filter(c => c.estado === "pendiente" || c.estado === "parcial").length} ops`, color: "#f59e0b" },
          { label: "Operaciones perdidas", valor: String(items.filter(c => c.estado === "perdida").length), sub: "que no se concretaron", color: "#ef4444" },
        ].map(k => (
          <div key={k.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.valor}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Barra de cobro */}
      {total > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Ratio de cobro</span>
            <span style={{ fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#22c55e" }}>{pctCobro}%</span>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pctCobro}%`, background: "#22c55e", borderRadius: 4, transition: "width 0.5s" }} />
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {LABEL_FILT.map(f => {
          const count = f.key === "todos" ? items.length : items.filter(c => c.estado === f.key).length;
          return (
            <button key={f.key} onClick={() => setFiltro(f.key)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, background: filtro === f.key ? "#cc0000" : "rgba(255,255,255,0.06)", color: filtro === f.key ? "#fff" : "rgba(255,255,255,0.4)" }}>
              {f.label} <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 4 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.3)" }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
            {filtro === "todos" ? "Sin comisiones registradas" : `Sin operaciones en estado "${LABEL_FILT.find(f => f.key === filtro)?.label}"`}
          </div>
          {filtro === "todos" && (
            <button onClick={abrirNuevo} style={{ marginTop: 16, padding: "10px 24px", background: "rgba(204,0,0,0.15)", border: "1px solid rgba(204,0,0,0.3)", borderRadius: 8, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Registrar primera comisión
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrados.map(c => {
            const est = ESTADO_META[c.estado];
            const isOpen = expandido === c.id;
            return (
              <div key={c.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
                {/* Fila principal */}
                <div
                  onClick={() => setExpandido(isOpen ? null : c.id)}
                  style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                >
                  {/* Estado badge */}
                  <div style={{ width: 4, height: 40, borderRadius: 2, background: est.color, flexShrink: 0 }} />

                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.descripcion}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                        {TIPO_LABELS[c.tipo_operacion] ?? c.tipo_operacion}
                      </span>
                      {c.cliente_nombre && (
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                          · {c.cliente_nombre}
                        </span>
                      )}
                      {c.fecha_operacion && (
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                          · {fmtFecha(c.fecha_operacion)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Monto */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: est.color }}>
                      {fmtNum(c.monto_comision, c.moneda_comision)}
                    </div>
                    <span style={{ fontSize: 10, color: est.color, background: est.bg, padding: "2px 8px", borderRadius: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                      {est.label}
                    </span>
                  </div>

                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 14, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* Detalle expandido */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px", background: "rgba(0,0,0,0.2)" }}>
                    {/* Detalles financieros */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginBottom: 14 }}>
                      {[
                        { label: "Comisión acordada", val: fmtNum(c.monto_comision, c.moneda_comision) },
                        { label: "Monto cobrado", val: fmtNum(c.monto_cobrado, c.moneda_comision) },
                        { label: "Saldo pendiente", val: fmtNum(Math.max(0, c.monto_comision - c.monto_cobrado), c.moneda_comision) },
                      ].map(d => (
                        <div key={d.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{d.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "Montserrat,sans-serif" }}>{d.val}</div>
                        </div>
                      ))}
                    </div>

                    {c.notas && (
                      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                        {c.notas}
                      </div>
                    )}

                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => abrirEditar(c)} style={{ padding: "6px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 600, cursor: "pointer" }}>
                        ✏ Editar
                      </button>
                      {c.estado !== "cobrada" && (
                        <button onClick={() => cambiarEstado(c.id, "cobrada")} style={{ padding: "6px 14px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 7, color: "#22c55e", fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: "pointer" }}>
                          ✓ Marcar cobrada
                        </button>
                      )}
                      {c.estado === "pendiente" && (
                        <button onClick={() => cambiarEstado(c.id, "parcial")} style={{ padding: "6px 14px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 7, color: "#3b82f6", fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: "pointer" }}>
                          Cobro parcial
                        </button>
                      )}
                      {c.estado !== "perdida" && (
                        <button onClick={() => cambiarEstado(c.id, "perdida")} style={{ padding: "6px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, color: "#ef4444", fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 600, cursor: "pointer" }}>
                          Operación perdida
                        </button>
                      )}
                      <button onClick={() => eliminar(c.id)} style={{ padding: "6px 12px", background: "transparent", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 7, color: "rgba(239,68,68,0.4)", fontSize: 12, cursor: "pointer", marginLeft: "auto" }}>
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nueva / editar comisión */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 22 }}>
              {editId ? "Editar comisión" : "Nueva comisión"}
            </div>

            <div className="hon-field">
              <label className="hon-label">Descripción de la operación *</label>
              <input className="hon-input" value={form.descripcion} onChange={e => setF("descripcion", e.target.value)} placeholder="Ej: Venta departamento Av. Pellegrini 1200" />
            </div>

            <div className="hon-row2">
              <div className="hon-field">
                <label className="hon-label">Tipo de operación</label>
                <select className="hon-select" value={form.tipo_operacion} onChange={e => setF("tipo_operacion", e.target.value)}>
                  {TIPOS_OP.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="hon-field">
                <label className="hon-label">Estado</label>
                <select className="hon-select" value={form.estado} onChange={e => setF("estado", e.target.value)}>
                  <option value="pendiente">Pendiente</option>
                  <option value="cobrada">Cobrada</option>
                  <option value="parcial">Cobro parcial</option>
                  <option value="perdida">Perdida</option>
                </select>
              </div>
            </div>

            <div className="hon-row2">
              <div className="hon-field">
                <label className="hon-label">Monto de comisión *</label>
                <input className="hon-input" value={form.monto_comision} onChange={e => setF("monto_comision", e.target.value)} placeholder="Ej: 450000" />
              </div>
              <div className="hon-field">
                <label className="hon-label">Moneda</label>
                <select className="hon-select" value={form.moneda_comision} onChange={e => setF("moneda_comision", e.target.value)}>
                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {(form.estado === "cobrada" || form.estado === "parcial") && (
              <div className="hon-field">
                <label className="hon-label">Monto cobrado</label>
                <input className="hon-input" value={form.monto_cobrado} onChange={e => setF("monto_cobrado", e.target.value)} placeholder="Ej: 225000" />
              </div>
            )}

            <div className="hon-row2">
              <div className="hon-field">
                <label className="hon-label">Fecha de operación</label>
                <input type="date" className="hon-input" value={form.fecha_operacion} onChange={e => setF("fecha_operacion", e.target.value)} />
              </div>
              <div className="hon-field">
                <label className="hon-label">Cliente / contraparte</label>
                <input className="hon-input" value={form.cliente_nombre} onChange={e => setF("cliente_nombre", e.target.value)} placeholder="Nombre del cliente" />
              </div>
            </div>

            <div className="hon-field">
              <label className="hon-label">Notas internas</label>
              <textarea className="hon-input" rows={3} value={form.notas} onChange={e => setF("notas", e.target.value)} placeholder="Condiciones especiales, porcentaje de comisión, etc." style={{ resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setModal(false)} style={{ padding: "10px 20px", background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando} style={{ padding: "10px 24px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: guardando ? 0.6 : 1 }}>
                {guardando ? "Guardando..." : editId ? "Guardar cambios" : "Registrar comisión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
