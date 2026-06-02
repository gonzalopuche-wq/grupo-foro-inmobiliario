"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPOS_PROPIEDAD = [
  "Departamento", "Casa", "Terreno o Lote", "Departamento de Pasillo",
  "Cochera", "Oficina", "Local Comercial", "Galpón", "Campo",
  "Negocio o Fondo de Comercio", "Consultorio", "Baulera", "Hotel",
  "Chacra", "Establecimiento Rural", "Inmueble Comercial",
];

const OPS_OFRECIDO = [
  "venta", "alquiler", "temporario", "permuta", "comercial", "fondo_comercio", "campo",
];

const OPS_BUSQUEDA = [
  "compra", "alquiler", "temporario", "permuta", "comercial", "fondo_comercio", "campo",
];

const ANTIGUEDADES = [
  { value: "", label: "Cualquier antigüedad" },
  { value: "a_estrenar", label: "A estrenar" },
  { value: "menos_5", label: "< 5 años" },
  { value: "5_10", label: "5-10 años" },
  { value: "10_20", label: "10-20 años" },
  { value: "mas_20", label: "> 20 años" },
];

const MONEDAS = ["USD", "ARS"];

const OP_COLOR: Record<string, string> = {
  venta: "#3abab6", compra: "#3abab6", alquiler: "#4ab8d8",
  temporario: "#d4960c", permuta: "#c084fc", comercial: "#d4960c",
  fondo_comercio: "#fb7185", campo: "#84cc16",
};

function fmt(n: number | null) {
  if (!n) return "—";
  return n.toLocaleString("es-AR");
}

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Ofrecido {
  id: string; perfil_id: string; operacion: string; tipo_propiedad: string;
  zona: string | null; ciudad: string; precio: number | null; moneda: string;
  dormitorios: number | null; banos: number | null;
  superficie_cubierta: number | null; superficie_total: number | null;
  antiguedad: string | null;
  apto_credito: boolean; uso_comercial: boolean; barrio_cerrado: boolean;
  con_cochera: boolean; acepta_mascotas: boolean; acepta_bitcoin: boolean;
  urgente: boolean; descripcion: string | null; activo: boolean; created_at: string;
  nombre_publicante?: string | null;
  perfiles?: { nombre: string; apellido: string; matricula: string | null; telefono: string | null; };
}

interface Busqueda {
  id: string; perfil_id: string; operacion: string; tipo_propiedad: string;
  zona: string | null; ciudad: string;
  presupuesto_min: number | null; presupuesto_max: number | null; moneda: string;
  dormitorios_min: number | null; dormitorios_max: number | null;
  banos_min: number | null; banos_max: number | null;
  superficie_min: number | null; superficie_max: number | null;
  tipo_superficie: string; antiguedad: string | null;
  apto_credito: boolean; uso_comercial: boolean; con_cochera: boolean;
  barrio_cerrado: boolean; acepta_mascotas: boolean; acepta_bitcoin: boolean;
  urgente: boolean; descripcion: string | null; activo: boolean; created_at: string;
  nombre_publicante?: string | null;
  perfiles?: { nombre: string; apellido: string; matricula: string | null; telefono: string | null; };
}

// ── Modal edición ofrecido ─────────────────────────────────────────────────────

function ModalOfrecido({
  item, onClose, onSaved,
}: { item: Ofrecido; onClose: () => void; onSaved: (updated: Ofrecido) => void }) {
  const [form, setForm] = useState<Partial<Ofrecido>>({ ...item });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setF = (k: keyof Ofrecido, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  async function guardar() {
    setGuardando(true); setError(null);
    const payload: Record<string, unknown> = {
      operacion: form.operacion, tipo_propiedad: form.tipo_propiedad,
      ciudad: form.ciudad, zona: form.zona || null,
      precio: form.precio ? Number(form.precio) : null, moneda: form.moneda,
      dormitorios: form.dormitorios ? Number(form.dormitorios) : null,
      banos: form.banos ? Number(form.banos) : null,
      superficie_cubierta: form.superficie_cubierta ? Number(form.superficie_cubierta) : null,
      superficie_total: form.superficie_total ? Number(form.superficie_total) : null,
      antiguedad: form.antiguedad || null,
      apto_credito: !!form.apto_credito, uso_comercial: !!form.uso_comercial,
      barrio_cerrado: !!form.barrio_cerrado, con_cochera: !!form.con_cochera,
      acepta_mascotas: !!form.acepta_mascotas, acepta_bitcoin: !!form.acepta_bitcoin,
      urgente: !!form.urgente, descripcion: form.descripcion || null,
      activo: !!form.activo,
    };
    const { error: err } = await supabase.from("mir_ofrecidos").update(payload).eq("id", item.id);
    if (err) { setError(err.message); setGuardando(false); return; }
    onSaved({ ...item, ...payload } as Ofrecido);
    onClose();
  }

  const inp: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 5,
    color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter,sans-serif", width: "100%", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 };
  const fld: React.CSSProperties = { marginBottom: 12 };

  const checkRow = (keys: (keyof Ofrecido)[], labels: string[]) => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
      {keys.map((k, i) => (
        <label key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
          <input type="checkbox" checked={!!form[k]} onChange={e => setF(k, e.target.checked)} />
          {labels[i]}
        </label>
      ))}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: "#fff" }}>Editar Ofrecido</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={fld}>
            <label style={lbl}>Operación</label>
            <select style={inp} value={form.operacion} onChange={e => setF("operacion", e.target.value)}>
              {OPS_OFRECIDO.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={fld}>
            <label style={lbl}>Tipo de propiedad</label>
            <select style={inp} value={form.tipo_propiedad} onChange={e => setF("tipo_propiedad", e.target.value)}>
              {TIPOS_PROPIEDAD.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={fld}>
            <label style={lbl}>Ciudad</label>
            <input style={inp} value={form.ciudad ?? ""} onChange={e => setF("ciudad", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Zona / Barrio</label>
            <input style={inp} value={form.zona ?? ""} onChange={e => setF("zona", e.target.value)} placeholder="Opcional" />
          </div>
          <div style={fld}>
            <label style={lbl}>Precio</label>
            <input style={inp} type="number" value={form.precio ?? ""} onChange={e => setF("precio", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Moneda</label>
            <select style={inp} value={form.moneda} onChange={e => setF("moneda", e.target.value)}>
              {MONEDAS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={fld}>
            <label style={lbl}>Dormitorios</label>
            <input style={inp} type="number" value={form.dormitorios ?? ""} onChange={e => setF("dormitorios", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Baños</label>
            <input style={inp} type="number" value={form.banos ?? ""} onChange={e => setF("banos", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Sup. cubierta (m²)</label>
            <input style={inp} type="number" value={form.superficie_cubierta ?? ""} onChange={e => setF("superficie_cubierta", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Sup. total (m²)</label>
            <input style={inp} type="number" value={form.superficie_total ?? ""} onChange={e => setF("superficie_total", e.target.value)} />
          </div>
          <div style={{ ...fld, gridColumn: "1/-1" }}>
            <label style={lbl}>Antigüedad</label>
            <select style={inp} value={form.antiguedad ?? ""} onChange={e => setF("antiguedad", e.target.value)}>
              {ANTIGUEDADES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>

        {checkRow(
          ["apto_credito", "con_cochera", "barrio_cerrado", "uso_comercial", "acepta_mascotas", "acepta_bitcoin", "urgente", "activo"],
          ["Apto crédito", "Cochera", "B. cerrado", "Comercial", "Mascotas", "Bitcoin", "Urgente", "Activo"]
        )}

        <div style={fld}>
          <label style={lbl}>Descripción</label>
          <textarea style={{ ...inp, height: 80, resize: "vertical" }} value={form.descripcion ?? ""} onChange={e => setF("descripcion", e.target.value)} />
        </div>

        {error && <div style={{ color: "#b80000", fontSize: 12, marginBottom: 10 }}>✕ {error}</div>}

        <button onClick={guardar} disabled={guardando}
          style={{ width: "100%", padding: 12, background: guardando ? "rgba(153,0,0,0.4)" : "#990000", border: "none", borderRadius: 6, color: "#fff", fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: guardando ? "not-allowed" : "pointer" }}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Modal edición búsqueda ─────────────────────────────────────────────────────

function ModalBusqueda({
  item, onClose, onSaved,
}: { item: Busqueda; onClose: () => void; onSaved: (updated: Busqueda) => void }) {
  const [form, setForm] = useState<Partial<Busqueda>>({ ...item });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setF = (k: keyof Busqueda, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  async function guardar() {
    setGuardando(true); setError(null);
    const payload: Record<string, unknown> = {
      operacion: form.operacion, tipo_propiedad: form.tipo_propiedad,
      ciudad: form.ciudad, zona: form.zona || null,
      presupuesto_min: form.presupuesto_min ? Number(form.presupuesto_min) : null,
      presupuesto_max: form.presupuesto_max ? Number(form.presupuesto_max) : null,
      moneda: form.moneda,
      dormitorios_min: form.dormitorios_min ? Number(form.dormitorios_min) : null,
      dormitorios_max: form.dormitorios_max ? Number(form.dormitorios_max) : null,
      banos_min: form.banos_min ? Number(form.banos_min) : null,
      banos_max: form.banos_max ? Number(form.banos_max) : null,
      superficie_min: form.superficie_min ? Number(form.superficie_min) : null,
      superficie_max: form.superficie_max ? Number(form.superficie_max) : null,
      tipo_superficie: form.tipo_superficie || "total",
      antiguedad: form.antiguedad || null,
      apto_credito: !!form.apto_credito, uso_comercial: !!form.uso_comercial,
      barrio_cerrado: !!form.barrio_cerrado, con_cochera: !!form.con_cochera,
      acepta_mascotas: !!form.acepta_mascotas, acepta_bitcoin: !!form.acepta_bitcoin,
      urgente: !!form.urgente, descripcion: form.descripcion || null,
      activo: !!form.activo,
    };
    const { error: err } = await supabase.from("mir_busquedas").update(payload).eq("id", item.id);
    if (err) { setError(err.message); setGuardando(false); return; }
    onSaved({ ...item, ...payload } as Busqueda);
    onClose();
  }

  const inp: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 5,
    color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter,sans-serif", width: "100%", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 };
  const fld: React.CSSProperties = { marginBottom: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: "#fff" }}>Editar Búsqueda</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={fld}>
            <label style={lbl}>Operación</label>
            <select style={inp} value={form.operacion} onChange={e => setF("operacion", e.target.value)}>
              {OPS_BUSQUEDA.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={fld}>
            <label style={lbl}>Tipo de propiedad</label>
            <select style={inp} value={form.tipo_propiedad} onChange={e => setF("tipo_propiedad", e.target.value)}>
              {TIPOS_PROPIEDAD.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={fld}>
            <label style={lbl}>Ciudad</label>
            <input style={inp} value={form.ciudad ?? ""} onChange={e => setF("ciudad", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Zona / Barrio</label>
            <input style={inp} value={form.zona ?? ""} onChange={e => setF("zona", e.target.value)} placeholder="Opcional" />
          </div>
          <div style={fld}>
            <label style={lbl}>Presupuesto mín.</label>
            <input style={inp} type="number" value={form.presupuesto_min ?? ""} onChange={e => setF("presupuesto_min", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Presupuesto máx.</label>
            <input style={inp} type="number" value={form.presupuesto_max ?? ""} onChange={e => setF("presupuesto_max", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Moneda</label>
            <select style={inp} value={form.moneda} onChange={e => setF("moneda", e.target.value)}>
              {MONEDAS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={fld}>
            <label style={lbl}>Tipo superficie</label>
            <select style={inp} value={form.tipo_superficie} onChange={e => setF("tipo_superficie", e.target.value)}>
              <option value="cubierta">Cubierta</option>
              <option value="total">Total</option>
              <option value="terreno">Terreno</option>
            </select>
          </div>
          <div style={fld}>
            <label style={lbl}>Dorm. mín.</label>
            <input style={inp} type="number" value={form.dormitorios_min ?? ""} onChange={e => setF("dormitorios_min", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Dorm. máx.</label>
            <input style={inp} type="number" value={form.dormitorios_max ?? ""} onChange={e => setF("dormitorios_max", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Sup. mín. (m²)</label>
            <input style={inp} type="number" value={form.superficie_min ?? ""} onChange={e => setF("superficie_min", e.target.value)} />
          </div>
          <div style={fld}>
            <label style={lbl}>Sup. máx. (m²)</label>
            <input style={inp} type="number" value={form.superficie_max ?? ""} onChange={e => setF("superficie_max", e.target.value)} />
          </div>
          <div style={{ ...fld, gridColumn: "1/-1" }}>
            <label style={lbl}>Antigüedad</label>
            <select style={inp} value={form.antiguedad ?? ""} onChange={e => setF("antiguedad", e.target.value)}>
              {ANTIGUEDADES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          {(["apto_credito", "con_cochera", "barrio_cerrado", "uso_comercial", "acepta_mascotas", "acepta_bitcoin", "urgente", "activo"] as (keyof Busqueda)[]).map((k, i) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!form[k]} onChange={e => setF(k, e.target.checked)} />
              {["Apto crédito", "Cochera", "B. cerrado", "Comercial", "Mascotas", "Bitcoin", "Urgente", "Activo"][i]}
            </label>
          ))}
        </div>

        <div style={fld}>
          <label style={lbl}>Descripción / Detalles adicionales</label>
          <textarea style={{ ...inp, height: 80, resize: "vertical" }} value={form.descripcion ?? ""} onChange={e => setF("descripcion", e.target.value)} />
        </div>

        {error && <div style={{ color: "#b80000", fontSize: 12, marginBottom: 10 }}>✕ {error}</div>}

        <button onClick={guardar} disabled={guardando}
          style={{ width: "100%", padding: 12, background: guardando ? "rgba(153,0,0,0.4)" : "#990000", border: "none", borderRadius: 6, color: "#fff", fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: guardando ? "not-allowed" : "pointer" }}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminMirPage() {
  const [tab, setTab] = useState<"ofrecidos" | "busquedas">("ofrecidos");
  const [ofrecidos, setOfrecidos] = useState<Ofrecido[]>([]);
  const [busquedas, setBusquedas] = useState<Busqueda[]>([]);
  const [loading, setLoading] = useState(true);
  const [busq, setBusq] = useState("");
  const [filtroOp, setFiltroOp] = useState("");
  const [filtroCiudad, setFiltroCiudad] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<"todos" | "activos" | "inactivos">("todos");
  const [editandoOf, setEditandoOf] = useState<Ofrecido | null>(null);
  const [editandoBq, setEditandoBq] = useState<Busqueda | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const [{ data: ofs }, { data: bqs }] = await Promise.all([
      supabase.from("mir_ofrecidos")
        .select("*, perfiles(nombre,apellido,matricula,telefono)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("mir_busquedas")
        .select("*, perfiles(nombre,apellido,matricula,telefono)")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setOfrecidos((ofs ?? []) as Ofrecido[]);
    setBusquedas((bqs ?? []) as Busqueda[]);
    setLoading(false);
  }

  async function toggleActivo(tabla: "mir_ofrecidos" | "mir_busquedas", id: string, actual: boolean) {
    await supabase.from(tabla).update({ activo: !actual }).eq("id", id);
    if (tabla === "mir_ofrecidos") {
      setOfrecidos(prev => prev.map(o => o.id === id ? { ...o, activo: !actual } : o));
    } else {
      setBusquedas(prev => prev.map(b => b.id === id ? { ...b, activo: !actual } : b));
    }
  }

  async function eliminar(tabla: "mir_ofrecidos" | "mir_busquedas", id: string) {
    if (!confirm("¿Eliminar este registro del MIR? Esta acción no se puede deshacer.")) return;
    setEliminando(id);
    await supabase.from(tabla).delete().eq("id", id);
    if (tabla === "mir_ofrecidos") setOfrecidos(prev => prev.filter(o => o.id !== id));
    else setBusquedas(prev => prev.filter(b => b.id !== id));
    setEliminando(null);
  }

  const ofrecidosFiltrados = useMemo(() => {
    const q = busq.toLowerCase();
    return ofrecidos.filter(o => {
      if (filtroOp && o.operacion !== filtroOp) return false;
      if (filtroCiudad && !o.ciudad.toLowerCase().includes(filtroCiudad.toLowerCase())) return false;
      if (filtroActivo === "activos" && !o.activo) return false;
      if (filtroActivo === "inactivos" && o.activo) return false;
      if (!q) return true;
      const corredor = o.perfiles ? `${o.perfiles.nombre} ${o.perfiles.apellido}` : (o.nombre_publicante ?? "");
      return (
        o.ciudad.toLowerCase().includes(q) ||
        (o.zona ?? "").toLowerCase().includes(q) ||
        o.tipo_propiedad.toLowerCase().includes(q) ||
        corredor.toLowerCase().includes(q) ||
        (o.descripcion ?? "").toLowerCase().includes(q)
      );
    });
  }, [ofrecidos, busq, filtroOp, filtroCiudad, filtroActivo]);

  const busquedasFiltradas = useMemo(() => {
    const q = busq.toLowerCase();
    return busquedas.filter(b => {
      if (filtroOp && b.operacion !== filtroOp) return false;
      if (filtroCiudad && !b.ciudad.toLowerCase().includes(filtroCiudad.toLowerCase())) return false;
      if (filtroActivo === "activos" && !b.activo) return false;
      if (filtroActivo === "inactivos" && b.activo) return false;
      if (!q) return true;
      const corredor = b.perfiles ? `${b.perfiles.nombre} ${b.perfiles.apellido}` : (b.nombre_publicante ?? "");
      return (
        b.ciudad.toLowerCase().includes(q) ||
        (b.zona ?? "").toLowerCase().includes(q) ||
        b.tipo_propiedad.toLowerCase().includes(q) ||
        corredor.toLowerCase().includes(q) ||
        (b.descripcion ?? "").toLowerCase().includes(q)
      );
    });
  }, [busquedas, busq, filtroOp, filtroCiudad, filtroActivo]);

  const st = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif" } as React.CSSProperties,
    header: { background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 } as React.CSSProperties,
    badge: (color: string) => ({ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase" as const }),
    inp: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 5, color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter,sans-serif" } as React.CSSProperties,
    btn: (color: string) => ({ padding: "4px 10px", borderRadius: 4, border: `1px solid ${color}44`, background: `${color}11`, color, fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: "pointer", textTransform: "uppercase" as const }),
  };

  const ops = tab === "ofrecidos" ? OPS_OFRECIDO : OPS_BUSQUEDA;

  const listaOrdenada = useMemo(() => {
    const arr: (Ofrecido | Busqueda)[] = tab === "ofrecidos" ? ofrecidosFiltrados : busquedasFiltradas;
    return [...arr].sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0;
      if (sortCol === "fecha") { va = a.created_at; vb = b.created_at; }
      else if (sortCol === "ciudad") { va = a.ciudad ?? ""; vb = b.ciudad ?? ""; }
      else if (sortCol === "operacion") { va = a.operacion ?? ""; vb = b.operacion ?? ""; }
      else if (sortCol === "precio") {
        va = tab === "ofrecidos" ? ((a as Ofrecido).precio ?? 0) : ((a as Busqueda).presupuesto_max ?? (a as Busqueda).presupuesto_min ?? 0);
        vb = tab === "ofrecidos" ? ((b as Ofrecido).precio ?? 0) : ((b as Busqueda).presupuesto_max ?? (b as Busqueda).presupuesto_min ?? 0);
      }
      else if (sortCol === "corredor") {
        va = a.perfiles ? `${a.perfiles.apellido} ${a.perfiles.nombre}` : (a.nombre_publicante ?? "");
        vb = b.perfiles ? `${b.perfiles.apellido} ${b.perfiles.nombre}` : (b.nombre_publicante ?? "");
      }
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      const cmp = String(va).toLowerCase().localeCompare(String(vb).toLowerCase(), "es-AR");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [ofrecidosFiltrados, busquedasFiltradas, tab, sortCol, sortDir]);

  const lista = listaOrdenada;
  const total = tab === "ofrecidos" ? ofrecidos.length : busquedas.length;
  const activos = tab === "ofrecidos"
    ? ofrecidos.filter(o => o.activo).length
    : busquedas.filter(b => b.activo).length;

  return (
    <div style={st.page}>
      {/* Header */}
      <div style={st.header}>
        <Link href="/admin" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← Admin</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat,sans-serif", fontWeight: 800 }}>🔁 MIR — Gestión Admin</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Ofrecidos y búsquedas del Mercado Inmobiliario en Red</p>
        </div>
        <button onClick={cargar} style={st.btn("#888")}>↻ Recargar</button>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* Tabs + stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          {(["ofrecidos", "busquedas"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 18px", borderRadius: 6, border: "none", cursor: "pointer",
              fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              background: tab === t ? "#990000" : "rgba(255,255,255,0.06)",
              color: tab === t ? "#fff" : "rgba(255,255,255,0.4)",
            }}>
              {t === "ofrecidos" ? "🏠 Ofrecidos" : "🔍 Búsquedas"}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                ({t === "ofrecidos" ? ofrecidos.length : busquedas.length})
              </span>
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            <span>Total: <strong style={{ color: "#fff" }}>{total}</strong></span>
            <span>Activos: <strong style={{ color: "#3abab6" }}>{activos}</strong></span>
            <span>Inactivos: <strong style={{ color: "#b80000" }}>{total - activos}</strong></span>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            value={busq} onChange={e => setBusq(e.target.value)}
            placeholder="Buscar corredor, ciudad, tipo..."
            style={{ ...st.inp, flex: 1, minWidth: 200 }}
          />
          <select value={filtroOp} onChange={e => setFiltroOp(e.target.value)} style={st.inp}>
            <option value="">Todas las operaciones</option>
            {ops.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <input
            value={filtroCiudad} onChange={e => setFiltroCiudad(e.target.value)}
            placeholder="Ciudad..."
            style={{ ...st.inp, width: 140 }}
          />
          <select value={filtroActivo} onChange={e => setFiltroActivo(e.target.value as typeof filtroActivo)} style={st.inp}>
            <option value="todos">Todos</option>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
          </select>
        </div>

        {/* Barra de ordenamiento */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 4 }}>Ordenar:</span>
          {([
            { key: "fecha", label: "Fecha" },
            { key: "ciudad", label: "Ciudad" },
            { key: "operacion", label: "Operación" },
            { key: "precio", label: tab === "ofrecidos" ? "Precio" : "Presupuesto" },
            { key: "corredor", label: "Corredor" },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => {
              if (sortCol === key) setSortDir(d => d === "asc" ? "desc" : "asc");
              else { setSortCol(key); setSortDir(key === "fecha" ? "desc" : "asc"); }
            }} style={{
              padding: "3px 10px", borderRadius: 3, cursor: "pointer", fontSize: 10,
              fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.06em",
              border: `1px solid ${sortCol === key ? "#990000" : "rgba(255,255,255,0.1)"}`,
              background: sortCol === key ? "rgba(200,0,0,0.12)" : "transparent",
              color: sortCol === key ? "#fff" : "rgba(255,255,255,0.4)",
            }}>
              {label}{sortCol === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: 48 }}>Cargando MIR...</div>
        ) : lista.length === 0 ? (
          <div style={{ textAlign: "center", color: "#555", padding: 48 }}>Sin resultados</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tab === "ofrecidos" && (listaOrdenada as Ofrecido[]).map(o => {
              const corredor = o.perfiles
                ? `${o.perfiles.nombre} ${o.perfiles.apellido}${o.perfiles.matricula ? ` · Mat. ${o.perfiles.matricula}` : ""}`
                : (o.nombre_publicante ?? "Sin corredor");
              return (
                <div key={o.id} style={{
                  background: o.activo ? "#111" : "rgba(239,68,68,0.04)",
                  border: `1px solid ${o.activo ? "rgba(255,255,255,0.07)" : "rgba(239,68,68,0.2)"}`,
                  borderRadius: 8, padding: "12px 16px",
                  display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
                }}>
                  {/* Badges */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
                    <span style={st.badge(OP_COLOR[o.operacion] ?? "#888")}>{o.operacion}</span>
                    {!o.activo && <span style={st.badge("#b80000")}>Inactivo</span>}
                    {o.urgente && <span style={st.badge("#d4960c")}>⚡ Urgente</span>}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>
                      {o.tipo_propiedad} · {o.ciudad}{o.zona ? `, ${o.zona}` : ""}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                      {corredor} · {fmtFecha(o.created_at)}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {o.precio && <span>{o.moneda} {fmt(o.precio)}</span>}
                      {o.dormitorios && <span>{o.dormitorios} dorm.</span>}
                      {o.superficie_cubierta && <span>{o.superficie_cubierta} m²</span>}
                      {o.apto_credito && <span style={{ color: "#3abab6" }}>Apto crédito</span>}
                    </div>
                    {o.descripcion && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4, fontStyle: "italic" }}>
                        {o.descripcion.slice(0, 120)}{o.descripcion.length > 120 ? "..." : ""}
                      </div>
                    )}
                  </div>
                  {/* Acciones */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => setEditandoOf(o)} style={st.btn("#4ab8d8")}>✏️ Editar</button>
                    <button onClick={() => toggleActivo("mir_ofrecidos", o.id, o.activo)}
                      style={st.btn(o.activo ? "#b80000" : "#3abab6")}>
                      {o.activo ? "Pausar" : "Activar"}
                    </button>
                    <button onClick={() => eliminar("mir_ofrecidos", o.id)}
                      disabled={eliminando === o.id}
                      style={st.btn("#b80000")}>
                      {eliminando === o.id ? "..." : "🗑"}
                    </button>
                  </div>
                </div>
              );
            })}

            {tab === "busquedas" && (listaOrdenada as Busqueda[]).map(b => {
              const corredor = b.perfiles
                ? `${b.perfiles.nombre} ${b.perfiles.apellido}${b.perfiles.matricula ? ` · Mat. ${b.perfiles.matricula}` : ""}`
                : (b.nombre_publicante ?? "Sin corredor");
              const presup = b.presupuesto_max
                ? `${b.moneda} ${fmt(b.presupuesto_min)} – ${fmt(b.presupuesto_max)}`
                : b.presupuesto_min ? `${b.moneda} desde ${fmt(b.presupuesto_min)}` : null;
              return (
                <div key={b.id} style={{
                  background: b.activo ? "#111" : "rgba(239,68,68,0.04)",
                  border: `1px solid ${b.activo ? "rgba(255,255,255,0.07)" : "rgba(239,68,68,0.2)"}`,
                  borderRadius: 8, padding: "12px 16px",
                  display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
                    <span style={st.badge(OP_COLOR[b.operacion] ?? "#888")}>{b.operacion}</span>
                    {!b.activo && <span style={st.badge("#b80000")}>Inactiva</span>}
                    {b.urgente && <span style={st.badge("#d4960c")}>⚡ Urgente</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>
                      {b.tipo_propiedad} · {b.ciudad}{b.zona ? `, ${b.zona}` : ""}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                      {corredor} · {fmtFecha(b.created_at)}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {presup && <span>{presup}</span>}
                      {b.dormitorios_min && <span>{b.dormitorios_min}{b.dormitorios_max ? `–${b.dormitorios_max}` : "+"} dorm.</span>}
                      {b.superficie_min && <span>desde {b.superficie_min} m²</span>}
                      {b.apto_credito && <span style={{ color: "#3abab6" }}>Apto crédito</span>}
                    </div>
                    {b.descripcion && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4, fontStyle: "italic" }}>
                        {b.descripcion.slice(0, 120)}{b.descripcion.length > 120 ? "..." : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => setEditandoBq(b)} style={st.btn("#4ab8d8")}>✏️ Editar</button>
                    <button onClick={() => toggleActivo("mir_busquedas", b.id, b.activo)}
                      style={st.btn(b.activo ? "#b80000" : "#3abab6")}>
                      {b.activo ? "Pausar" : "Activar"}
                    </button>
                    <button onClick={() => eliminar("mir_busquedas", b.id)}
                      disabled={eliminando === b.id}
                      style={st.btn("#b80000")}>
                      {eliminando === b.id ? "..." : "🗑"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modales */}
      {editandoOf && (
        <ModalOfrecido
          item={editandoOf}
          onClose={() => setEditandoOf(null)}
          onSaved={updated => setOfrecidos(prev => prev.map(o => o.id === updated.id ? updated : o))}
        />
      )}
      {editandoBq && (
        <ModalBusqueda
          item={editandoBq}
          onClose={() => setEditandoBq(null)}
          onSaved={updated => setBusquedas(prev => prev.map(b => b.id === updated.id ? updated : b))}
        />
      )}
    </div>
  );
}
