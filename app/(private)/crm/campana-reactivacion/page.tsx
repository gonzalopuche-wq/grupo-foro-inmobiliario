"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipo: string | null;
  estado: string | null;
  zona_interes: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: string | null;
  created_at: string;
}

interface Interaccion {
  contacto_id: string;
  created_at: string;
}

interface ContactoInactivo extends Contacto {
  ultimaInteraccion: string | null;
  diasSinContacto: number;
  categoria: "tibia" | "fria" | "perdida";
}

const STORAGE_KEY = "crm_reactivados_v1";

const CAT_CONFIG = {
  tibia:   { label: "Tibia",   color: "#eab308", dias: "30–60 días",   icon: "🟡" },
  fria:    { label: "Fría",    color: "#f97316", dias: "60–90 días",   icon: "🟠" },
  perdida: { label: "Perdida", color: "#cc0000", dias: ">90 días",      icon: "🔴" },
};

function diasDesde(fecha: string | null, ahora: Date): number {
  if (!fecha) return 9999;
  return Math.floor((ahora.getTime() - new Date(fecha).getTime()) / 86400000);
}

function fmtPresupuesto(min: number | null, max: number | null, moneda: string | null): string {
  if (!min && !max) return "";
  const m = moneda ?? "ARS";
  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
  if (min && max) return `${m} ${fmt(min)}–${fmt(max)}`;
  if (max) return `${m} hasta ${fmt(max)}`;
  return `${m} desde ${fmt(min!)}`;
}

function generarMensajeWA(c: ContactoInactivo, plantilla: string): string {
  const nombre = c.nombre;
  const zona = c.zona_interes ?? "su zona de interés";
  const presup = fmtPresupuesto(c.presupuesto_min, c.presupuesto_max, c.moneda);
  return plantilla
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{zona\}/g, zona)
    .replace(/\{presupuesto\}/g, presup || "su presupuesto");
}

const PLANTILLAS_DEFAULT = [
  {
    id: "reactivacion",
    label: "Reactivación general",
    texto: "Hola {nombre}! 👋 Te escribo desde Grupo Foro Inmobiliario. Hace un tiempo que no hablamos y quería saber cómo te encontrás con tu búsqueda en {zona}. ¿Seguís buscando? Tenemos nuevas opciones que podrían interesarte. Cualquier consulta estoy a disposición. Saludos!",
  },
  {
    id: "novedades",
    label: "Novedades de zona",
    texto: "Hola {nombre}! Te contacto porque tenemos novedades en {zona} que se ajustan a lo que estabas buscando. Si querés te cuento más detalles. Saludos desde Grupo Foro Inmobiliario!",
  },
  {
    id: "baja_tasa",
    label: "Bajada de precios / oportunidad",
    texto: "Hola {nombre}! 🏠 Surgió una oportunidad que creo que te puede interesar en {zona} dentro de {presupuesto}. ¿Tenés 5 minutos para charlar? Saludos!",
  },
];

export default function CampanaReactivacionPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [interacciones, setInteracciones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reactivados, setReactivados] = useState<Set<string>>(new Set());
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [filtroCategoria, setFiltroCategoria] = useState<"todos" | "tibia" | "fria" | "perdida">("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [umbral, setUmbral] = useState(30);
  const [plantillaId, setPlantillaId] = useState("reactivacion");
  const [plantillaTexto, setPlantillaTexto] = useState(PLANTILLAS_DEFAULT[0].texto);
  const [mostrarEditorPlantilla, setMostrarEditorPlantilla] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setReactivados(new Set(JSON.parse(stored)));

    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const uid = user.id;
      const [{ data: ctcs }, { data: ints }] = await Promise.all([
        supabase.from("crm_contactos").select("id,nombre,apellido,telefono,email,tipo,estado,zona_interes,presupuesto_min,presupuesto_max,moneda,created_at").eq("perfil_id", uid),
        supabase.from("crm_interacciones").select("contacto_id,created_at").eq("perfil_id", uid).order("created_at", { ascending: false }),
      ]);

      // Última interacción por contacto
      const ultimaMap: Record<string, string> = {};
      for (const i of (ints ?? []) as Interaccion[]) {
        if (!ultimaMap[i.contacto_id]) ultimaMap[i.contacto_id] = i.created_at;
      }

      setContactos((ctcs ?? []) as Contacto[]);
      setInteracciones(ultimaMap);
      setLoading(false);
    };
    cargar();
  }, []);

  const ahora = useMemo(() => new Date(), []);

  const inactivos = useMemo<ContactoInactivo[]>(() => {
    const result: ContactoInactivo[] = [];
    for (const c of contactos) {
      const ultima: string | null = interacciones[c.id] ?? null;
      const dias = diasDesde(ultima ?? c.created_at, ahora);
      if (dias < umbral) continue;
      const categoria: ContactoInactivo["categoria"] =
        dias >= 90 ? "perdida" : dias >= 60 ? "fria" : "tibia";
      result.push({ ...c, ultimaInteraccion: ultima, diasSinContacto: dias, categoria });
    }
    return result.sort((a, b) => b.diasSinContacto - a.diasSinContacto);
  }, [contactos, interacciones, ahora, umbral]);

  const tiposUnicos = useMemo(() => {
    const s = new Set(inactivos.map(c => c.tipo).filter(Boolean) as string[]);
    return ["todos", ...Array.from(s)];
  }, [inactivos]);

  const visibles = useMemo(() => {
    return inactivos.filter(c => {
      if (reactivados.has(c.id)) return false;
      if (filtroCategoria !== "todos" && c.categoria !== filtroCategoria) return false;
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const nombre = `${c.nombre} ${c.apellido}`.toLowerCase();
        const tel = (c.telefono ?? "").toLowerCase();
        if (!nombre.includes(q) && !tel.includes(q)) return false;
      }
      return true;
    });
  }, [inactivos, reactivados, filtroCategoria, filtroTipo, busqueda]);

  const stats = useMemo(() => ({
    total: inactivos.filter(c => !reactivados.has(c.id)).length,
    tibia:   inactivos.filter(c => c.categoria === "tibia"   && !reactivados.has(c.id)).length,
    fria:    inactivos.filter(c => c.categoria === "fria"    && !reactivados.has(c.id)).length,
    perdida: inactivos.filter(c => c.categoria === "perdida" && !reactivados.has(c.id)).length,
    reactivados: reactivados.size,
  }), [inactivos, reactivados]);

  const marcarReactivado = (id: string) => {
    const nuevo = new Set([...reactivados, id]);
    setReactivados(nuevo);
    setSeleccionados(prev => { const s = new Set(prev); s.delete(id); return s; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...nuevo]));
  };

  const limpiarReactivados = () => {
    setReactivados(new Set());
    localStorage.removeItem(STORAGE_KEY);
  };

  const toggleSeleccion = (id: string) => {
    setSeleccionados(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const seleccionarTodos = () => {
    if (seleccionados.size === visibles.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(visibles.map(c => c.id)));
    }
  };

  const enviarWAIndividual = (c: ContactoInactivo) => {
    if (!c.telefono) return;
    const msg = generarMensajeWA(c, plantillaTexto);
    const tel = c.telefono.replace(/\D/g, "");
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const enviarWABatch = () => {
    const selArray = visibles.filter(c => seleccionados.has(c.id) && c.telefono);
    if (selArray.length === 0) return;
    const msgs = selArray.map(c => {
      const msg = generarMensajeWA(c, plantillaTexto);
      const tel = c.telefono!.replace(/\D/g, "");
      return `• ${c.nombre} ${c.apellido}: wa.me/${tel}`;
    }).join("\n");
    const resumen = `📋 Campaña de reactivación — ${selArray.length} contactos\n\n${msgs}\n\nMensaje:\n${plantillaTexto}`;
    navigator.clipboard.writeText(resumen).catch(() => {});
    window.open(`https://wa.me/${selArray[0].telefono!.replace(/\D/g, "")}?text=${encodeURIComponent(generarMensajeWA(selArray[0], plantillaTexto))}`, "_blank");
  };

  const seleccionarPlantilla = (id: string) => {
    const p = PLANTILLAS_DEFAULT.find(p => p.id === id);
    if (p) { setPlantillaId(id); setPlantillaTexto(p.texto); }
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>📣 Campaña de Reactivación</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Identificá contactos inactivos y enviá mensajes personalizados</p>
          </div>
          <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total inactivos", value: stats.total, color: "#e5e5e5" },
            { label: "🟡 Tibios", value: stats.tibia, color: "#eab308" },
            { label: "🟠 Fríos", value: stats.fria, color: "#f97316" },
            { label: "🔴 Perdidos", value: stats.perdida, color: "#cc0000" },
            { label: "✅ Reactivados", value: stats.reactivados, color: "#22c55e" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
          {/* Panel izquierdo */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Umbral de inactividad */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Configuración</div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Umbral de inactividad (días)</label>
              <input type="number" value={umbral} min={7} max={365} step={7}
                onChange={e => setUmbral(parseInt(e.target.value) || 30)}
                style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {[30, 60, 90].map(d => (
                  <button key={d} onClick={() => setUmbral(d)}
                    style={{ background: umbral === d ? "#cc0000" : "#1f2937", border: "none", borderRadius: 4, color: umbral === d ? "#fff" : "#9ca3af", padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Filtros</div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Categoría</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                {(["todos", "tibia", "fria", "perdida"] as const).map(cat => (
                  <button key={cat} onClick={() => setFiltroCategoria(cat)}
                    style={{ background: filtroCategoria === cat ? "#1f2937" : "transparent", border: `1px solid ${filtroCategoria === cat ? "#374151" : "#1f2937"}`, borderRadius: 6, color: cat === "todos" ? "#e5e5e5" : CAT_CONFIG[cat]?.color ?? "#e5e5e5", padding: "6px 10px", fontSize: 11, cursor: "pointer", textAlign: "left", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                    {cat === "todos" ? "Todos" : `${CAT_CONFIG[cat].icon} ${CAT_CONFIG[cat].label} · ${CAT_CONFIG[cat].dias}`}
                  </button>
                ))}
              </div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Tipo de contacto</label>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 12, width: "100%", boxSizing: "border-box" }}>
                {tiposUnicos.map(t => <option key={t} value={t}>{t === "todos" ? "Todos los tipos" : t}</option>)}
              </select>
            </div>

            {/* Plantilla WA */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase" }}>Plantilla WA</div>
                <button onClick={() => setMostrarEditorPlantilla(v => !v)}
                  style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 11, cursor: "pointer" }}>
                  {mostrarEditorPlantilla ? "Ocultar" : "Editar"}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                {PLANTILLAS_DEFAULT.map(p => (
                  <button key={p.id} onClick={() => seleccionarPlantilla(p.id)}
                    style={{ background: plantillaId === p.id ? "rgba(37,211,102,0.1)" : "transparent", border: `1px solid ${plantillaId === p.id ? "rgba(37,211,102,0.3)" : "#1f2937"}`, borderRadius: 6, color: plantillaId === p.id ? "#22c55e" : "#6b7280", padding: "6px 10px", fontSize: 11, cursor: "pointer", textAlign: "left", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                    {p.label}
                  </button>
                ))}
              </div>
              {mostrarEditorPlantilla && (
                <textarea value={plantillaTexto} onChange={e => setPlantillaTexto(e.target.value)}
                  rows={6} placeholder="Usá {nombre}, {zona}, {presupuesto}"
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "8px 10px", fontSize: 11, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }} />
              )}
              <div style={{ fontSize: 10, color: "#4b5563", marginTop: 6 }}>
                Variables: <span style={{ color: "#22c55e" }}>{"{nombre}"}</span> · <span style={{ color: "#3b82f6" }}>{"{zona}"}</span> · <span style={{ color: "#f97316" }}>{"{presupuesto}"}</span>
              </div>
            </div>

            {reactivados.size > 0 && (
              <button onClick={limpiarReactivados}
                style={{ background: "transparent", border: "1px solid #cc000044", borderRadius: 8, color: "#cc0000", padding: "8px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                Limpiar {reactivados.size} reactivados
              </button>
            )}
          </div>

          {/* Lista de contactos */}
          <div>
            {/* Barra de búsqueda + acciones bulk */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o teléfono..."
                style={{ flex: 1, background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "7px 10px", fontSize: 13, minWidth: 160 }} />
              <button onClick={seleccionarTodos}
                style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#9ca3af", padding: "7px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700, whiteSpace: "nowrap" }}>
                {seleccionados.size === visibles.length && visibles.length > 0 ? "Deseleccionar todo" : `Seleccionar ${visibles.length}`}
              </button>
              {seleccionados.size > 0 && (
                <button onClick={enviarWABatch}
                  style={{ background: "#25d366", border: "none", borderRadius: 6, color: "#fff", padding: "7px 14px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700, whiteSpace: "nowrap" }}>
                  💬 WA a {seleccionados.size} seleccionados
                </button>
              )}
              <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>{visibles.length} contactos</span>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: "#6b7280", padding: 48 }}>Cargando contactos...</div>
            ) : visibles.length === 0 ? (
              <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#22c55e" }}>
                  {stats.total === 0 ? "No hay contactos inactivos" : "No hay resultados para este filtro"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  {reactivados.size > 0 ? `${reactivados.size} contactos ya reactivados.` : ""}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visibles.map(c => {
                  const cfg = CAT_CONFIG[c.categoria];
                  const isSelected = seleccionados.has(c.id);
                  const presup = fmtPresupuesto(c.presupuesto_min, c.presupuesto_max, c.moneda);
                  return (
                    <div key={c.id}
                      onClick={() => toggleSeleccion(c.id)}
                      style={{ background: isSelected ? "rgba(37,211,102,0.05)" : "#111", border: `1px solid ${isSelected ? "rgba(37,211,102,0.3)" : `${cfg.color}33`}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        {/* Checkbox */}
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? "#22c55e" : "#374151"}`, background: isSelected ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2, transition: "all 0.15s" }}>
                          {isSelected && <span style={{ color: "#0a0a0a", fontSize: 11, fontWeight: 900 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div>
                              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>
                                {c.nombre} {c.apellido}
                              </span>
                              {c.tipo && (
                                <span style={{ marginLeft: 8, fontSize: 10, color: "#6b7280", background: "#1f2937", padding: "2px 7px", borderRadius: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                                  {c.tipo}
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ background: `${cfg.color}22`, color: cfg.color, padding: "3px 10px", borderRadius: 4, fontSize: 11, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                                {cfg.icon} {cfg.label}
                              </span>
                              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: cfg.color }}>
                                {c.diasSinContacto === 9999 ? "Sin contacto" : `${c.diasSinContacto}d`}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                            {c.telefono && <span>📞 {c.telefono}</span>}
                            {c.email && <span>✉️ {c.email}</span>}
                            {c.zona_interes && <span>📍 {c.zona_interes}</span>}
                            {presup && <span>💰 {presup}</span>}
                          </div>
                          {c.ultimaInteraccion && (
                            <div style={{ fontSize: 10, color: "#374151", marginTop: 4 }}>
                              Última interacción: {new Date(c.ultimaInteraccion).toLocaleDateString("es-AR")}
                            </div>
                          )}
                          {!c.ultimaInteraccion && (
                            <div style={{ fontSize: 10, color: "#374151", marginTop: 4 }}>
                              Sin interacciones registradas · Creado: {new Date(c.created_at).toLocaleDateString("es-AR")}
                            </div>
                          )}
                        </div>
                        {/* Acciones */}
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          {c.telefono && (
                            <button onClick={() => enviarWAIndividual(c)} title="Enviar WhatsApp"
                              style={{ background: "#25d366", border: "none", borderRadius: 6, color: "#fff", padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                              WA
                            </button>
                          )}
                          <button onClick={() => marcarReactivado(c.id)} title="Marcar como reactivado"
                            style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#9ca3af", padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>
                            ✓
                          </button>
                          <Link href={`/crm/contactos?id=${c.id}`} onClick={e => e.stopPropagation()}
                            style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#3b82f6", padding: "6px 10px", fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center" }}>
                            →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", marginTop: 20, fontSize: 12, color: "#6b7280" }}>
          <strong style={{ color: "#9ca3af" }}>📌 Nota:</strong> La inactividad se calcula desde la última interacción registrada en el CRM. Los contactos marcados como reactivados se ocultan de la lista y se guardan localmente en este dispositivo.
        </div>
      </div>
    </div>
  );
}
