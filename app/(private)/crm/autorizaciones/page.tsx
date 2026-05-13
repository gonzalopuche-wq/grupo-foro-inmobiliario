"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Autorizacion {
  id: string;
  propietario_nombre: string;
  propietario_telefono: string | null;
  propietario_email: string | null;
  direccion: string;
  tipo_operacion: string;
  fecha_inicio: string;
  fecha_vencimiento: string;
  honorarios_pct: number | null;
  precio_referencia: number | null;
  moneda: string;
  observaciones: string | null;
  estado: string;
  propiedad_id: string | null;
}

const ESTADO_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  vigente:   { bg: "rgba(34,197,94,0.12)",  color: "#22c55e",  label: "Vigente" },
  vencida:   { bg: "rgba(239,68,68,0.12)",  color: "#ef4444",  label: "Vencida" },
  renovada:  { bg: "rgba(99,102,241,0.12)", color: "#818cf8",  label: "Renovada" },
  cancelada: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", label: "Cancelada" },
};

const TIPO_OP: Record<string, string> = {
  venta: "Venta", alquiler: "Alquiler", venta_alquiler: "Venta/Alquiler",
};

function diasRestantes(fecha: string): number {
  return Math.ceil((new Date(fecha + "T12:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function alertColor(dias: number, estado: string): string | null {
  if (estado !== "vigente") return null;
  if (dias <= 0) return "#ef4444";
  if (dias <= 7) return "#f97316";
  if (dias <= 15) return "#eab308";
  if (dias <= 30) return "#facc15";
  return null;
}

const EMPTY: Omit<Autorizacion, "id" | "estado" | "propiedad_id"> = {
  propietario_nombre: "",
  propietario_telefono: "",
  propietario_email: "",
  direccion: "",
  tipo_operacion: "venta",
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_vencimiento: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  honorarios_pct: null,
  precio_referencia: null,
  moneda: "USD",
  observaciones: "",
};

export default function AutorizacionesPage() {
  const [items, setItems] = useState<Autorizacion[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todas" | "vigente" | "vencida">("todas");
  const [form, setForm] = useState({ ...EMPTY });
  const [modal, setModal] = useState<"nuevo" | "ver" | null>(null);
  const [verItem, setVerItem] = useState<Autorizacion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const mostrarToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await cargar(user.id);
      setLoading(false);
    };
    init();
  }, []);

  const cargar = async (uid?: string) => {
    const id = uid ?? userId;
    const { data } = await supabase
      .from("autorizaciones_venta")
      .select("*")
      .eq("user_id", id)
      .order("fecha_vencimiento", { ascending: true });
    setItems(data ?? []);
  };

  const guardar = async () => {
    if (!form.propietario_nombre.trim() || !form.direccion.trim() || !form.fecha_vencimiento) {
      mostrarToast("Completá los campos obligatorios", "err"); return;
    }
    setGuardando(true);
    const payload = {
      user_id: userId,
      propietario_nombre: form.propietario_nombre.trim(),
      propietario_telefono: form.propietario_telefono || null,
      propietario_email: form.propietario_email || null,
      direccion: form.direccion.trim(),
      tipo_operacion: form.tipo_operacion,
      fecha_inicio: form.fecha_inicio,
      fecha_vencimiento: form.fecha_vencimiento,
      honorarios_pct: form.honorarios_pct,
      precio_referencia: form.precio_referencia,
      moneda: form.moneda,
      observaciones: form.observaciones || null,
    };
    const { error } = await supabase.from("autorizaciones_venta").insert(payload);
    setGuardando(false);
    if (error) { mostrarToast("Error al guardar", "err"); return; }
    mostrarToast("Autorización registrada");
    setModal(null);
    setForm({ ...EMPTY });
    await cargar();
  };

  const cambiarEstado = async (id: string, estado: string) => {
    await supabase.from("autorizaciones_venta").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
    setVerItem(null);
    setModal(null);
    await cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta autorización?")) return;
    await supabase.from("autorizaciones_venta").delete().eq("id", id);
    setVerItem(null);
    setModal(null);
    await cargar();
  };

  const filtrados = items.filter(i => filtro === "todas" || i.estado === filtro);
  const vencenProximas = items.filter(i => i.estado === "vigente" && diasRestantes(i.fecha_vencimiento) <= 30).length;

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 5, padding: "9px 12px", color: "#fff", fontSize: 13, fontFamily: "Inter,sans-serif",
  };

  if (loading) return <div style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>Cargando...</div>;

  return (
    <>
      <style>{`
        .aut-table { width: 100%; border-collapse: collapse; font-family: Inter,sans-serif; }
        .aut-table th { font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); padding: 8px 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .aut-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; color: rgba(255,255,255,0.75); vertical-align: middle; }
        .aut-table tr:hover td { background: rgba(255,255,255,0.02); cursor: pointer; }
        .aut-badge { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 10px; font-weight: 700; font-family: Montserrat,sans-serif; letter-spacing: 0.08em; }
        .aut-alerta { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 10px; font-size: 10px; font-weight: 700; font-family: Montserrat,sans-serif; }
        .modal-over { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .modal-box { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 28px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
        .modal-title { font-family: Montserrat,sans-serif; font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .field-label { font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: 5px; font-family: Montserrat,sans-serif; font-size: 12px; font-weight: 700; z-index: 999; }
        .toast.ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; }
        .toast.err { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.35); color: #ff6666; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            📋 Autorizaciones de Venta
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            Mandatos con seguimiento automático de vencimiento
          </div>
        </div>
        <button onClick={() => { setForm({ ...EMPTY }); setModal("nuevo"); }} style={{
          padding: "10px 20px", background: "#cc0000", border: "none", borderRadius: 5,
          color: "#fff", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontSize: 10,
          fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        }}>
          + Nueva Autorización
        </button>
      </div>

      {/* Alertas proximidad */}
      {vencenProximas > 0 && (
        <div style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ fontSize: 13, color: "#eab308" }}>
            <strong>{vencenProximas}</strong> autorización{vencenProximas > 1 ? "es" : ""} vence{vencenProximas > 1 ? "n" : ""} en los próximos 30 días
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["todas", "vigente", "vencida"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "6px 16px", borderRadius: 20, border: "1px solid",
            borderColor: filtro === f ? "#cc0000" : "rgba(255,255,255,0.12)",
            background: filtro === f ? "rgba(200,0,0,0.1)" : "transparent",
            color: filtro === f ? "#fff" : "rgba(255,255,255,0.4)",
            cursor: "pointer", fontSize: 11, fontWeight: 600,
          }}>
            {f === "todas" ? `Todas (${items.length})` : f === "vigente" ? `Vigentes (${items.filter(i => i.estado === "vigente").length})` : `Vencidas (${items.filter(i => i.estado === "vencida").length})`}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
          No hay autorizaciones registradas.
          <br /><br />
          <button onClick={() => { setForm({ ...EMPTY }); setModal("nuevo"); }} style={{ background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.3)", color: "#cc0000", borderRadius: 5, padding: "10px 20px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Registrar primera autorización
          </button>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="aut-table">
            <thead>
              <tr>
                <th>Propietario</th>
                <th>Dirección</th>
                <th>Operación</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Días</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(item => {
                const dias = diasRestantes(item.fecha_vencimiento);
                const alerta = alertColor(dias, item.estado);
                const est = ESTADO_COLORS[item.estado] ?? ESTADO_COLORS.vigente;
                return (
                  <tr key={item.id} onClick={() => { setVerItem(item); setModal("ver"); }}>
                    <td style={{ fontWeight: 600, color: "#fff" }}>{item.propietario_nombre}</td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.direccion}</td>
                    <td><span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{TIPO_OP[item.tipo_operacion] ?? item.tipo_operacion}</span></td>
                    <td>{new Date(item.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>
                      <span className="aut-badge" style={{ background: est.bg, color: est.color }}>{est.label}</span>
                    </td>
                    <td>
                      {alerta ? (
                        <span className="aut-alerta" style={{ background: `${alerta}15`, color: alerta, border: `1px solid ${alerta}40` }}>
                          {dias <= 0 ? "Vencida" : dias <= 7 ? `⚠️ ${dias}d` : `⚠️ ${dias}d`}
                        </span>
                      ) : item.estado === "vigente" ? (
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{dias}d</span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nuevo */}
      {modal === "nuevo" && (
        <div className="modal-over" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal-box">
            <div className="modal-title">📋 Nueva Autorización</div>

            <div style={{ marginBottom: 12 }}>
              <div className="field-label">Propietario *</div>
              <input style={inp} value={form.propietario_nombre} onChange={e => setForm(f => ({ ...f, propietario_nombre: e.target.value }))} placeholder="Nombre completo" />
            </div>
            <div className="field-row">
              <div>
                <div className="field-label">Teléfono</div>
                <input style={inp} value={form.propietario_telefono ?? ""} onChange={e => setForm(f => ({ ...f, propietario_telefono: e.target.value }))} placeholder="+54 341..." />
              </div>
              <div>
                <div className="field-label">Email</div>
                <input style={inp} value={form.propietario_email ?? ""} onChange={e => setForm(f => ({ ...f, propietario_email: e.target.value }))} placeholder="email@..." />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="field-label">Dirección del inmueble *</div>
              <input style={inp} value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} placeholder="Calle, número, barrio" />
            </div>
            <div className="field-row">
              <div>
                <div className="field-label">Tipo de operación</div>
                <select style={{ ...inp, cursor: "pointer" }} value={form.tipo_operacion} onChange={e => setForm(f => ({ ...f, tipo_operacion: e.target.value }))}>
                  <option value="venta">Venta</option>
                  <option value="alquiler">Alquiler</option>
                  <option value="venta_alquiler">Venta / Alquiler</option>
                </select>
              </div>
              <div>
                <div className="field-label">Honorarios (%)</div>
                <input style={inp} type="number" min={0} max={10} step={0.5} value={form.honorarios_pct ?? ""} onChange={e => setForm(f => ({ ...f, honorarios_pct: e.target.value ? Number(e.target.value) : null }))} placeholder="3" />
              </div>
            </div>
            <div className="field-row">
              <div>
                <div className="field-label">Precio de referencia</div>
                <input style={inp} type="number" value={form.precio_referencia ?? ""} onChange={e => setForm(f => ({ ...f, precio_referencia: e.target.value ? Number(e.target.value) : null }))} placeholder="150000" />
              </div>
              <div>
                <div className="field-label">Moneda</div>
                <select style={{ ...inp, cursor: "pointer" }} value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option>USD</option>
                  <option>ARS</option>
                  <option>EUR</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div>
                <div className="field-label">Fecha inicio</div>
                <input style={inp} type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <div className="field-label">Vencimiento *</div>
                <input style={inp} type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div className="field-label">Observaciones</div>
              <textarea style={{ ...inp, minHeight: 64, resize: "vertical" }} value={form.observaciones ?? ""} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Notas, condiciones especiales..." />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ padding: "10px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 4, color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ padding: "10px 24px", background: "#cc0000", border: "none", borderRadius: 4, color: "#fff", cursor: guardando ? "not-allowed" : "pointer", opacity: guardando ? 0.6 : 1, fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ver */}
      {modal === "ver" && verItem && (() => {
        const dias = diasRestantes(verItem.fecha_vencimiento);
        const alerta = alertColor(dias, verItem.estado);
        const est = ESTADO_COLORS[verItem.estado] ?? ESTADO_COLORS.vigente;
        const row = (label: string, val: string | null | undefined) => val ? (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{val}</div>
          </div>
        ) : null;
        return (
          <div className="modal-over" onClick={e => { if (e.target === e.currentTarget) { setModal(null); setVerItem(null); } }}>
            <div className="modal-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div className="modal-title" style={{ marginBottom: 0 }}>📋 Autorización</div>
                <button onClick={() => { setModal(null); setVerItem(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <span className="aut-badge" style={{ background: est.bg, color: est.color }}>{est.label}</span>
                {alerta && <span className="aut-alerta" style={{ background: `${alerta}15`, color: alerta, border: `1px solid ${alerta}40` }}>{dias <= 0 ? "Vencida" : `⚠️ Vence en ${dias} días`}</span>}
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", padding: "3px 8px", background: "rgba(255,255,255,0.04)", borderRadius: 10 }}>{TIPO_OP[verItem.tipo_operacion]}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                {row("Propietario", verItem.propietario_nombre)}
                {row("Dirección", verItem.direccion)}
                {row("Teléfono", verItem.propietario_telefono)}
                {row("Email", verItem.propietario_email)}
                {row("Precio de referencia", verItem.precio_referencia ? `${verItem.moneda} ${verItem.precio_referencia.toLocaleString("es-AR")}` : null)}
                {row("Honorarios", verItem.honorarios_pct ? `${verItem.honorarios_pct}%` : null)}
                {row("Fecha inicio", new Date(verItem.fecha_inicio + "T12:00:00").toLocaleDateString("es-AR"))}
                {row("Vencimiento", new Date(verItem.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR"))}
              </div>
              {verItem.observaciones && row("Observaciones", verItem.observaciones)}

              {verItem.propietario_telefono && (
                <a href={`https://wa.me/${verItem.propietario_telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 14px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 5, color: "#22c55e", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  💬 WhatsApp al propietario
                </a>
              )}

              {verItem.estado === "vigente" && (
                <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                  <button onClick={() => cambiarEstado(verItem.id, "renovada")} style={{ padding: "8px 16px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 4, color: "#818cf8", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🔄 Marcar renovada</button>
                  <button onClick={() => cambiarEstado(verItem.id, "cancelada")} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Cancelar</button>
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => eliminar(verItem.id)} style={{ padding: "6px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, color: "#ef4444", cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "Montserrat,sans-serif", letterSpacing: "0.08em" }}>Eliminar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
