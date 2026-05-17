"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

interface Contrato {
  id: string;
  inquilino: string;
  propiedad: string;
  telefono: string;
  alquilerBase: number;
  moneda: "ARS" | "USD";
  diaVencimiento: number;
  fechaInicio: string;
  fechaFin: string;
  estado: "activo" | "finalizado" | "en-proceso";
  notas: string;
}

interface Pago {
  id: string;
  contratoId: string;
  mes: string; // YYYY-MM
  monto: number;
  fechaPago: string | null;
  estado: "pagado" | "pendiente" | "parcial" | "moroso";
  diferencia: number; // diferencia vs alquiler base (ajustes, multas, etc.)
  notas: string;
}

const STORAGE_CONTRATOS = "crm_cobranzas_contratos_v1";
const STORAGE_PAGOS = "crm_cobranzas_pagos_v1";

function mesLabel(yyyymm: string): string {
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const [y, m] = yyyymm.split("-");
  return `${MESES[parseInt(m)-1]} ${y}`;
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

const CONTRATOS_DEMO: Contrato[] = [
  { id: "c1", inquilino: "Martínez, Juan", propiedad: "Av. Corrientes 1234 3°A", telefono: "1112345678", alquilerBase: 320000, moneda: "ARS", diaVencimiento: 5, fechaInicio: "2024-01-01", fechaFin: "2026-01-01", estado: "activo", notas: "" },
  { id: "c2", inquilino: "García, María", propiedad: "Palermo Soho — Gurruchaga 780", telefono: "1187654321", alquilerBase: 950, moneda: "USD", diaVencimiento: 1, fechaInicio: "2024-06-01", fechaFin: "2026-06-01", estado: "activo", notas: "" },
  { id: "c3", inquilino: "López, Carlos", propiedad: "Belgrano — Cuba 2100 PB B", telefono: "1198765432", alquilerBase: 450000, moneda: "ARS", diaVencimiento: 10, fechaInicio: "2025-03-01", fechaFin: "2027-03-01", estado: "activo", notas: "" },
];

export default function CobranzasPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [mes, setMes] = useState(mesActual());
  const [modal, setModal] = useState<{ tipo: "contrato" | "pago"; contratoId?: string } | null>(null);
  const [form, setForm] = useState<Partial<Contrato>>({});
  const [tc, setTc] = useState(1300);

  useEffect(() => {
    const storedC = localStorage.getItem(STORAGE_CONTRATOS);
    const storedP = localStorage.getItem(STORAGE_PAGOS);
    setContratos(storedC ? JSON.parse(storedC) : CONTRATOS_DEMO);
    setPagos(storedP ? JSON.parse(storedP) : []);
  }, []);

  const saveContratos = (list: Contrato[]) => { setContratos(list); localStorage.setItem(STORAGE_CONTRATOS, JSON.stringify(list)); };
  const savePagos = (list: Pago[]) => { setPagos(list); localStorage.setItem(STORAGE_PAGOS, JSON.stringify(list)); };

  const getPago = (contratoId: string, m: string): Pago | undefined =>
    pagos.find(p => p.contratoId === contratoId && p.mes === m);

  const toggleEstadoPago = (contratoId: string, m: string, estado: Pago["estado"]) => {
    const contrato = contratos.find(c => c.id === contratoId)!;
    const existing = getPago(contratoId, m);
    const pago: Pago = existing ?? {
      id: `p_${Date.now()}`,
      contratoId,
      mes: m,
      monto: contrato.alquilerBase,
      fechaPago: null,
      estado: "pendiente",
      diferencia: 0,
      notas: "",
    };
    const updated = { ...pago, estado, fechaPago: estado === "pagado" ? new Date().toISOString().slice(0, 10) : pago.fechaPago };
    const newPagos = existing
      ? pagos.map(p => p.id === existing.id ? updated : p)
      : [...pagos, updated];
    savePagos(newPagos);
  };

  const contratosActivos = contratos.filter(c => c.estado === "activo");

  const stats = useMemo(() => {
    const pagosMes = contratosActivos.map(c => {
      const p = getPago(c.id, mes);
      return { contrato: c, pago: p };
    });
    const pagados = pagosMes.filter(x => x.pago?.estado === "pagado").length;
    const pendientes = pagosMes.filter(x => !x.pago || x.pago.estado === "pendiente").length;
    const morosos = pagosMes.filter(x => x.pago?.estado === "moroso").length;
    const parciales = pagosMes.filter(x => x.pago?.estado === "parcial").length;
    const totalEsperadoARS = pagosMes.reduce((s, x) => {
      const monto = x.contrato.moneda === "USD" ? x.contrato.alquilerBase * tc : x.contrato.alquilerBase;
      return s + monto;
    }, 0);
    const totalCobradoARS = pagosMes
      .filter(x => x.pago?.estado === "pagado" || x.pago?.estado === "parcial")
      .reduce((s, x) => {
        const monto = x.contrato.moneda === "USD" ? (x.pago?.monto ?? x.contrato.alquilerBase) * tc : (x.pago?.monto ?? x.contrato.alquilerBase);
        return s + monto;
      }, 0);
    return { pagados, pendientes, morosos, parciales, totalEsperadoARS, totalCobradoARS, pagosMes };
  }, [contratosActivos, pagos, mes, tc]);

  const estadoColor = (estado: string | undefined) => {
    if (!estado || estado === "pendiente") return "#6b7280";
    if (estado === "pagado") return "#22c55e";
    if (estado === "parcial") return "#eab308";
    if (estado === "moroso") return "#cc0000";
    return "#6b7280";
  };

  const submitContrato = () => {
    if (!form.inquilino || !form.propiedad) return;
    const nuevo: Contrato = {
      id: `c_${Date.now()}`,
      inquilino: form.inquilino ?? "",
      propiedad: form.propiedad ?? "",
      telefono: form.telefono ?? "",
      alquilerBase: parseFloat(String(form.alquilerBase)) || 0,
      moneda: (form.moneda as "ARS" | "USD") ?? "ARS",
      diaVencimiento: parseInt(String(form.diaVencimiento)) || 5,
      fechaInicio: form.fechaInicio ?? new Date().toISOString().slice(0, 10),
      fechaFin: form.fechaFin ?? "",
      estado: "activo",
      notas: form.notas ?? "",
    };
    saveContratos([...contratos, nuevo]);
    setModal(null);
    setForm({});
  };

  const MESES_DISP = useMemo(() => {
    const set = new Set<string>();
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      set.add(d.toISOString().slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, []);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>💳 Cobranzas de Alquileres</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Seguimiento de pagos mensuales por contrato — {mesLabel(mes)}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
            <button onClick={() => { setForm({}); setModal({ tipo: "contrato" }); }}
              style={{ background: "#cc0000", border: "none", borderRadius: 6, color: "#fff", padding: "7px 14px", fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, cursor: "pointer" }}>
              + Contrato
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Mes</label>
            <select value={mes} onChange={e => setMes(e.target.value)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13 }}>
              {MESES_DISP.map(m => <option key={m} value={m}>{mesLabel(m)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>TC ARS/USD</label>
            <input type="number" value={tc} onChange={e => setTc(parseFloat(e.target.value)||1)} step={50}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: 90 }} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: "#22c55e" }}>{stats.pagados}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Pagados</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: "#f97316" }}>{stats.pendientes}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Pendientes</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: "#cc0000" }}>{stats.morosos}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Morosos</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: "#e5e5e5" }}>
                {Math.round(stats.totalCobradoARS / 1000)}k
              </div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Cobrado (ARS k)</div>
            </div>
          </div>
        </div>

        {/* Barra cobrado */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ background: "#0a0a0a", borderRadius: 6, height: 10, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ width: `${stats.totalEsperadoARS > 0 ? (stats.totalCobradoARS / stats.totalEsperadoARS) * 100 : 0}%`, height: "100%", background: "#22c55e", transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280" }}>
            <span>Cobrado: ARS {fmt(Math.round(stats.totalCobradoARS / 1000))}k</span>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>{stats.totalEsperadoARS > 0 ? Math.round((stats.totalCobradoARS / stats.totalEsperadoARS) * 100) : 0}%</span>
            <span>Esperado: ARS {fmt(Math.round(stats.totalEsperadoARS / 1000))}k</span>
          </div>
        </div>

        {/* Lista de contratos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {stats.pagosMes.map(({ contrato: c, pago: p }) => {
            const mora = (!p || p.estado === "pendiente" || p.estado === "moroso") ? diasMora(mes, c.diaVencimiento) : 0;
            const montoDisplay = `${c.moneda} ${fmt(c.alquilerBase)}`;
            const estado = p?.estado ?? "pendiente";
            return (
              <div key={c.id} style={{ background: "#111", border: `1px solid ${estadoColor(estado)}33`, borderRadius: 12, padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>{c.inquilino}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{c.propiedad}</div>
                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>Vence día {c.diaVencimiento} · {montoDisplay}/mes</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, color: estadoColor(estado), textTransform: "capitalize" }}>
                      {estado === "pagado" ? "✅ Pagado" : estado === "moroso" ? "🔴 Moroso" : estado === "parcial" ? "⚠️ Parcial" : "⏳ Pendiente"}
                    </div>
                    {mora > 0 && <div style={{ fontSize: 11, color: "#cc0000", marginTop: 2 }}>{mora} días de mora</div>}
                    {p?.fechaPago && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Pagó: {p.fechaPago}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["pagado", "parcial", "pendiente", "moroso"] as const).map(est => (
                    <button key={est} onClick={() => toggleEstadoPago(c.id, mes, est)}
                      style={{ background: estado === est ? `${estadoColor(est)}22` : "#0a0a0a", border: `1px solid ${estado === est ? estadoColor(est) : "#333"}`, borderRadius: 6, color: estado === est ? estadoColor(est) : "#6b7280", padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "capitalize" }}>
                      {est === "pagado" ? "✅ Pagado" : est === "moroso" ? "🔴 Moroso" : est === "parcial" ? "⚠️ Parcial" : "⏳ Pendiente"}
                    </button>
                  ))}
                  {c.telefono && (
                    <a href={`https://wa.me/54${c.telefono}?text=${encodeURIComponent(`Hola ${c.inquilino.split(",")[0]}, te recordamos que el alquiler de ${mesLabel(mes)} por ${montoDisplay} vence el día ${c.diaVencimiento}. Gracias!`)}`}
                      target="_blank" rel="noreferrer"
                      style={{ background: "#25d36622", border: "1px solid #25d36644", borderRadius: 6, color: "#25d366", padding: "4px 12px", fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                      💬 WA Recordatorio
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {contratos.length === 0 && (
            <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>Sin contratos cargados</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Hacé clic en "+ Contrato" para agregar uno</div>
            </div>
          )}
        </div>

        {/* Modal contrato */}
        {modal?.tipo === "contrato" && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
            onClick={() => setModal(null)}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 14, padding: 24, width: 440, maxHeight: "90vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: "#fff", marginBottom: 20 }}>Nuevo Contrato</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Inquilino (apellido, nombre)", key: "inquilino", type: "text" },
                  { label: "Propiedad / dirección", key: "propiedad", type: "text" },
                  { label: "Teléfono (sin 0 ni 15)", key: "telefono", type: "text" },
                  { label: "Alquiler mensual", key: "alquilerBase", type: "number" },
                  { label: "Día de vencimiento", key: "diaVencimiento", type: "number" },
                  { label: "Fecha inicio", key: "fechaInicio", type: "date" },
                  { label: "Fecha fin", key: "fechaFin", type: "date" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>{f.label}</label>
                    <input type={f.type} value={(form as Record<string, string | number>)[f.key] ?? ""}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === "number" ? parseFloat(e.target.value)||0 : e.target.value }))}
                      style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "7px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Moneda</label>
                  <select value={form.moneda ?? "ARS"} onChange={e => setForm(prev => ({ ...prev, moneda: e.target.value as "ARS" | "USD" }))}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "7px 10px", fontSize: 13, width: "100%" }}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={submitContrato}
                  style={{ flex: 1, background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", padding: "10px", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Guardar contrato
                </button>
                <button onClick={() => setModal(null)}
                  style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#9ca3af", padding: "10px 16px", fontSize: 13, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
