"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Referido {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  referidoPor: string; // nombre del referente
  fecha: string;
  estado: "nuevo" | "contactado" | "activo" | "cerrado" | "perdido";
  tipo: string;
  presupuesto: number;
  moneda: string;
  zona: string;
  negocioId: string;
  honorarios: number;
  recompensaAcordada: number; // USD
  recompensaPagada: boolean;
  notas: string;
}

const ESTADOS: { val: Referido["estado"]; label: string; color: string }[] = [
  { val: "nuevo",      label: "Nuevo",      color: "#6b7280" },
  { val: "contactado", label: "Contactado", color: "#3b82f6" },
  { val: "activo",     label: "Activo",     color: "#f97316" },
  { val: "cerrado",    label: "Cerrado",    color: "#22c55e" },
  { val: "perdido",    label: "Perdido",    color: "#cc0000" },
];

let nid = 1;

function emptyRef(): Referido {
  return {
    id: nid++, nombre: "", apellido: "", telefono: "", email: "",
    referidoPor: "", fecha: new Date().toISOString().slice(0, 10),
    estado: "nuevo", tipo: "comprador", presupuesto: 0, moneda: "USD",
    zona: "", negocioId: "", honorarios: 0, recompensaAcordada: 0,
    recompensaPagada: false, notas: "",
  };
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const STORAGE_KEY = "crm_referidos_v1";

function cargarStorage(): Referido[] {
  if (typeof window === "undefined") return [emptyRef()];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Referido[]) : [emptyRef()];
  } catch { return [emptyRef()]; }
}

export default function ReferidosPage() {
  const [refs, setRefs] = useState<Referido[]>(cargarStorage);
  const [filtroBusq, setFiltroBusq] = useState("");
  const [filtroEst, setFiltroEst] = useState("todos");
  const [filtroRef, setFiltroRef] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Referido>(emptyRef());

  const guardar = (lista: Referido[]) => {
    setRefs(lista);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  };

  const abrirNuevo = () => { setDraft(emptyRef()); setEditId(null); setFormOpen(true); };
  const abrirEditar = (r: Referido) => { setDraft({ ...r }); setEditId(r.id); setFormOpen(true); };

  const guardarDraft = () => {
    if (!draft.nombre) return;
    if (editId !== null) {
      guardar(refs.map(r => r.id === editId ? draft : r));
    } else {
      guardar([...refs, draft]);
    }
    setFormOpen(false);
  };

  const eliminar = (id: number) => guardar(refs.filter(r => r.id !== id));
  const togglePago = (id: number) => guardar(refs.map(r => r.id === id ? { ...r, recompensaPagada: !r.recompensaPagada } : r));

  const referentes = useMemo(() => Array.from(new Set(refs.map(r => r.referidoPor).filter(Boolean))), [refs]);

  const filtrados = useMemo(() => refs.filter(r => {
    if (filtroEst !== "todos" && r.estado !== filtroEst) return false;
    if (filtroRef !== "todos" && r.referidoPor !== filtroRef) return false;
    const q = filtroBusq.toLowerCase();
    if (q && !`${r.nombre} ${r.apellido} ${r.referidoPor} ${r.zona}`.toLowerCase().includes(q)) return false;
    return true;
  }), [refs, filtroEst, filtroRef, filtroBusq]);

  const stats = useMemo(() => {
    const cerrados = refs.filter(r => r.estado === "cerrado");
    const totalHon = cerrados.reduce((s, r) => s + r.honorarios, 0);
    const totalRecompPend = refs.filter(r => r.estado === "cerrado" && !r.recompensaPagada).reduce((s, r) => s + r.recompensaAcordada, 0);
    const totalRecompPag = refs.filter(r => r.recompensaPagada).reduce((s, r) => s + r.recompensaAcordada, 0);
    // Top referentes
    const porRef: Record<string, { total: number; cerrados: number; hon: number }> = {};
    refs.forEach(r => {
      if (!r.referidoPor) return;
      if (!porRef[r.referidoPor]) porRef[r.referidoPor] = { total: 0, cerrados: 0, hon: 0 };
      porRef[r.referidoPor].total++;
      if (r.estado === "cerrado") { porRef[r.referidoPor].cerrados++; porRef[r.referidoPor].hon += r.honorarios; }
    });
    return { cerrados: cerrados.length, totalHon, totalRecompPend, totalRecompPag, porRef };
  }, [refs]);

  const colEst = (val: Referido["estado"]) => ESTADOS.find(e => e.val === val)?.color ?? "#6b7280";
  const lblEst = (val: Referido["estado"]) => ESTADOS.find(e => e.val === val)?.label ?? val;

  const inpStyle = { background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13, width: "100%", boxSizing: "border-box" as const };
  const lblStyle = { fontSize: 11, color: "#6b7280", fontWeight: 600 as const, display: "block" as const, marginBottom: 3 };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>🤝 Gestión de Referidos</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Seguimiento de contactos referidos y recompensas</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
            <button onClick={abrirNuevo}
              style={{ background: "#cc000033", color: "#cc0000", border: "1px solid #cc000066", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
              + Nuevo Referido
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          {[
            { label: "Total referidos", val: refs.length, color: "#3b82f6" },
            { label: "Cerrados", val: stats.cerrados, color: "#22c55e" },
            { label: "Honorarios generados", val: `USD ${fmt(stats.totalHon)}`, color: "#a855f7" },
            { label: "Recompensas pendientes", val: `USD ${fmt(stats.totalRecompPend)}`, color: "#f97316" },
            { label: "Recompensas pagadas", val: `USD ${fmt(stats.totalRecompPag)}`, color: "#22c55e" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: `1px solid ${k.color}33`, borderRadius: 10, padding: "10px 16px", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.val}</span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{k.label}</span>
            </div>
          ))}
        </div>

        {/* Top referentes */}
        {Object.keys(stats.porRef).length > 0 && (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 12 }}>🏆 Top Referentes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(stats.porRef)
                .sort((a, b) => b[1].cerrados - a[1].cerrados || b[1].total - a[1].total)
                .slice(0, 5)
                .map(([nombre, d]) => (
                  <div key={nombre} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0f0f0f", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e5e5e5" }}>{nombre}</div>
                    <div style={{ fontSize: 12, color: "#3b82f6" }}>{d.total} ref.</div>
                    <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>{d.cerrados} cierres</div>
                    {d.hon > 0 && <div style={{ fontSize: 12, color: "#a855f7" }}>USD {fmt(d.hon)} hon.</div>}
                    <div style={{ background: "#1a1a1a", borderRadius: 4, height: 8, width: 80, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, (d.cerrados / d.total) * 100)}%`, height: "100%", background: "#22c55e" }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <input placeholder="Buscar…" value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)}
            style={{ background: "#111", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: 180 }} />
          <select value={filtroEst} onChange={e => setFiltroEst(e.target.value)}
            style={{ background: "#111", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13 }}>
            <option value="todos">Todos los estados</option>
            {ESTADOS.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
          </select>
          <select value={filtroRef} onChange={e => setFiltroRef(e.target.value)}
            style={{ background: "#111", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13 }}>
            <option value="todos">Todos los referentes</option>
            {referentes.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <span style={{ alignSelf: "center", fontSize: 12, color: "#6b7280" }}>{filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Lista */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrados.length === 0 && (
            <div style={{ textAlign: "center", color: "#4b5563", padding: 60 }}>Sin referidos. Agregá el primero.</div>
          )}
          {filtrados.map(r => (
            <div key={r.id} style={{ background: "#111", border: `1px solid ${colEst(r.estado)}33`, borderLeft: `3px solid ${colEst(r.estado)}`, borderRadius: 10, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#e5e5e5" }}>{r.nombre} {r.apellido}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Referido por: <span style={{ color: "#9ca3af" }}>{r.referidoPor || "—"}</span> · {r.fecha}</div>
                {r.zona && <div style={{ fontSize: 11, color: "#4b5563" }}>📍 {r.zona}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Tipo</div>
                <div style={{ fontSize: 13, color: "#9ca3af" }}>{r.tipo}</div>
                {r.presupuesto > 0 && <div style={{ fontSize: 12, color: "#e5e5e5" }}>{r.moneda} {fmt(r.presupuesto)}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <span style={{ background: `${colEst(r.estado)}22`, color: colEst(r.estado), fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>
                  {lblEst(r.estado)}
                </span>
              </div>
              {r.estado === "cerrado" && (
                <div style={{ flex: 1, minWidth: 120, textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Honorarios</div>
                  <div style={{ fontWeight: 700, color: "#a855f7" }}>USD {fmt(r.honorarios)}</div>
                  {r.recompensaAcordada > 0 && (
                    <div style={{ fontSize: 11 }}>
                      <span style={{ color: r.recompensaPagada ? "#22c55e" : "#f97316" }}>
                        Recomp: USD {fmt(r.recompensaAcordada)} {r.recompensaPagada ? "✅" : "⏳"}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                {r.telefono && (
                  <a href={`https://wa.me/${r.telefono.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                    style={{ background: "#15803d22", color: "#22c55e", border: "1px solid #22c55e44", borderRadius: 6, padding: "5px 8px", fontSize: 12, textDecoration: "none" }}>💬</a>
                )}
                {r.estado === "cerrado" && r.recompensaAcordada > 0 && (
                  <button onClick={() => togglePago(r.id)}
                    style={{ background: r.recompensaPagada ? "#22c55e22" : "#f9731622", color: r.recompensaPagada ? "#22c55e" : "#f97316", border: `1px solid ${r.recompensaPagada ? "#22c55e44" : "#f9731644"}`, borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: "pointer" }}>
                    {r.recompensaPagada ? "Pagado" : "Pagar"}
                  </button>
                )}
                <button onClick={() => abrirEditar(r)}
                  style={{ background: "#1a1a1a", color: "#9ca3af", border: "1px solid #333", borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer" }}>✏️</button>
                <button onClick={() => eliminar(r.id)}
                  style={{ background: "transparent", color: "#4b5563", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal formulario */}
        {formOpen && (
          <div style={{ position: "fixed", inset: 0, background: "#000000cc", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
            <div style={{ background: "#111", border: "1px solid #333", borderRadius: 14, padding: 28, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#fff" }}>{editId ? "Editar Referido" : "Nuevo Referido"}</span>
                <button onClick={() => setFormOpen(false)} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { label: "Nombre", key: "nombre" as const }, { label: "Apellido", key: "apellido" as const },
                  { label: "Teléfono", key: "telefono" as const }, { label: "Email", key: "email" as const },
                  { label: "Referido por", key: "referidoPor" as const }, { label: "Zona", key: "zona" as const },
                ].map(f => (
                  <div key={f.key}>
                    <label style={lblStyle}>{f.label}</label>
                    <input value={draft[f.key] as string} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))} style={inpStyle} />
                  </div>
                ))}
                <div><label style={lblStyle}>Fecha</label><input type="date" value={draft.fecha} onChange={e => setDraft(d => ({ ...d, fecha: e.target.value }))} style={inpStyle} /></div>
                <div><label style={lblStyle}>Estado</label>
                  <select value={draft.estado} onChange={e => setDraft(d => ({ ...d, estado: e.target.value as Referido["estado"] }))} style={inpStyle}>
                    {ESTADOS.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
                  </select>
                </div>
                <div><label style={lblStyle}>Tipo</label>
                  <select value={draft.tipo} onChange={e => setDraft(d => ({ ...d, tipo: e.target.value }))} style={inpStyle}>
                    {["comprador","vendedor","inversor","inquilino","propietario"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={lblStyle}>Presupuesto</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select value={draft.moneda} onChange={e => setDraft(d => ({ ...d, moneda: e.target.value }))} style={{ ...inpStyle, width: 70 }}><option>USD</option><option>ARS</option></select>
                    <input type="number" value={draft.presupuesto} onChange={e => setDraft(d => ({ ...d, presupuesto: parseFloat(e.target.value) || 0 }))} style={{ ...inpStyle, flex: 1 }} />
                  </div>
                </div>
                {draft.estado === "cerrado" && <>
                  <div><label style={lblStyle}>Honorarios (USD)</label><input type="number" value={draft.honorarios} onChange={e => setDraft(d => ({ ...d, honorarios: parseFloat(e.target.value) || 0 }))} style={inpStyle} /></div>
                  <div><label style={lblStyle}>Recompensa acordada (USD)</label><input type="number" value={draft.recompensaAcordada} onChange={e => setDraft(d => ({ ...d, recompensaAcordada: parseFloat(e.target.value) || 0 }))} style={inpStyle} /></div>
                </>}
                <div style={{ gridColumn: "1 / -1" }}><label style={lblStyle}>Notas</label><textarea value={draft.notas} onChange={e => setDraft(d => ({ ...d, notas: e.target.value }))} rows={2} style={{ ...inpStyle, resize: "vertical" }} /></div>
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
