"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const STORAGE_KEY = "crm_com_cobros_v1";

interface Negocio {
  id: string;
  titulo: string;
  tipo_operacion: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  fecha_cierre: string | null;
  fecha_reserva: string | null;
  contacto_id: string | null;
  colega_id: string | null;
  split_pct: number | null;
  notas: string | null;
  archivado: boolean;
}

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
}

interface CobrosRegistrados {
  [negocioId: string]: { montoCobrado: number; fechaCobro: string; nota: string }[];
}

interface ComisionItem {
  negocio: Negocio;
  contacto: Contacto | null;
  comisionBrutaUSD: number;
  comisionNetaUSD: number; // después de split si hay colega
  cobradoUSD: number;
  pendienteUSD: number;
  pctCobrado: number;
  diasDesdeCierre: number;
  estado: "cobrado" | "parcial" | "pendiente";
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const ETAPAS_COBRO = ["reserva", "escritura", "cierre", "firmado"];

export default function ComisionesPendientesPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cobros, setCobros] = useState<CobrosRegistrados>({});
  const [loading, setLoading] = useState(true);
  const [tc, setTc] = useState(1300);
  const [filtroPeriodo, setFiltroPeriodo] = useState<"todos" | "30d" | "90d" | "anio">("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendiente" | "parcial" | "cobrado">("pendiente");
  const [negocioModal, setNegocioModal] = useState<string | null>(null);
  const [nuevoCobro, setNuevoCobro] = useState({ monto: 0, fecha: new Date().toISOString().split("T")[0], nota: "" });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setCobros(JSON.parse(stored));

    const cargar = async () => {
      const [{ data: negs }, { data: ctcs }] = await Promise.all([
        supabase.from("crm_negocios").select("id,titulo,tipo_operacion,etapa,valor_operacion,moneda,honorarios_pct,fecha_cierre,fecha_reserva,contacto_id,colega_id,split_pct,notas,archivado"),
        supabase.from("crm_contactos").select("id,nombre,apellido,telefono"),
      ]);
      setNegocios((negs ?? []) as Negocio[]);
      setContactos((ctcs ?? []) as Contacto[]);
      setLoading(false);
    };
    cargar();
  }, []);

  const contactoMap = useMemo(() => {
    const m: Record<string, Contacto> = {};
    contactos.forEach(c => { m[c.id] = c; });
    return m;
  }, [contactos]);

  const items = useMemo<ComisionItem[]>(() => {
    const ahora = new Date();
    return negocios
      .filter(n => {
        if (n.archivado) return false;
        // Solo negocios en etapa de cobro
        const etapa = n.etapa.toLowerCase();
        return ETAPAS_COBRO.some(e => etapa.includes(e));
      })
      .map(n => {
        const valorUSD = n.valor_operacion
          ? (n.moneda === "USD" ? n.valor_operacion : n.valor_operacion / tc)
          : 0;
        const honPct = n.honorarios_pct ?? 3;
        const comisionBrutaUSD = valorUSD * (honPct / 100);
        const splitPct = n.split_pct ?? 0;
        const comisionNetaUSD = comisionBrutaUSD * (1 - splitPct / 100);

        const cobrosNeg = cobros[n.id] ?? [];
        const cobradoUSD = cobrosNeg.reduce((s, c) => s + c.montoCobrado, 0);
        const pendienteUSD = Math.max(comisionNetaUSD - cobradoUSD, 0);
        const pctCobrado = comisionNetaUSD > 0 ? Math.min((cobradoUSD / comisionNetaUSD) * 100, 100) : 0;

        const estado: ComisionItem["estado"] =
          pctCobrado >= 99 ? "cobrado" : cobradoUSD > 0 ? "parcial" : "pendiente";

        const fechaRef = n.fecha_cierre ?? n.fecha_reserva ?? n.etapa;
        let diasDesdeCierre = 0;
        if (n.fecha_cierre || n.fecha_reserva) {
          const d = new Date((n.fecha_cierre ?? n.fecha_reserva)! + "T12:00:00");
          diasDesdeCierre = Math.floor((ahora.getTime() - d.getTime()) / 86400000);
        }

        // Filtro período
        if (filtroPeriodo !== "todos" && (n.fecha_cierre || n.fecha_reserva)) {
          const corte = filtroPeriodo === "30d" ? 30 : filtroPeriodo === "90d" ? 90 : 365;
          if (diasDesdeCierre > corte) return null;
        }

        const contacto = n.contacto_id ? (contactoMap[n.contacto_id] ?? null) : null;
        return { negocio: n, contacto, comisionBrutaUSD, comisionNetaUSD, cobradoUSD, pendienteUSD, pctCobrado, diasDesdeCierre, estado };
      })
      .filter((x): x is ComisionItem => x !== null)
      .filter(x => filtroEstado === "todos" || x.estado === filtroEstado)
      .sort((a, b) => b.pendienteUSD - a.pendienteUSD);
  }, [negocios, contactoMap, cobros, tc, filtroPeriodo, filtroEstado]);

  const totales = useMemo(() => {
    const all = negocios
      .filter(n => !n.archivado && ETAPAS_COBRO.some(e => n.etapa.toLowerCase().includes(e)))
      .map(n => {
        const valorUSD = n.valor_operacion ? (n.moneda === "USD" ? n.valor_operacion : n.valor_operacion / tc) : 0;
        const honPct = n.honorarios_pct ?? 3;
        const comisionBrutaUSD = valorUSD * (honPct / 100);
        const comisionNetaUSD = comisionBrutaUSD * (1 - (n.split_pct ?? 0) / 100);
        const cobradoUSD = (cobros[n.id] ?? []).reduce((s, c) => s + c.montoCobrado, 0);
        return { comisionNetaUSD, cobradoUSD, pendienteUSD: Math.max(comisionNetaUSD - cobradoUSD, 0) };
      });
    return {
      totalComisionesMeUSD: all.reduce((s, x) => s + x.comisionNetaUSD, 0),
      totalCobradoUSD: all.reduce((s, x) => s + x.cobradoUSD, 0),
      totalPendienteUSD: all.reduce((s, x) => s + x.pendienteUSD, 0),
    };
  }, [negocios, cobros, tc]);

  const registrarCobro = () => {
    if (!negocioModal || nuevoCobro.monto <= 0) return;
    const prevCobros = cobros[negocioModal] ?? [];
    const nuevos = { ...cobros, [negocioModal]: [...prevCobros, { montoCobrado: nuevoCobro.monto, fechaCobro: nuevoCobro.fecha, nota: nuevoCobro.nota }] };
    setCobros(nuevos);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevos));
    setNegocioModal(null);
    setNuevoCobro({ monto: 0, fecha: new Date().toISOString().split("T")[0], nota: "" });
  };

  const estadoColor = (e: string) => e === "cobrado" ? "#22c55e" : e === "parcial" ? "#f97316" : "#cc0000";
  const estadoLabel = (e: string) => e === "cobrado" ? "Cobrado" : e === "parcial" ? "Parcial" : "Pendiente";

  const itemModal = items.find(i => i.negocio.id === negocioModal);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>💰 Comisiones Pendientes</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Seguimiento de cobro de honorarios por negocio cerrado</p>
          </div>
          <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total devengado", value: `USD ${fmt(Math.round(totales.totalComisionesMeUSD))}`, color: "#e5e5e5" },
            { label: "Cobrado", value: `USD ${fmt(Math.round(totales.totalCobradoUSD))}`, color: "#22c55e" },
            { label: "Pendiente de cobro", value: `USD ${fmt(Math.round(totales.totalPendienteUSD))}`, color: "#cc0000" },
            { label: "Pendiente en ARS", value: `ARS ${fmt(Math.round(totales.totalPendienteUSD * tc / 1000))}k`, color: "#3b82f6" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Barra cobrado vs pendiente */}
        {totales.totalComisionesMeUSD > 0 && (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
              <span>Cobrado: {((totales.totalCobradoUSD / totales.totalComisionesMeUSD) * 100).toFixed(1)}%</span>
              <span>Pendiente: {((totales.totalPendienteUSD / totales.totalComisionesMeUSD) * 100).toFixed(1)}%</span>
            </div>
            <div style={{ background: "#0a0a0a", borderRadius: 4, height: 10, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${(totales.totalCobradoUSD / totales.totalComisionesMeUSD) * 100}%`, height: "100%", background: "#22c55e", transition: "width 0.5s" }} />
              <div style={{ flex: 1, background: "#cc000033" }} />
            </div>
          </div>
        )}

        {/* Filtros */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "#6b7280" }}>TC:</label>
            <input type="number" value={tc} step={50}
              onChange={e => setTc(parseFloat(e.target.value) || 1)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 5, color: "#e5e5e5", padding: "4px 7px", fontSize: 12, width: 80 }} />
          </div>
          <span style={{ color: "#374151" }}>|</span>
          {(["todos", "pendiente", "parcial", "cobrado"] as const).map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              style={{ background: filtroEstado === e ? "#1f2937" : "transparent", border: `1px solid ${filtroEstado === e ? "#374151" : "#1f2937"}`, borderRadius: 6, color: e === "todos" ? "#e5e5e5" : estadoColor(e), padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
              {e === "todos" ? "Todos" : estadoLabel(e)}
            </button>
          ))}
          <span style={{ color: "#374151" }}>|</span>
          {([{ id: "todos", label: "Todos" }, { id: "30d", label: "30d" }, { id: "90d", label: "90d" }, { id: "anio", label: "Este año" }] as const).map(p => (
            <button key={p.id} onClick={() => setFiltroPeriodo(p.id)}
              style={{ background: filtroPeriodo === p.id ? "#1f2937" : "transparent", border: `1px solid ${filtroPeriodo === p.id ? "#374151" : "#1f2937"}`, borderRadius: 6, color: "#9ca3af", padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 48 }}>Cargando negocios...</div>
        ) : items.length === 0 ? (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💳</div>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#22c55e" }}>Sin comisiones pendientes</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Los negocios en etapa de reserva, escritura o cierre aparecen aquí</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(item => (
              <div key={item.negocio.id}
                style={{ background: "#111", border: `1px solid ${estadoColor(item.estado)}33`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>{item.negocio.titulo}</span>
                      <span style={{ background: `${estadoColor(item.estado)}22`, color: estadoColor(item.estado), padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                        {estadoLabel(item.estado)}
                      </span>
                      <span style={{ fontSize: 10, color: "#4b5563" }}>{item.negocio.tipo_operacion} · {item.negocio.etapa}</span>
                    </div>
                    <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#6b7280", flexWrap: "wrap", marginBottom: 8 }}>
                      {item.contacto && <span>👤 {item.contacto.nombre} {item.contacto.apellido}</span>}
                      {item.negocio.valor_operacion && <span>💰 {item.negocio.moneda} {fmt(item.negocio.valor_operacion)}</span>}
                      <span>Hon: {item.negocio.honorarios_pct ?? 3}%</span>
                      {item.negocio.split_pct ? <span>Split: {item.negocio.split_pct}% colega</span> : null}
                      {item.diasDesdeCierre > 0 && <span>Cerrado hace {item.diasDesdeCierre}d</span>}
                    </div>
                    {/* Barra de cobro */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, background: "#0a0a0a", borderRadius: 3, height: 6, overflow: "hidden" }}>
                        <div style={{ width: `${item.pctCobrado}%`, height: "100%", background: estadoColor(item.estado), transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                        USD {fmt(Math.round(item.cobradoUSD))} / USD {fmt(Math.round(item.comisionNetaUSD))}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 20, color: item.pendienteUSD > 0 ? "#cc0000" : "#22c55e" }}>
                      {item.pendienteUSD > 0 ? `USD ${fmt(Math.round(item.pendienteUSD))}` : "✓"}
                    </div>
                    {item.pendienteUSD > 0 && (
                      <div style={{ fontSize: 11, color: "#3b82f6" }}>ARS {fmt(Math.round(item.pendienteUSD * tc / 1000))}k</div>
                    )}
                    <button onClick={() => setNegocioModal(item.negocio.id)}
                      style={{ background: "#cc0000", border: "none", borderRadius: 6, color: "#fff", padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      {item.estado === "cobrado" ? "Ver cobros" : "Registrar cobro"}
                    </button>
                  </div>
                </div>
                {/* Cobros registrados */}
                {(cobros[item.negocio.id] ?? []).length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #1a1a1a" }}>
                    {(cobros[item.negocio.id] ?? []).map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", padding: "2px 0" }}>
                        <span>{new Date(c.fechaCobro + "T12:00:00").toLocaleDateString("es-AR")} {c.nota && `— ${c.nota}`}</span>
                        <span style={{ color: "#22c55e", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>+USD {fmt(c.montoCobrado)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal registrar cobro */}
        {negocioModal && itemModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
            onClick={e => { if (e.target === e.currentTarget) setNegocioModal(null); }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 14, padding: 24, width: 400, maxWidth: "calc(100vw - 48px)" }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#fff", marginBottom: 6 }}>Registrar cobro</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>{itemModal.negocio.titulo} · Pendiente: USD {fmt(Math.round(itemModal.pendienteUSD))}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Monto cobrado (USD)</label>
                  <input type="number" value={nuevoCobro.monto} step={100} min={0}
                    onChange={e => setNuevoCobro(v => ({ ...v, monto: parseFloat(e.target.value) || 0 }))}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "8px 10px", fontSize: 14, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Fecha de cobro</label>
                  <input type="date" value={nuevoCobro.fecha}
                    onChange={e => setNuevoCobro(v => ({ ...v, fecha: e.target.value }))}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Nota (opcional)</label>
                  <input value={nuevoCobro.nota} onChange={e => setNuevoCobro(v => ({ ...v, nota: e.target.value }))}
                    placeholder="ej: Transferencia banco, efectivo, etc."
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={registrarCobro}
                  style={{ flex: 1, background: "#22c55e", border: "none", borderRadius: 8, color: "#000", padding: "10px", fontSize: 13, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>
                  Confirmar cobro
                </button>
                <button onClick={() => setNegocioModal(null)}
                  style={{ background: "transparent", border: "1px solid #374151", borderRadius: 8, color: "#6b7280", padding: "10px 16px", fontSize: 12, cursor: "pointer" }}>
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
