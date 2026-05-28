"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Gasto {
  id: string;
  descripcion: string;
  categoria: string;
  monto: number;
  moneda: string;
  fecha: string;
  recurrente: boolean;
  pagado: boolean;
  notas: string;
}

const CATEGORIAS = [
  { label: "Marketing y Publicidad", color: "#3b82f6" },
  { label: "Software y Suscripciones", color: "#a855f7" },
  { label: "Alquiler Oficina", color: "#f97316" },
  { label: "Sueldos y Honorarios", color: "#cc0000" },
  { label: "Servicios (luz, internet)", color: "#eab308" },
  { label: "Movilidad y Traslados", color: "#22c55e" },
  { label: "Materiales y Papelería", color: "#6b7280" },
  { label: "Seguros", color: "#06b6d4" },
  { label: "Impuestos y Tasas", color: "#ec4899" },
  { label: "Otros", color: "#4b5563" },
];

const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function hoy() { return new Date().toISOString().slice(0, 10); }

const DRAFT_VACIO = (mes: string): Gasto => ({ id: "", descripcion: "", categoria: CATEGORIAS[0].label, monto: 0, moneda: "ARS", fecha: `${mes}-01`, recurrente: false, pagado: false, notas: "" });

export default function GastosPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [tc, setTc] = useState(1300);
  const [mesActual] = useState(new Date().toISOString().slice(0, 7));
  const [ingresosMes, setIngresosMes] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Gasto>(DRAFT_VACIO(new Date().toISOString().slice(0, 7)));
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7));
  const [filtrocat, setFiltrocat] = useState("todas");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: rows } = await supabase
        .from("crm_gastos")
        .select("id,descripcion,categoria,monto,moneda,fecha,recurrente,pagado,notas")
        .eq("perfil_id", userId)
        .order("fecha", { ascending: false });
      setGastos((rows ?? []) as Gasto[]);
    });
  }, []);

  const abrirNuevo = () => {
    setDraft(DRAFT_VACIO(mesActual));
    setEditId(null);
    setFormOpen(true);
  };

  const abrirEditar = (g: Gasto) => { setDraft({ ...g }); setEditId(g.id); setFormOpen(true); };

  const guardarDraft = async () => {
    if (!draft.descripcion || !draft.monto || !uid) return;
    if (editId) {
      const { error } = await supabase.from("crm_gastos").update({
        descripcion: draft.descripcion, categoria: draft.categoria,
        monto: draft.monto, moneda: draft.moneda, fecha: draft.fecha,
        recurrente: draft.recurrente, pagado: draft.pagado, notas: draft.notas || null,
      }).eq("id", editId);
      if (!error) setGastos(prev => prev.map(g => g.id === editId ? { ...draft } : g));
    } else {
      const { data, error } = await supabase.from("crm_gastos").insert({
        perfil_id: uid, descripcion: draft.descripcion, categoria: draft.categoria,
        monto: draft.monto, moneda: draft.moneda, fecha: draft.fecha,
        recurrente: draft.recurrente, pagado: draft.pagado, notas: draft.notas || null,
      }).select("id,descripcion,categoria,monto,moneda,fecha,recurrente,pagado,notas").single();
      if (!error && data) setGastos(prev => [data as Gasto, ...prev]);
    }
    setFormOpen(false);
  };

  const eliminar = async (id: string) => {
    await supabase.from("crm_gastos").delete().eq("id", id);
    setGastos(prev => prev.filter(g => g.id !== id));
  };

  const togglePagado = async (id: string) => {
    const g = gastos.find(g => g.id === id);
    if (!g) return;
    await supabase.from("crm_gastos").update({ pagado: !g.pagado }).eq("id", id);
    setGastos(prev => prev.map(g => g.id === id ? { ...g, pagado: !g.pagado } : g));
  };

  const montoARS = (g: Gasto) => g.moneda === "USD" ? g.monto * tc : g.monto;

  const gastosFiltrados = useMemo(() => gastos.filter(g => {
    const mes = g.fecha.slice(0, 7);
    if (mes !== filtroMes) return false;
    if (filtrocat !== "todas" && g.categoria !== filtrocat) return false;
    return true;
  }), [gastos, filtroMes, filtrocat]);

  const stats = useMemo(() => {
    const totalARS = gastosFiltrados.reduce((s, g) => s + montoARS(g), 0);
    const pagadoARS = gastosFiltrados.filter(g => g.pagado).reduce((s, g) => s + montoARS(g), 0);
    const pendienteARS = totalARS - pagadoARS;
    const porCat: Record<string, number> = {};
    gastosFiltrados.forEach(g => {
      porCat[g.categoria] = (porCat[g.categoria] ?? 0) + montoARS(g);
    });
    const margen = ingresosMes > 0 ? ((ingresosMes - totalARS) / ingresosMes) * 100 : 0;
    return { totalARS, pagadoARS, pendienteARS, porCat, margen };
  }, [gastosFiltrados, tc, ingresosMes]);

  const maxCat = Math.max(1, ...Object.values(stats.porCat));

  // Meses disponibles
  const mesesDisp = useMemo(() => {
    const set = new Set<string>();
    gastos.forEach(g => set.add(g.fecha.slice(0, 7)));
    set.add(mesActual);
    return Array.from(set).sort().reverse();
  }, [gastos, mesActual]);

  const colCat = (cat: string) => CATEGORIAS.find(c => c.label === cat)?.color ?? "#6b7280";

  const inpStyle = { background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13, width: "100%", boxSizing: "border-box" as const };
  const lblStyle = { fontSize: 11, color: "#6b7280", fontWeight: 600 as const, display: "block" as const, marginBottom: 3 };

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const [a, m] = filtroMes.split("-");
    const filas = gastosFiltrados.map(g => `<tr>
      <td style="padding:4px 8px;border:1px solid #ddd">${g.fecha}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${g.descripcion}</td>
      <td style="padding:4px 8px;border:1px solid #ddd">${g.categoria}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${g.moneda} ${fmt(g.monto)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${g.recurrente ? "Sí" : "No"}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${g.pagado ? "✓" : "⏳"}</td>
    </tr>`).join("");
    win.document.write(`<html><body style="font-family:sans-serif;padding:24px;font-size:12px">
      <h2>Gastos Operativos — ${MESES_LABEL[parseInt(m)-1]} ${a}</h2>
      <p>Total: ARS ${fmt(stats.totalARS)} · Pagado: ARS ${fmt(stats.pagadoARS)} · Pendiente: ARS ${fmt(stats.pendienteARS)}</p>
      ${ingresosMes > 0 ? `<p>Ingresos: ARS ${fmt(ingresosMes)} · Margen: ${stats.margen.toFixed(1)}%</p>` : ""}
      <table border="0" style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f5f5f5"><th style="padding:4px 8px;border:1px solid #ddd">Fecha</th><th style="padding:4px 8px;border:1px solid #ddd">Descripción</th><th style="padding:4px 8px;border:1px solid #ddd">Categoría</th><th style="padding:4px 8px;border:1px solid #ddd">Monto</th><th style="padding:4px 8px;border:1px solid #ddd">Recur.</th><th style="padding:4px 8px;border:1px solid #ddd">Estado</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const [a, m] = filtroMes.split("-");
  const mesLabel = `${MESES_LABEL[parseInt(m)-1]} ${a}`;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>💸 Gastos Operativos</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Control de gastos mensuales de la inmobiliaria</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
            <button onClick={exportarPDF} style={{ background: "#1f2937", color: "#e5e5e5", border: "1px solid #374151", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>📄 PDF</button>
            <button onClick={abrirNuevo} style={{ background: "#cc000033", color: "#cc0000", border: "1px solid #cc000066", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>+ Nuevo Gasto</button>
          </div>
        </div>

        {/* Config */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={lblStyle}>Mes</label>
            <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13 }}>
              {mesesDisp.map(mes => {
                const [ya, ym] = mes.split("-");
                return <option key={mes} value={mes}>{MESES_LABEL[parseInt(ym)-1]} {ya}</option>;
              })}
            </select>
          </div>
          <div>
            <label style={lblStyle}>Categoría</label>
            <select value={filtrocat} onChange={e => setFiltrocat(e.target.value)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13 }}>
              <option value="todas">Todas</option>
              {CATEGORIAS.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>Ingresos del mes (ARS)</label>
            <input type="number" value={ingresosMes} onChange={e => setIngresosMes(parseFloat(e.target.value) || 0)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13, width: 150 }} />
          </div>
          <div>
            <label style={lblStyle}>TC USD/ARS</label>
            <input type="number" value={tc} onChange={e => setTc(parseFloat(e.target.value) || 1)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13, width: 90 }} />
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: `Gastos ${mesLabel}`, val: `$ ${fmt(stats.totalARS)}`, color: "#cc0000" },
            { label: "Pagado", val: `$ ${fmt(stats.pagadoARS)}`, color: "#22c55e" },
            { label: "Pendiente", val: `$ ${fmt(stats.pendienteARS)}`, color: "#f97316" },
            { label: "Gastos USD", val: `USD ${fmt(stats.totalARS / tc)}`, color: "#3b82f6" },
            ...(ingresosMes > 0 ? [
              { label: "Margen Operativo", val: `${stats.margen.toFixed(1)}%`, color: stats.margen >= 30 ? "#22c55e" : stats.margen >= 0 ? "#f97316" : "#cc0000" },
              { label: "Ratio Gastos", val: `${(100 - stats.margen).toFixed(1)}%`, color: "#9ca3af" },
            ] : []),
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: `1px solid ${k.color}33`, borderRadius: 10, padding: "10px 13px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 17, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Barra de progreso ingresos vs gastos */}
        {ingresosMes > 0 && (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
              <span>Gastos sobre ingresos</span>
              <span style={{ color: stats.margen >= 0 ? "#22c55e" : "#cc0000" }}>
                ARS {fmt(ingresosMes - stats.totalARS)} libre
              </span>
            </div>
            <div style={{ background: "#1a1a1a", borderRadius: 8, height: 14, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, (stats.totalARS / ingresosMes) * 100)}%`, height: "100%", background: stats.totalARS > ingresosMes ? "#cc0000" : "#3b82f6", transition: "width 0.4s" }} />
            </div>
            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>
              {((stats.totalARS / ingresosMes) * 100).toFixed(1)}% de los ingresos en gastos
            </div>
          </div>
        )}

        {/* Por categoría */}
        {Object.keys(stats.porCat).length > 0 && (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 12 }}>Por Categoría</div>
            {Object.entries(stats.porCat).sort((a, b) => b[1] - a[1]).map(([cat, monto]) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 160, fontSize: 12, color: "#9ca3af", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</div>
                <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 4, height: 22, overflow: "hidden" }}>
                  <div style={{ width: `${(monto / maxCat) * 100}%`, height: "100%", background: `${colCat(cat)}44` }} />
                </div>
                <div style={{ width: 110, textAlign: "right", fontSize: 12, color: colCat(cat), fontWeight: 700 }}>$ {fmt(monto)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Lista gastos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {gastosFiltrados.length === 0 && (
            <div style={{ textAlign: "center", color: "#4b5563", padding: 40 }}>Sin gastos en {mesLabel}. Agregá el primero.</div>
          )}
          {gastosFiltrados
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .map(g => (
              <div key={g.id} style={{ background: "#111", border: `1px solid ${colCat(g.categoria)}33`, borderLeft: `3px solid ${colCat(g.categoria)}`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 2, minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5" }}>{g.descripcion}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    <span style={{ color: colCat(g.categoria) }}>{g.categoria}</span> · {g.fecha}
                    {g.recurrente && <span style={{ color: "#f97316", marginLeft: 6 }}>↻ Recurrente</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 100 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#e5e5e5" }}>{g.moneda} {fmt(g.monto)}</div>
                  {g.moneda === "USD" && <div style={{ fontSize: 11, color: "#6b7280" }}>$ {fmt(g.monto * tc)}</div>}
                </div>
                <button onClick={() => togglePagado(g.id)}
                  style={{ background: g.pagado ? "#22c55e22" : "#f9731622", color: g.pagado ? "#22c55e" : "#f97316", border: `1px solid ${g.pagado ? "#22c55e44" : "#f9731644"}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {g.pagado ? "✓ Pagado" : "⏳ Pagar"}
                </button>
                <button onClick={() => abrirEditar(g)} style={{ background: "transparent", color: "#6b7280", border: "none", cursor: "pointer", fontSize: 14 }}>✏️</button>
                <button onClick={() => eliminar(g.id)} style={{ background: "transparent", color: "#4b5563", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ))}
        </div>

        {/* Modal */}
        {formOpen && (
          <div style={{ position: "fixed", inset: 0, background: "#000000cc", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
            <div style={{ background: "#111", border: "1px solid #333", borderRadius: 14, padding: 28, width: "100%", maxWidth: 560 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#fff" }}>{editId ? "Editar Gasto" : "Nuevo Gasto"}</span>
                <button onClick={() => setFormOpen(false)} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}><label style={lblStyle}>Descripción</label><input value={draft.descripcion} onChange={e => setDraft(d => ({ ...d, descripcion: e.target.value }))} style={inpStyle} /></div>
                <div><label style={lblStyle}>Categoría</label>
                  <select value={draft.categoria} onChange={e => setDraft(d => ({ ...d, categoria: e.target.value }))} style={inpStyle}>
                    {CATEGORIAS.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                  </select>
                </div>
                <div><label style={lblStyle}>Fecha</label><input type="date" value={draft.fecha} onChange={e => setDraft(d => ({ ...d, fecha: e.target.value }))} style={inpStyle} /></div>
                <div><label style={lblStyle}>Monto</label><input type="number" value={draft.monto} onChange={e => setDraft(d => ({ ...d, monto: parseFloat(e.target.value) || 0 }))} style={inpStyle} /></div>
                <div><label style={lblStyle}>Moneda</label>
                  <select value={draft.moneda} onChange={e => setDraft(d => ({ ...d, moneda: e.target.value }))} style={inpStyle}>
                    <option>ARS</option><option>USD</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
                  <input type="checkbox" id="rec" checked={draft.recurrente} onChange={e => setDraft(d => ({ ...d, recurrente: e.target.checked }))} />
                  <label htmlFor="rec" style={{ fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>Recurrente</label>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
                  <input type="checkbox" id="pag" checked={draft.pagado} onChange={e => setDraft(d => ({ ...d, pagado: e.target.checked }))} />
                  <label htmlFor="pag" style={{ fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>Pagado</label>
                </div>
                <div style={{ gridColumn: "1 / -1" }}><label style={lblStyle}>Notas</label><input value={draft.notas} onChange={e => setDraft(d => ({ ...d, notas: e.target.value }))} style={inpStyle} /></div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button onClick={() => setFormOpen(false)} style={{ background: "#1a1a1a", color: "#9ca3af", border: "1px solid #333", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                <button onClick={guardarDraft} style={{ background: "#cc000033", color: "#cc0000", border: "1px solid #cc000066", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
