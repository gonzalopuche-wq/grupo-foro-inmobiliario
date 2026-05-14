"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

interface Negocio {
  id: string;
  titulo: string;
  tipo_operacion: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  fecha_cierre: string | null;
}

interface Cobro {
  id: string;
  negocio_id: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  fecha_cobro: string;
  metodo_cobro: string | null;
  notas: string | null;
  created_at: string;
  crm_negocios?: { titulo: string; tipo_operacion: string } | null;
}

const formatMoneda = (v: number, m = "USD") =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: m, maximumFractionDigits: 0 }).format(v);

const METODOS = ["efectivo","transferencia","cheque","otro"];

const FORM_VACIO = {
  negocio_id: "", concepto: "", monto: "",
  moneda: "USD", fecha_cobro: new Date().toLocaleDateString("en-CA"),
  metodo_cobro: "transferencia", notas: "",
};

export default function HonorariosPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [tab, setTab] = useState<"resumen" | "cobros" | "proyeccion">("resumen");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);
      setUserId(session.user.id);
      await cargarDatos(session.access_token, session.user.id);
    };
    init();
  }, []);

  const cargarDatos = async (tok: string, uid: string) => {
    setLoading(true);
    const [{ data: neg }, cobrosRes] = await Promise.all([
      supabase.from("crm_negocios")
        .select("id, titulo, tipo_operacion, etapa, valor_operacion, moneda, honorarios_pct, fecha_cierre")
        .eq("perfil_id", uid).eq("archivado", false)
        .order("created_at", { ascending: false }),
      fetch("/api/crm/honorarios", { headers: { Authorization: `Bearer ${tok}` } }),
    ]);
    setNegocios(neg ?? []);
    if (cobrosRes.ok) {
      const d = await cobrosRes.json();
      setCobros(d.cobros ?? []);
    }
    setLoading(false);
  };

  const stats = useMemo(() => {
    const negActivos = negocios.filter(n => n.etapa !== "perdido");
    const negCerrados = negocios.filter(n => n.etapa === "cerrado");

    const calcHon = (ns: Negocio[], moneda: string) =>
      ns.filter(n => n.moneda === moneda && n.valor_operacion && n.honorarios_pct)
        .reduce((s, n) => s + (n.valor_operacion! * n.honorarios_pct!) / 100, 0);

    return {
      proy_usd: calcHon(negActivos, "USD"),
      proy_ars: calcHon(negActivos, "ARS"),
      real_usd: calcHon(negCerrados, "USD"),
      real_ars: calcHon(negCerrados, "ARS"),
      cobr_usd: cobros.filter(c => c.moneda === "USD").reduce((s, c) => s + c.monto, 0),
      cobr_ars: cobros.filter(c => c.moneda === "ARS").reduce((s, c) => s + c.monto, 0),
      pendiente_usd: Math.max(0,
        negocios.filter(n => n.etapa === "cerrado" && n.moneda === "USD" && n.valor_operacion && n.honorarios_pct)
          .reduce((s, n) => s + (n.valor_operacion! * n.honorarios_pct!) / 100, 0) -
        cobros.filter(c => c.moneda === "USD").reduce((s, c) => s + c.monto, 0)
      ),
    };
  }, [negocios, cobros]);

  const guardarCobro = async () => {
    if (!form.concepto || !form.monto || !form.fecha_cobro || !token) return;
    setGuardando(true);
    const res = await fetch("/api/crm/honorarios", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, negocio_id: form.negocio_id || null }),
    });
    const d = await res.json();
    if (!d.error) {
      setCobros(prev => [d.cobro, ...prev]);
      setForm(FORM_VACIO);
      setMostrarForm(false);
    }
    setGuardando(false);
  };

  const eliminarCobro = async (id: string) => {
    if (!confirm("¿Eliminar este cobro?") || !token) return;
    await fetch("/api/crm/honorarios", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCobros(prev => prev.filter(c => c.id !== id));
  };

  const setF = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const ETAPA_LABELS: Record<string, string> = {
    prospecto: "Prospecto", contactado: "Contactado",
    visita_coordinada: "Visita coord.", visita_realizada: "Visita realiz.",
    oferta_enviada: "Oferta enviada", negociacion: "Negociación",
    reserva: "Reserva", escritura: "Escritura",
    cerrado: "Cerrado ✓", perdido: "Perdido",
  };

  return (
    <div style={{ fontFamily: "Inter,sans-serif", color: "#fff", maxWidth: 960, margin: "0 auto" }}>
      <style>{`
        .hon-tab { padding: 8px 18px; border: none; border-bottom: 2px solid transparent; background: transparent; color: rgba(255,255,255,0.4); font-family: Montserrat,sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .hon-tab.active { color: #fff; border-bottom-color: #cc0000; }
        .hon-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; font-family: Inter,sans-serif; }
        .hon-input:focus { outline: none; border-color: rgba(200,0,0,0.5); }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>💰</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>Gestión de Honorarios</h1>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Proyección, control y registro de cobros</p>
          </div>
        </div>
        <button onClick={() => setMostrarForm(true)} style={{
          padding: "9px 18px", background: "#cc0000", border: "none", borderRadius: 8,
          color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "Montserrat,sans-serif",
          cursor: "pointer", letterSpacing: "0.08em",
        }}>+ Registrar cobro</button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 24, display: "flex", gap: 0 }}>
        {(["resumen","cobros","proyeccion"] as const).map(t => (
          <button key={t} className={`hon-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "resumen" ? "Resumen" : t === "cobros" ? "Cobros registrados" : "Proyección"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>Cargando...</div>
      ) : (
        <>
          {tab === "resumen" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14, marginBottom: 28 }}>
                {[
                  { label: "Hon. proyectados USD", value: formatMoneda(stats.proy_usd), sub: stats.proy_ars > 0 ? `+ ARS ${new Intl.NumberFormat("es-AR").format(stats.proy_ars)}` : "Negocios activos", color: "#f59e0b" },
                  { label: "Hon. realizados USD", value: formatMoneda(stats.real_usd), sub: stats.real_ars > 0 ? `+ ARS ${new Intl.NumberFormat("es-AR").format(stats.real_ars)}` : "Negocios cerrados", color: "#22c55e" },
                  { label: "Cobrado USD", value: formatMoneda(stats.cobr_usd), sub: stats.cobr_ars > 0 ? `+ ARS ${new Intl.NumberFormat("es-AR").format(stats.cobr_ars)}` : "Registrado en sistema", color: "#60a5fa" },
                  { label: "Pendiente cobrar", value: formatMoneda(stats.pendiente_usd), sub: "Realizados - cobrados", color: "#f87171" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "Montserrat,sans-serif" }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Últimos cobros */}
              <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.5)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Últimos cobros
              </h3>
              {cobros.slice(0, 5).length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Aún no registraste ningún cobro</p>
              ) : cobros.slice(0, 5).map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.concepto}</div>
                    {c.crm_negocios && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Negocio: {c.crm_negocios.titulo}</div>}
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{new Date(c.fecha_cobro).toLocaleDateString("es-AR")} · {c.metodo_cobro ?? "—"}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#22c55e", fontFamily: "Montserrat,sans-serif" }}>{formatMoneda(c.monto, c.moneda)}</div>
                </div>
              ))}
            </div>
          )}

          {tab === "cobros" && (
            <div>
              {cobros.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
                  <p>No hay cobros registrados</p>
                  <button onClick={() => setMostrarForm(true)} style={{ marginTop: 8, padding: "8px 16px", background: "#cc0000", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Registrar primer cobro
                  </button>
                </div>
              ) : cobros.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>💰</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{c.concepto}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#22c55e", fontFamily: "Montserrat,sans-serif", marginLeft: "auto" }}>{formatMoneda(c.monto, c.moneda)}</span>
                    </div>
                    {c.crm_negocios && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>📋 {c.crm_negocios.titulo} ({c.crm_negocios.tipo_operacion})</div>}
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      📅 {new Date(c.fecha_cobro).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
                      {c.metodo_cobro && ` · ${c.metodo_cobro}`}
                      {c.notas && ` · ${c.notas}`}
                    </div>
                  </div>
                  <button onClick={() => eliminarCobro(c.id)} style={{ padding: "4px 10px", background: "none", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, color: "rgba(239,68,68,0.6)", fontSize: 11, cursor: "pointer" }}>
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "proyeccion" && (
            <div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>
                Negocios activos con valor de operación y porcentaje de honorarios configurado.
              </p>
              {negocios.filter(n => n.valor_operacion && n.honorarios_pct && n.etapa !== "perdido").length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                  No hay negocios con valor de operación y honorarios configurados.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["Negocio","Tipo","Etapa","Valor op.","Hon.%","Hon. estimados"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {negocios.filter(n => n.valor_operacion && n.honorarios_pct && n.etapa !== "perdido").map(n => {
                      const hon = (n.valor_operacion! * n.honorarios_pct!) / 100;
                      return (
                        <tr key={n.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "10px 10px", fontWeight: 500 }}>{n.titulo}</td>
                          <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.5)", textTransform: "capitalize" }}>{n.tipo_operacion}</td>
                          <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.5)" }}>{ETAPA_LABELS[n.etapa] ?? n.etapa}</td>
                          <td style={{ padding: "10px 10px" }}>{formatMoneda(n.valor_operacion!, n.moneda)}</td>
                          <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.5)" }}>{n.honorarios_pct}%</td>
                          <td style={{ padding: "10px 10px", color: n.etapa === "cerrado" ? "#22c55e" : "#f59e0b", fontWeight: 700, fontFamily: "Montserrat,sans-serif" }}>
                            {formatMoneda(hon, n.moneda)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal registrar cobro */}
      {mostrarForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 500, position: "relative" }}>
            <button style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }} onClick={() => setMostrarForm(false)}>&times;</button>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, fontFamily: "Montserrat,sans-serif" }}>Registrar cobro de honorarios</h3>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Negocio vinculado (opcional)</label>
                <select value={form.negocio_id} onChange={e => setF("negocio_id", e.target.value)} className="hon-input" style={{ cursor: "pointer" }}>
                  <option value="">Sin negocio específico</option>
                  {negocios.filter(n => n.etapa !== "perdido").map(n => (
                    <option key={n.id} value={n.id}>{n.titulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Concepto *</label>
                <input className="hon-input" value={form.concepto} onChange={e => setF("concepto", e.target.value)} placeholder="Ej: Honorarios venta Av. Pellegrini 1234" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Monto *</label>
                  <input className="hon-input" type="number" value={form.monto} onChange={e => setF("monto", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Moneda</label>
                  <select className="hon-input" value={form.moneda} onChange={e => setF("moneda", e.target.value)} style={{ cursor: "pointer" }}>
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Fecha cobro *</label>
                  <input className="hon-input" type="date" value={form.fecha_cobro} onChange={e => setF("fecha_cobro", e.target.value)} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Método</label>
                  <select className="hon-input" value={form.metodo_cobro} onChange={e => setF("metodo_cobro", e.target.value)} style={{ cursor: "pointer" }}>
                    {METODOS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Notas</label>
                <input className="hon-input" value={form.notas} onChange={e => setF("notas", e.target.value)} placeholder="Observaciones opcionales..." />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setMostrarForm(false)} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13 }}>
                Cancelar
              </button>
              <button
                onClick={guardarCobro}
                disabled={guardando || !form.concepto || !form.monto}
                style={{ flex: 2, padding: "10px", background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer", opacity: guardando ? 0.6 : 1 }}>
                {guardando ? "Guardando..." : "Registrar cobro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
