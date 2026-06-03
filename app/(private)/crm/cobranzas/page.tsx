"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// Usa la tabla crm_contratos (migración 097) + columnas dia_vencimiento/estado (migración 105)
interface Contrato {
  id: string;
  perfil_id: string;
  inquilino_nombre: string;
  inquilino_telefono: string | null;
  propietario_nombre: string;
  direccion: string;
  alquiler_actual: number;
  moneda: "ARS" | "USD";
  dia_vencimiento: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: "activo" | "finalizado" | "en-proceso";
  notas: string | null;
}

interface Pago {
  id: string;
  contrato_id: string;
  mes: string;
  monto: number | null;
  fecha_pago: string | null;
  estado: "pagado" | "pendiente" | "parcial" | "moroso";
  diferencia: number;
  notas: string | null;
}

const FORM_VACIO = {
  inquilino_nombre: "", propietario_nombre: "", inquilino_telefono: "",
  direccion: "",
  alquiler_actual: "", moneda: "ARS" as "ARS" | "USD",
  dia_vencimiento: "5", fecha_inicio: "", fecha_fin: "", notas: "",
};

function mesLabel(yyyymm: string): string {
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const [y, m] = yyyymm.split("-");
  return `${MESES[parseInt(m) - 1]} ${y}`;
}

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function diasMora(mes: string, diaVenc: number): number {
  const hoy = new Date();
  const venc = new Date(`${mes}-${String(diaVenc).padStart(2, "0")}`);
  const diff = Math.floor((hoy.getTime() - venc.getTime()) / 86400000);
  return Math.max(0, diff);
}

const estadoColor = (estado: string | undefined) => {
  if (!estado || estado === "pendiente") return "#6b7280";
  if (estado === "pagado") return "#3abab6";
  if (estado === "parcial") return "#d4960c";
  if (estado === "moroso") return "#990000";
  return "#6b7280";
};

const estadoLabel = (e: string | undefined) => {
  if (!e || e === "pendiente") return "⏳ Pendiente";
  if (e === "pagado") return "✅ Pagado";
  if (e === "moroso") return "🔴 Moroso";
  if (e === "parcial") return "⚠️ Parcial";
  return e;
};

// ── MercadoPago modal state ───────────────────────────────────────────────────
interface MpModal {
  contrato: Contrato;
  concepto: string;
  monto: string;
  email: string;
}

interface MpResult {
  init_point: string;
  preference_id: string;
  contrato_nombre: string;
}

export default function CobranzasPage() {
  const [uid, setUid]             = useState<string | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [pagos, setPagos]         = useState<Pago[]>([]);
  const [mes, setMes]             = useState(mesActual());
  const [tc, setTc]               = useState(1300);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]         = useState<string | null>(null);
  const [verFinalizados, setVerFinalizados] = useState(false);

  // MercadoPago states
  const [mpModal, setMpModal]     = useState<MpModal | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpResult, setMpResult]   = useState<MpResult | null>(null);
  const [mpCopied, setMpCopied]   = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  const abrirMpModal = useCallback((c: Contrato) => {
    setMpResult(null);
    setMpCopied(false);
    setMpModal({
      contrato: c,
      concepto: `Alquiler ${mesLabel(mesActual())} — ${c.direccion}`,
      monto: String(c.alquiler_actual),
      email: "",
    });
  }, []);

  const generarLinkMP = async () => {
    if (!mpModal || !uid) return;
    const { contrato, concepto, monto, email } = mpModal;
    if (!email.trim()) { showToast("Ingresá el email del pagador"); return; }
    if (!monto || parseFloat(monto) <= 0) { showToast("Ingresá un monto válido"); return; }
    setMpLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/pagos/crear-preferencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          contrato_id: contrato.id,
          concepto,
          monto: parseFloat(monto),
          moneda: contrato.moneda,
          email_pagador: email.trim(),
          descripcion: concepto,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Error al generar link"); setMpLoading(false); return; }
      setMpResult({ init_point: data.init_point, preference_id: data.preference_id, contrato_nombre: contrato.inquilino_nombre });
    } catch {
      showToast("Error de conexión");
    }
    setMpLoading(false);
  };

  const copiarLinkMP = () => {
    if (!mpResult) return;
    navigator.clipboard.writeText(mpResult.init_point).then(() => {
      setMpCopied(true);
      setTimeout(() => setMpCopied(false), 2000);
    });
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
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("crm_contratos")
        .select("id,perfil_id,inquilino_nombre,inquilino_telefono,propietario_nombre,direccion,alquiler_actual,moneda,dia_vencimiento,fecha_inicio,fecha_fin,estado,notas")
        .eq("perfil_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("crm_pagos_alquiler").select("*").eq("perfil_id", id),
    ]);
    setContratos((c as Contrato[]) ?? []);
    setPagos((p as Pago[]) ?? []);
    setLoading(false);
  };

  const guardarContrato = async () => {
    if (!form.inquilino_nombre.trim() || !form.direccion.trim() || !uid) return;
    setGuardando(true);
    const payload = {
      perfil_id:         uid,
      inquilino_nombre:  form.inquilino_nombre.trim(),
      inquilino_telefono: form.inquilino_telefono || null,
      propietario_nombre: form.propietario_nombre.trim() || "",
      direccion:         form.direccion.trim(),
      alquiler_inicial:  parseFloat(form.alquiler_actual) || 0,
      alquiler_actual:   parseFloat(form.alquiler_actual) || 0,
      moneda:            form.moneda,
      dia_vencimiento:   parseInt(form.dia_vencimiento) || 5,
      fecha_inicio:      form.fecha_inicio || new Date().toISOString().slice(0, 10),
      fecha_fin:         form.fecha_fin || new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().slice(0, 10),
      estado:            "activo" as const,
      notas:             form.notas || null,
      updated_at:        new Date().toISOString(),
    };
    await supabase.from("crm_contratos").insert(payload);
    setGuardando(false);
    setModal(false);
    setForm(FORM_VACIO);
    showToast("Contrato creado");
    cargar(uid);
  };

  const eliminarContrato = async (id: string) => {
    if (!confirm("¿Eliminar este contrato y todos sus pagos?")) return;
    await supabase.from("crm_contratos").delete().eq("id", id);
    showToast("Contrato eliminado");
    cargar(uid!);
  };

  const getPago = (contratoId: string, m: string): Pago | undefined =>
    pagos.find(p => p.contrato_id === contratoId && p.mes === m);

  const toggleEstadoPago = async (contrato: Contrato, m: string, estado: Pago["estado"]) => {
    if (!uid) return;
    const existing = getPago(contrato.id, m);
    if (existing) {
      const { data } = await supabase.from("crm_pagos_alquiler")
        .update({
          estado,
          fecha_pago: estado === "pagado" ? new Date().toISOString().slice(0, 10) : existing.fecha_pago,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (data) setPagos(prev => prev.map(p => p.id === existing.id ? (data as Pago) : p));
    } else {
      const { data } = await supabase.from("crm_pagos_alquiler")
        .insert({
          perfil_id:   uid,
          contrato_id: contrato.id,
          mes:         m,
          monto:       null,
          fecha_pago:  estado === "pagado" ? new Date().toISOString().slice(0, 10) : null,
          estado,
          diferencia:  0,
          notas:       null,
        })
        .select()
        .single();
      if (data) setPagos(prev => [...prev, data as Pago]);
    }
  };

  const contratosVisibles = useMemo(() =>
    contratos.filter(c => verFinalizados ? c.estado !== "activo" : c.estado === "activo"),
    [contratos, verFinalizados]
  );

  const MESES_DISP = useMemo(() => {
    const set = new Set<string>();
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      set.add(d.toISOString().slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, []);

  const stats = useMemo(() => {
    const activos = contratos.filter(c => c.estado === "activo");
    const pagosMes = activos.map(c => ({ contrato: c, pago: getPago(c.id, mes) }));
    const pagados    = pagosMes.filter(x => x.pago?.estado === "pagado").length;
    const pendientes = pagosMes.filter(x => !x.pago || x.pago.estado === "pendiente").length;
    const morosos    = pagosMes.filter(x => x.pago?.estado === "moroso").length;
    const totalEsperado = pagosMes.reduce((s, x) => {
      const monto = x.contrato.moneda === "USD" ? x.contrato.alquiler_actual * tc : x.contrato.alquiler_actual;
      return s + monto;
    }, 0);
    const totalCobrado = pagosMes
      .filter(x => x.pago?.estado === "pagado" || x.pago?.estado === "parcial")
      .reduce((s, x) => {
        const base = x.pago?.monto ?? x.contrato.alquiler_actual;
        return s + (x.contrato.moneda === "USD" ? base * tc : base);
      }, 0);
    return { pagados, pendientes, morosos, totalEsperado, totalCobrado };
  }, [contratos, pagos, mes, tc]);

  return (
    <>
      <style>{`
        .cob-wrap { max-width: 1000px; display: flex; flex-direction: column; gap: 16px; }
        .cob-card { background: #111; border: 1px solid var(--gfi-border); border-radius: 12px; padding: 14px 18px; }
        .cob-input { width: 100%; padding: 9px 11px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 4px; color: #fff; font-size: 14px; font-family: var(--font-body); outline: none; box-sizing: border-box; }
        .cob-input:focus { border-color: rgba(200,0,0,0.5); }
        .cob-select { width: 100%; padding: 9px 11px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: 4px; color: #fff; font-size: 14px; font-family: var(--font-body); outline: none; }
        .cob-btn { padding: 7px 14px; border: none; border-radius: 5px; font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s; }
        .cob-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 5px; font-family: var(--font-display); }
        .cob-field { margin-bottom: 12px; }
        @media (max-width: 600px) {
          .cob-stats { flex-direction: column !important; }
          .cob-grid3 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="cob-wrap">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "#fff" }}>
              Cobranzas <span style={{ color: "#990000" }}>CRM</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 3 }}>
              Seguimiento de pagos mensuales · {mesLabel(mes)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="cob-btn"
              style={{ background: verFinalizados ? "rgba(107,114,128,0.2)" : "rgba(255,255,255,0.06)", color: verFinalizados ? "#9ca3af" : "var(--gfi-text-secondary)", border: "1px solid var(--gfi-border)" }}
              onClick={() => setVerFinalizados(v => !v)}>
              {verFinalizados ? "Ver activos" : "Finalizados"}
            </button>
            <button className="cob-btn" style={{ background: "#990000", color: "#fff" }}
              onClick={() => { setForm(FORM_VACIO); setModal(true); }}>
              + Contrato
            </button>
          </div>
        </div>

        {/* Filtros + stats */}
        <div className="cob-card" style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label className="cob-label">Mes</label>
            <select className="cob-select" style={{ width: 130 }} value={mes} onChange={e => setMes(e.target.value)}>
              {MESES_DISP.map(m => <option key={m} value={m}>{mesLabel(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="cob-label">TC ARS/USD</label>
            <input type="number" className="cob-input" style={{ width: 90 }} value={tc}
              onChange={e => setTc(parseFloat(e.target.value) || 1)} step={50} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 16 }} className="cob-stats">
            {[
              { n: stats.pagados,    l: "Pagados",    c: "#3abab6" },
              { n: stats.pendientes, l: "Pendientes", c: "#d4960c" },
              { n: stats.morosos,    l: "Morosos",    c: "#990000" },
              { n: `${Math.round(stats.totalCobrado / 1000)}k`, l: "Cobrado (k)", c: "#e5e5e5" },
            ].map(s => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: s.c }}>{s.n}</div>
                <div style={{ fontSize: 10, color: "var(--gfi-text-muted)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Barra de cobranza */}
        {stats.totalEsperado > 0 && (
          <div className="cob-card" style={{ padding: "12px 16px" }}>
            <div style={{ background: "#0a0a0a", borderRadius: 6, height: 10, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: `${Math.min((stats.totalCobrado / stats.totalEsperado) * 100, 100)}%`, height: "100%", background: "#3abab6", transition: "width 0.5s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--gfi-text-muted)" }}>
              <span>Cobrado: ARS {fmt(Math.round(stats.totalCobrado / 1000))}k</span>
              <span style={{ color: "#3abab6", fontWeight: 700 }}>{Math.round((stats.totalCobrado / stats.totalEsperado) * 100)}%</span>
              <span>Esperado: ARS {fmt(Math.round(stats.totalEsperado / 1000))}k</span>
            </div>
          </div>
        )}

        {/* Lista de contratos */}
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--gfi-text-muted)", padding: 40 }}>Cargando...</div>
        ) : contratosVisibles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--gfi-text-dim)", fontFamily: "var(--font-display)" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 700 }}>Sin contratos activos</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Hacé clic en "+ Contrato" para agregar uno</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {contratosVisibles.map(c => {
              const p = getPago(c.id, mes);
              const estado = p?.estado ?? "pendiente";
              const mora = (!p || estado === "pendiente" || estado === "moroso") ? diasMora(mes, c.dia_vencimiento) : 0;
              const montoDisplay = `${c.moneda} ${fmt(c.alquiler_actual)}`;
              return (
                <div key={c.id} className="cob-card" style={{ borderColor: `${estadoColor(estado)}33` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#fff" }}>{c.inquilino_nombre}</div>
                      <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 2 }}>{c.direccion}</div>
                      <div style={{ fontSize: 11, color: "var(--gfi-text-dim)", marginTop: 2 }}>
                        Vence día {c.dia_vencimiento} · {montoDisplay}/mes
                        {c.propietario_nombre && <span> · Prop: {c.propietario_nombre}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: estadoColor(estado) }}>
                        {estadoLabel(estado)}
                      </div>
                      {mora > 0 && <div style={{ fontSize: 11, color: "#990000", marginTop: 2 }}>{mora} días mora</div>}
                      {p?.fecha_pago && <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 2 }}>Pagó: {p.fecha_pago}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(["pagado", "parcial", "pendiente", "moroso"] as const).map(est => (
                      <button key={est} className="cob-btn"
                        style={{
                          background: estado === est ? `${estadoColor(est)}22` : "var(--gfi-bg-card)",
                          border: `1px solid ${estado === est ? estadoColor(est) : "var(--gfi-border)"}`,
                          color: estado === est ? estadoColor(est) : "var(--gfi-text-muted)",
                          padding: "4px 12px", fontSize: 10,
                        }}
                        onClick={() => toggleEstadoPago(c, mes, est)}>
                        {estadoLabel(est)}
                      </button>
                    ))}
                    {c.inquilino_telefono && (
                      <a href={`https://wa.me/54${c.inquilino_telefono}?text=${encodeURIComponent(`Hola ${c.inquilino_nombre.split(",")[0]}, te recordamos que el alquiler de ${mesLabel(mes)} por ${montoDisplay} vence el día ${c.dia_vencimiento}. Gracias!`)}`}
                        target="_blank" rel="noreferrer"
                        style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: 5, color: "#25d366", padding: "4px 12px", fontSize: 10, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em" }}>
                        💬 WA
                      </a>
                    )}
                    {c.estado === "activo" && (
                      <button className="cob-btn"
                        style={{ background: "rgba(0,180,120,0.10)", border: "1px solid rgba(0,180,120,0.35)", color: "#00c87a", padding: "4px 12px", fontSize: 10 }}
                        onClick={() => abrirMpModal(c)}>
                        💳 MP
                      </button>
                    )}
                    <button className="cob-btn"
                      style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.6)", border: "1px solid rgba(239,68,68,0.2)", padding: "4px 10px", fontSize: 10, marginLeft: "auto" }}
                      onClick={() => eliminarContrato(c.id)}>
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal nuevo contrato */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 20 }}>Nuevo Contrato</div>

            <div className="cob-field">
              <label className="cob-label">Inquilino *</label>
              <input className="cob-input" placeholder="Apellido, Nombre" value={form.inquilino_nombre} onChange={e => setForm(f => ({ ...f, inquilino_nombre: e.target.value }))} />
            </div>
            <div className="cob-field">
              <label className="cob-label">Propietario</label>
              <input className="cob-input" placeholder="Apellido, Nombre del dueño" value={form.propietario_nombre} onChange={e => setForm(f => ({ ...f, propietario_nombre: e.target.value }))} />
            </div>
            <div className="cob-field">
              <label className="cob-label">Dirección / Propiedad *</label>
              <input className="cob-input" placeholder="Ej: Corrientes 1234 3°A" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="cob-field">
              <label className="cob-label">Teléfono inquilino (sin 0 ni 15)</label>
              <input className="cob-input" placeholder="1112345678" value={form.inquilino_telefono} onChange={e => setForm(f => ({ ...f, inquilino_telefono: e.target.value }))} />
            </div>
            <div className="cob-grid3" style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 12 }}>
              <div className="cob-field">
                <label className="cob-label">Alquiler mensual</label>
                <input className="cob-input" type="number" placeholder="0" value={form.alquiler_actual} onChange={e => setForm(f => ({ ...f, alquiler_actual: e.target.value }))} />
              </div>
              <div className="cob-field">
                <label className="cob-label">Moneda</label>
                <select className="cob-select" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value as "ARS" | "USD" }))}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="cob-field">
                <label className="cob-label">Día venc.</label>
                <input className="cob-input" type="number" min={1} max={31} value={form.dia_vencimiento} onChange={e => setForm(f => ({ ...f, dia_vencimiento: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="cob-field">
                <label className="cob-label">Fecha inicio</label>
                <input className="cob-input" type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div className="cob-field">
                <label className="cob-label">Fecha fin</label>
                <input className="cob-input" type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
            </div>
            <div className="cob-field">
              <label className="cob-label">Notas</label>
              <textarea className="cob-input" rows={2} style={{ resize: "vertical" }} placeholder="Notas internas..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button className="cob-btn" style={{ background: "rgba(255,255,255,0.06)", color: "var(--gfi-text-secondary)", border: "1px solid var(--gfi-border)" }} onClick={() => setModal(false)}>Cancelar</button>
              <button className="cob-btn" style={{ background: "#990000", color: "#fff", opacity: guardando ? 0.6 : 1 }} onClick={guardarContrato} disabled={guardando}>
                {guardando ? "Guardando..." : "Crear contrato"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal MercadoPago */}
      {mpModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => { setMpModal(null); setMpResult(null); }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#fff" }}>
                  Cobrar con <span style={{ color: "#00c87a" }}>MercadoPago</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 2 }}>{mpModal.contrato.inquilino_nombre}</div>
              </div>
              <button onClick={() => { setMpModal(null); setMpResult(null); }} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>

            {!mpResult ? (
              <>
                <div className="cob-field">
                  <label className="cob-label">Concepto</label>
                  <input className="cob-input" value={mpModal.concepto}
                    onChange={e => setMpModal(m => m ? { ...m, concepto: e.target.value } : m)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 12 }}>
                  <div className="cob-field">
                    <label className="cob-label">Monto</label>
                    <input className="cob-input" type="number" value={mpModal.monto}
                      onChange={e => setMpModal(m => m ? { ...m, monto: e.target.value } : m)} />
                  </div>
                  <div className="cob-field">
                    <label className="cob-label">Moneda</label>
                    <input className="cob-input" value={mpModal.contrato.moneda} readOnly style={{ opacity: 0.6 }} />
                  </div>
                </div>
                <div className="cob-field">
                  <label className="cob-label">Email del pagador *</label>
                  <input className="cob-input" type="email" placeholder="email@inquilino.com"
                    value={mpModal.email}
                    onChange={e => setMpModal(m => m ? { ...m, email: e.target.value } : m)} />
                </div>
                <button className="cob-btn"
                  style={{ width: "100%", background: "rgba(0,180,120,0.15)", border: "1px solid rgba(0,180,120,0.4)", color: "#00c87a", padding: "12px 0", fontSize: 13, opacity: mpLoading ? 0.6 : 1, marginTop: 4 }}
                  onClick={generarLinkMP} disabled={mpLoading}>
                  {mpLoading ? "Generando..." : "Generar link de pago"}
                </button>
              </>
            ) : (
              /* Resultado: link generado */
              <div>
                <div style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Link de pago generado para {mpResult.contrato_nombre}</div>
                  <div style={{ fontSize: 12, color: "#00c87a", wordBreak: "break-all", fontFamily: "monospace" }}>
                    {mpResult.init_point}
                  </div>
                </div>

                {/* QR */}
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(mpResult.init_point)}&size=180x180&bgcolor=0f172a&color=00c87a&margin=10`}
                    alt="QR de pago"
                    style={{ borderRadius: 10, border: "1px solid #1e293b", width: 180, height: 180 }}
                  />
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>Escaneá para pagar</div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button className="cob-btn"
                    style={{ flex: 1, background: mpCopied ? "rgba(0,180,120,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${mpCopied ? "rgba(0,180,120,0.5)" : "var(--gfi-border)"}`, color: mpCopied ? "#00c87a" : "#fff", padding: "10px 0", fontSize: 12 }}
                    onClick={copiarLinkMP}>
                    {mpCopied ? "✓ Copiado" : "Copiar link"}
                  </button>
                  <a href={mpResult.init_point} target="_blank" rel="noreferrer"
                    className="cob-btn"
                    style={{ flex: 1, background: "rgba(0,180,120,0.15)", border: "1px solid rgba(0,180,120,0.4)", color: "#00c87a", padding: "10px 0", fontSize: 12, textDecoration: "none", textAlign: "center" }}>
                    Abrir en MP
                  </a>
                </div>

                <button className="cob-btn"
                  style={{ width: "100%", marginTop: 10, background: "transparent", border: "1px solid #1e293b", color: "#475569", padding: "8px 0", fontSize: 11 }}
                  onClick={() => setMpResult(null)}>
                  Generar otro link
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid var(--gfi-border)", borderRadius: 8, padding: "12px 20px", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}
    </>
  );
}
