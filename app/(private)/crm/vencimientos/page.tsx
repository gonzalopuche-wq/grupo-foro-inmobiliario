"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const STORAGE_KEY = "crm_vencimientos_custom_v1";

interface NegocioRaw {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string;
  contacto_id: string | null;
  fecha_reserva: string | null;
  fecha_escritura: string | null;
  fecha_cierre: string | null;
  fecha_primer_contacto: string | null;
  fecha_visita: string | null;
  archivado: boolean;
}

interface ContactoRaw {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
}

interface VencimientoCustom {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  tipo: "contrato" | "documento" | "pago" | "llamada" | "otro";
  contactoNombre: string;
  alerta: number; // días de anticipación para alertar
}

interface ItemVencimiento {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  diasRestantes: number;
  urgencia: "vencido" | "critico" | "proximo" | "normal";
  tipo: string;
  negocioId: string | null;
  contactoNombre: string;
  telefono: string | null;
  esCustom: boolean;
}

const TIPO_COLORS: Record<string, string> = {
  reserva:     "#f97316",
  escritura:   "#cc0000",
  cierre:      "#a855f7",
  visita:      "#3b82f6",
  contrato:    "#eab308",
  documento:   "#6b7280",
  pago:        "#22c55e",
  llamada:     "#06b6d4",
  otro:        "#9ca3af",
};

const TIPO_LABELS: Record<string, string> = {
  reserva:    "Reserva",
  escritura:  "Escritura",
  cierre:     "Cierre",
  visita:     "Visita",
  contrato:   "Contrato",
  documento:  "Documento",
  pago:       "Pago",
  llamada:    "Llamada",
  otro:       "Otro",
};

function diasHasta(fechaStr: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaStr + "T12:00:00");
  return Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
}

function urgencia(dias: number): ItemVencimiento["urgencia"] {
  if (dias < 0)   return "vencido";
  if (dias <= 3)  return "critico";
  if (dias <= 14) return "proximo";
  return "normal";
}

const URG_CONFIG = {
  vencido: { label: "Vencido",   color: "#cc0000",  bg: "rgba(204,0,0,0.08)" },
  critico: { label: "Crítico",   color: "#f97316",  bg: "rgba(249,115,22,0.08)" },
  proximo: { label: "Próximo",   color: "#eab308",  bg: "rgba(234,179,8,0.08)" },
  normal:  { label: "Ok",        color: "#22c55e",  bg: "rgba(34,197,94,0.04)" },
};

const FORM_DEFAULT: Omit<VencimientoCustom, "id"> = {
  titulo: "",
  descripcion: "",
  fecha: new Date().toISOString().split("T")[0],
  tipo: "contrato",
  contactoNombre: "",
  alerta: 7,
};

export default function VencimientosPage() {
  const [negocios, setNegocios] = useState<NegocioRaw[]>([]);
  const [contactos, setContactos] = useState<ContactoRaw[]>([]);
  const [customs, setCustoms] = useState<VencimientoCustom[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<Omit<VencimientoCustom, "id">>(FORM_DEFAULT);
  const [filtroUrgencia, setFiltroUrgencia] = useState<"todos" | "vencido" | "critico" | "proximo" | "normal">("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [completados, setCompletados] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { items, done } = JSON.parse(stored);
        setCustoms(items ?? []);
        setCompletados(new Set(done ?? []));
      } catch {
        setCustoms([]);
      }
    }

    const cargar = async () => {
      const [{ data: negs }, { data: ctcs }] = await Promise.all([
        supabase.from("crm_negocios").select("id,titulo,etapa,tipo_operacion,contacto_id,fecha_reserva,fecha_escritura,fecha_cierre,fecha_primer_contacto,fecha_visita,archivado"),
        supabase.from("crm_contactos").select("id,nombre,apellido,telefono"),
      ]);
      setNegocios((negs ?? []) as NegocioRaw[]);
      setContactos((ctcs ?? []) as ContactoRaw[]);
      setLoading(false);
    };
    cargar();
  }, []);

  const contactoMap = useMemo(() => {
    const m: Record<string, ContactoRaw> = {};
    contactos.forEach(c => { m[c.id] = c; });
    return m;
  }, [contactos]);

  const items = useMemo<ItemVencimiento[]>(() => {
    const result: ItemVencimiento[] = [];

    // De negocios
    for (const n of negocios) {
      if (n.archivado) continue;
      const contacto = n.contacto_id ? contactoMap[n.contacto_id] : null;
      const nombreContacto = contacto ? `${contacto.nombre} ${contacto.apellido}` : "";
      const tel = contacto?.telefono ?? null;

      const fechas: { fecha: string | null; tipo: string; desc: string }[] = [
        { fecha: n.fecha_reserva,        tipo: "reserva",   desc: `Reserva — ${n.titulo}` },
        { fecha: n.fecha_escritura,      tipo: "escritura", desc: `Escritura — ${n.titulo}` },
        { fecha: n.fecha_cierre,         tipo: "cierre",    desc: `Cierre — ${n.titulo}` },
        { fecha: n.fecha_visita,         tipo: "visita",    desc: `Visita — ${n.titulo}` },
      ];

      for (const f of fechas) {
        if (!f.fecha) continue;
        const dias = diasHasta(f.fecha);
        result.push({
          id: `${n.id}_${f.tipo}`,
          titulo: f.desc,
          descripcion: n.tipo_operacion,
          fecha: f.fecha,
          diasRestantes: dias,
          urgencia: urgencia(dias),
          tipo: f.tipo,
          negocioId: n.id,
          contactoNombre: nombreContacto,
          telefono: tel,
          esCustom: false,
        });
      }
    }

    // Personalizados
    for (const c of customs) {
      if (completados.has(c.id)) continue;
      const dias = diasHasta(c.fecha);
      result.push({
        id: c.id,
        titulo: c.titulo,
        descripcion: c.descripcion,
        fecha: c.fecha,
        diasRestantes: dias,
        urgencia: urgencia(dias),
        tipo: c.tipo,
        negocioId: null,
        contactoNombre: c.contactoNombre,
        telefono: null,
        esCustom: true,
      });
    }

    return result.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [negocios, customs, contactoMap, completados]);

  const visibles = useMemo(() => {
    return items.filter(i => {
      if (filtroUrgencia !== "todos" && i.urgencia !== filtroUrgencia) return false;
      if (filtroTipo !== "todos" && i.tipo !== filtroTipo) return false;
      return true;
    });
  }, [items, filtroUrgencia, filtroTipo]);

  const stats = useMemo(() => ({
    vencido: items.filter(i => i.urgencia === "vencido").length,
    critico: items.filter(i => i.urgencia === "critico").length,
    proximo: items.filter(i => i.urgencia === "proximo").length,
    total:   items.length,
  }), [items]);

  const tiposUnicos = useMemo(() => {
    const s = new Set(items.map(i => i.tipo));
    return ["todos", ...Array.from(s)];
  }, [items]);

  const agregarCustom = () => {
    if (!form.titulo || !form.fecha) return;
    const nuevo: VencimientoCustom = { ...form, id: `c_${Date.now()}` };
    const nuevosCustoms = [...customs, nuevo];
    setCustoms(nuevosCustoms);
    persistir(nuevosCustoms, completados);
    setForm(FORM_DEFAULT);
    setMostrarForm(false);
  };

  const eliminarCustom = (id: string) => {
    const nuevos = customs.filter(c => c.id !== id);
    setCustoms(nuevos);
    persistir(nuevos, completados);
  };

  const marcarCompletado = (id: string) => {
    const nuevo = new Set([...completados, id]);
    setCompletados(nuevo);
    const esCustom = customs.find(c => c.id === id);
    persistir(esCustom ? customs : customs, nuevo);
  };

  const persistir = (c: VencimientoCustom[], done: Set<string>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: c, done: [...done] }));
  };

  const waRec = (item: ItemVencimiento) => {
    if (!item.telefono) return;
    const fechaFmt = new Date(item.fecha + "T12:00:00").toLocaleDateString("es-AR");
    const msg = `Hola ${item.contactoNombre}! Te recuerdo que el ${fechaFmt} tenemos ${item.titulo}. Cualquier consulta estoy a disposición. Saludos!`;
    window.open(`https://wa.me/${item.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>📅 Vencimientos y Fechas Clave</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Reservas, escrituras, cierres y recordatorios personalizados</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setMostrarForm(v => !v)}
              style={{ background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", padding: "8px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
              + Agregar
            </button>
            <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total próximas fechas", value: stats.total,   color: "#e5e5e5" },
            { label: "🔴 Vencidas",           value: stats.vencido, color: "#cc0000" },
            { label: "🟠 Críticas (≤3d)",     value: stats.critico, color: "#f97316" },
            { label: "🟡 Próximas (≤14d)",    value: stats.proximo, color: "#eab308" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Formulario agregar */}
        {mostrarForm && (
          <div style={{ background: "#111", border: "1px solid #cc000044", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#cc0000", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Nuevo vencimiento</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Título *</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Fecha *</label>
                <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as VencimientoCustom["tipo"] }))}
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 12, width: "100%", boxSizing: "border-box" }}>
                  {(["contrato","documento","pago","llamada","otro"] as const).map(t => (
                    <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Contacto (nombre)</label>
                <input value={form.contactoNombre} onChange={e => setForm(f => ({ ...f, contactoNombre: e.target.value }))}
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Descripción</label>
                <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Alertar con N días de anticipación</label>
                <input type="number" value={form.alerta} step={1} min={0}
                  onChange={e => setForm(f => ({ ...f, alerta: parseInt(e.target.value) || 0 }))}
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={agregarCustom}
                style={{ background: "#cc0000", border: "none", borderRadius: 6, color: "#fff", padding: "8px 16px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                Guardar
              </button>
              <button onClick={() => { setMostrarForm(false); setForm(FORM_DEFAULT); }}
                style={{ background: "transparent", border: "1px solid #374151", borderRadius: 6, color: "#6b7280", padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Urgencia:</span>
          {(["todos","vencido","critico","proximo","normal"] as const).map(u => (
            <button key={u} onClick={() => setFiltroUrgencia(u)}
              style={{ background: filtroUrgencia === u ? "#1f2937" : "transparent", border: `1px solid ${filtroUrgencia === u ? "#374151" : "#1f2937"}`, borderRadius: 6, color: u === "todos" ? "#e5e5e5" : URG_CONFIG[u]?.color ?? "#e5e5e5", padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
              {u === "todos" ? "Todos" : URG_CONFIG[u].label}
            </button>
          ))}
          <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 8 }}>Tipo:</span>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "4px 8px", fontSize: 11 }}>
            {tiposUnicos.map(t => <option key={t} value={t}>{t === "todos" ? "Todos los tipos" : TIPO_LABELS[t] ?? t}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 48 }}>Cargando fechas...</div>
        ) : visibles.length === 0 ? (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗓️</div>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#22c55e" }}>Sin vencimientos pendientes</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Agregá fechas importantes o completá datos en tus negocios</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibles.map(item => {
              const urg = URG_CONFIG[item.urgencia];
              const tipColor = TIPO_COLORS[item.tipo] ?? "#9ca3af";
              return (
                <div key={item.id}
                  style={{ background: urg.bg, border: `1px solid ${urg.color}33`, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ background: `${tipColor}22`, color: tipColor, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                        {TIPO_LABELS[item.tipo] ?? item.tipo}
                      </span>
                      {item.esCustom && (
                        <span style={{ background: "#1f2937", color: "#6b7280", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>CUSTOM</span>
                      )}
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#e5e5e5" }}>{item.titulo}</span>
                    </div>
                    <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                      <span>📅 {new Date(item.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}</span>
                      {item.contactoNombre && <span>👤 {item.contactoNombre}</span>}
                      {item.descripcion && <span>· {item.descripcion}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 20, color: urg.color }}>
                        {item.diasRestantes < 0 ? `${Math.abs(item.diasRestantes)}d` : item.diasRestantes === 0 ? "HOY" : `${item.diasRestantes}d`}
                      </div>
                      <div style={{ fontSize: 10, color: urg.color }}>{item.diasRestantes < 0 ? "vencido" : item.diasRestantes === 0 ? "hoy" : "restantes"}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {item.telefono && (
                        <button onClick={() => waRec(item)}
                          style={{ background: "#25d366", border: "none", borderRadius: 5, color: "#fff", padding: "5px 8px", fontSize: 10, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                          WA
                        </button>
                      )}
                      {item.negocioId && (
                        <Link href={`/crm/negocios?id=${item.negocioId}`}
                          style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 5, color: "#3b82f6", padding: "5px 8px", fontSize: 10, textDecoration: "none", textAlign: "center" }}>
                          →
                        </Link>
                      )}
                      <button onClick={() => marcarCompletado(item.id)}
                        style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 5, color: "#22c55e", padding: "5px 8px", fontSize: 10, cursor: "pointer" }}
                        title="Marcar como completado">
                        ✓
                      </button>
                      {item.esCustom && (
                        <button onClick={() => eliminarCustom(item.id)}
                          style={{ background: "transparent", border: "1px solid #cc000033", borderRadius: 5, color: "#cc0000", padding: "5px 8px", fontSize: 10, cursor: "pointer" }}>
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", marginTop: 20, fontSize: 12, color: "#6b7280" }}>
          <strong style={{ color: "#9ca3af" }}>📌 Fuentes:</strong> Las fechas de reserva, escritura, cierre y visita se toman de los negocios activos del CRM. Podés agregar vencimientos propios (contratos, documentos, pagos) que se guardan localmente.
        </div>
      </div>
    </div>
  );
}
