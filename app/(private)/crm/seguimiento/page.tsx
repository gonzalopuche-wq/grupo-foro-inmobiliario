"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipo: string | null;
  estado: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: string | null;
  zona_interes: string | null;
  updated_at: string;
}

interface UltimaInteraccion {
  contacto_id: string;
  tipo: string;
  created_at: string;
}

interface NegocioResumen {
  contacto_id: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string;
}

interface ContactoScorado {
  contacto: Contacto;
  score: number;
  temperatura: "caliente" | "tibio" | "frio";
  diasSinContacto: number | null;
  ultimaInteraccion: UltimaInteraccion | null;
  negocio: NegocioResumen | null;
  accionSugerida: string;
  iconoAccion: string;
}

// ── scoring ───────────────────────────────────────────────────────────────────
const ETAPA_BONUS: Record<string, number> = {
  escritura:         30, reserva:          28,
  negociacion:       20, oferta_enviada:   18,
  visita_realizada:  15, visita_coordinada: 10,
  contactado:         5, prospecto:         0,
  cerrado:           -5, perdido:          -20,
};

const ESTADO_BONUS: Record<string, number> = {
  activo: 10, pausado: -10, inactivo: -20,
};

function calcularScore(c: Contacto, ultimaInt: UltimaInteraccion | null, negocio: NegocioResumen | null): number {
  let score = 50;

  // Recencia
  if (ultimaInt) {
    const dias = Math.floor((Date.now() - new Date(ultimaInt.created_at).getTime()) / 86400000);
    if (dias < 3)       score += 20;
    else if (dias < 7)  score += 10;
    else if (dias < 14) score += 0;
    else if (dias < 30) score -= 10;
    else                score -= 20;
  } else {
    score -= 30;
  }

  // Negocio
  if (negocio) {
    score += ETAPA_BONUS[negocio.etapa] ?? 0;
    const val = negocio.valor_operacion ?? 0;
    if (val > 200_000)  score += 15;
    else if (val > 100_000) score += 10;
    else if (val > 50_000)  score += 5;
  }

  // Estado contacto
  score += ESTADO_BONUS[c.estado ?? ""] ?? 0;

  // Tipo activo
  if ((c.tipo ?? "").includes("activo")) score += 10;

  // Presupuesto alto
  const pmax = c.presupuesto_max ?? 0;
  if (pmax > 200_000) score += 10;
  else if (pmax > 100_000) score += 5;

  return Math.max(0, Math.min(100, score));
}

function accionSugerida(diasSinContacto: number | null, negocio: NegocioResumen | null): [string, string] {
  if (negocio) {
    if (negocio.etapa === "escritura") return ["Confirmar pasos de escritura", "⚖️"];
    if (negocio.etapa === "reserva")   return ["Preparar boleto de compraventa", "📋"];
    if (negocio.etapa === "negociacion") return ["Hacer seguimiento de oferta", "🤝"];
    if (negocio.etapa === "oferta_enviada") return ["Confirmar recepción de oferta", "📩"];
    if (negocio.etapa === "visita_realizada") return ["Enviar comparables y propuesta", "📊"];
    if (negocio.etapa === "visita_coordinada") return ["Confirmar visita programada", "🗓️"];
    if (negocio.etapa === "contactado") return ["Coordinar visita", "🏠"];
  }
  if (diasSinContacto === null || diasSinContacto > 30) return ["Retomar contacto", "📞"];
  if (diasSinContacto > 14) return ["Chequear interés actual", "💬"];
  if (diasSinContacto > 7)  return ["Enviar novedades de mercado", "📰"];
  return ["Registrar interacción reciente", "✏️"];
}

const TEMP_COLOR = {
  caliente: "#b80000",
  tibio:    "#d4960c",
  frio:     "#4ab8d8",
};
const TEMP_BG = {
  caliente: "rgba(239,68,68,0.1)",
  tibio:    "rgba(245,158,11,0.1)",
  frio:     "rgba(74,184,216,0.1)",
};
const TEMP_LABEL = {
  caliente: "🔥 Caliente",
  tibio:    "🟡 Tibio",
  frio:     "❄️ Frío",
};

const fmtDias = (d: number | null) => {
  if (d === null) return "Sin contacto";
  if (d === 0) return "Hoy";
  if (d === 1) return "Ayer";
  return `Hace ${d} días`;
};

const fmtMonto = (v: number | null, m: string | null) => {
  if (!v || !m) return null;
  return m === "USD" ? `USD ${v.toLocaleString("es-AR")}` : `$ ${v.toLocaleString("es-AR")}`;
};

const ETAPA_LABEL: Record<string, string> = {
  prospecto: "Prospecto", contactado: "Contactado",
  visita_coordinada: "Visita coord.", visita_realizada: "Visita realiz.",
  oferta_enviada: "Oferta enviada", negociacion: "Negociación",
  reserva: "Reserva", escritura: "Escritura",
  cerrado: "Cerrado", perdido: "Perdido",
};
const ETAPA_COLOR: Record<string, string> = {
  escritura: "#3abab6", reserva: "#06b6d4", negociacion: "#d4960c",
  oferta_enviada: "#d4960c", visita_realizada: "#a78bfa", visita_coordinada: "#8b5cf6",
  contactado: "#3b82f6", prospecto: "#6b7280", cerrado: "#3abab6", perdido: "#b80000",
};

// ── componente ────────────────────────────────────────────────────────────────
export default function SeguimientoPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [interacciones, setInteracciones] = useState<UltimaInteraccion[]>([]);
  const [negocios, setNegocios] = useState<NegocioResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTemp, setFiltroTemp] = useState<"todos" | "caliente" | "tibio" | "frio">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [vistaDetalle, setVistaDetalle] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  const cargar = async (id: string) => {
    setLoading(true);
    const [{ data: cts }, { data: ints }, { data: negs }] = await Promise.all([
      supabase.from("crm_contactos")
        .select("id,nombre,apellido,telefono,email,tipo,estado,presupuesto_min,presupuesto_max,moneda,zona_interes,updated_at")
        .eq("perfil_id", id)
        .neq("estado", "inactivo")
        .order("updated_at", { ascending: false }),
      supabase.from("crm_interacciones")
        .select("contacto_id,tipo,created_at")
        .eq("perfil_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("crm_negocios")
        .select("contacto_id,etapa,valor_operacion,moneda")
        .eq("perfil_id", id)
        .eq("archivado", false)
        .not("contacto_id", "is", null)
        .not("etapa", "in", '("cerrado","perdido")'),
    ]);
    setContactos((cts ?? []) as Contacto[]);
    setInteracciones((ints ?? []) as UltimaInteraccion[]);
    setNegocios((negs ?? []) as NegocioResumen[]);
    setLoading(false);
  };

  // ── última interacción por contacto ────────────────────────────────────────
  const ultimaIntPorContacto = useMemo(() => {
    const map = new Map<string, UltimaInteraccion>();
    interacciones.forEach(i => {
      if (!map.has(i.contacto_id)) map.set(i.contacto_id, i);
    });
    return map;
  }, [interacciones]);

  // ── negocio activo más avanzado por contacto ────────────────────────────────
  const negPorContacto = useMemo(() => {
    const prioridad = ["escritura","reserva","negociacion","oferta_enviada","visita_realizada","visita_coordinada","contactado","prospecto"];
    const map = new Map<string, NegocioResumen>();
    negocios.forEach(n => {
      if (!n.contacto_id) return;
      const existing = map.get(n.contacto_id);
      if (!existing || prioridad.indexOf(n.etapa) < prioridad.indexOf(existing.etapa)) {
        map.set(n.contacto_id, n);
      }
    });
    return map;
  }, [negocios]);

  // ── calcular scoring ────────────────────────────────────────────────────────
  const scorados = useMemo((): ContactoScorado[] => {
    return contactos.map(c => {
      const ultimaInt = ultimaIntPorContacto.get(c.id) ?? null;
      const negocio   = negPorContacto.get(c.id) ?? null;
      const score     = calcularScore(c, ultimaInt, negocio);
      const temperatura: "caliente" | "tibio" | "frio" =
        score >= 68 ? "caliente" : score >= 42 ? "tibio" : "frio";
      const diasSinContacto = ultimaInt
        ? Math.floor((Date.now() - new Date(ultimaInt.created_at).getTime()) / 86400000)
        : null;
      const [accion, icono] = accionSugerida(diasSinContacto, negocio);
      return { contacto: c, score, temperatura, diasSinContacto, ultimaInteraccion: ultimaInt, negocio, accionSugerida: accion, iconoAccion: icono };
    }).sort((a, b) => b.score - a.score);
  }, [contactos, ultimaIntPorContacto, negPorContacto]);

  // ── filtros ────────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    return scorados.filter(s => {
      if (filtroTemp !== "todos" && s.temperatura !== filtroTemp) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const nombre = `${s.contacto.nombre} ${s.contacto.apellido}`.toLowerCase();
        if (!nombre.includes(q) && !(s.contacto.zona_interes ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [scorados, filtroTemp, busqueda]);

  // ── resumen ────────────────────────────────────────────────────────────────
  const resumen = useMemo(() => ({
    calientes: scorados.filter(s => s.temperatura === "caliente").length,
    tibios:    scorados.filter(s => s.temperatura === "tibio").length,
    frios:     scorados.filter(s => s.temperatura === "frio").length,
    sinContacto: scorados.filter(s => s.diasSinContacto === null || s.diasSinContacto > 30).length,
  }), [scorados]);

  // ── acción rápida ─────────────────────────────────────────────────────────
  const registrarInteraccion = async (contactoId: string, tipo: string) => {
    if (!uid) return;
    await supabase.from("crm_interacciones").insert({
      contacto_id: contactoId,
      perfil_id: uid,
      tipo,
      descripcion: `Contacto por ${tipo}`,
      created_at: new Date().toISOString(),
    });
    cargar(uid);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .seg-card { background:var(--gfi-bg-card); border:1px solid var(--gfi-border-subtle); border-radius:8px; padding:16px; transition:border-color 0.15s; }
        .seg-card:hover { border-color:rgba(255,255,255,0.13); }
        .seg-input { width:100%; padding:9px 12px; background:var(--gfi-border-subtle); border:1px solid var(--gfi-border); border-radius:5px; color:#fff; font-size:13px; font-family:var(--font-body); outline:none; box-sizing:border-box; }
        .seg-input:focus { border-color:rgba(153,0,0,0.4); }
        .seg-btn { padding:7px 13px; border:none; border-radius:5px; font-family:var(--font-display); font-size:10px; font-weight:700; letter-spacing:0.08em; cursor:pointer; transition:opacity 0.15s; white-space:nowrap; }
        .seg-chip { padding:5px 12px; border-radius:20px; font-family:var(--font-display); font-size:10px; font-weight:700; letter-spacing:0.08em; cursor:pointer; border:1px solid transparent; transition:all 0.15s; }
        .seg-score-bar { height:5px; border-radius:3px; transition:width 0.4s; }
        @media(max-width:640px){.seg-grid-3{grid-template-columns:1fr 1fr!important;}}
      `}</style>

      <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "#fff" }}>
              Seguimiento <span style={{ color: "#990000" }}>de Leads</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 3 }}>
              Prioridad automática por score · {scorados.length} contactos activos
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/crm/contactos" style={{ padding: "8px 14px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid var(--gfi-border)", color: "var(--gfi-text-secondary)", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em", textDecoration: "none" }}>
              Ver todos ↗
            </Link>
          </div>
        </div>

        {/* ── KPIs temperatura ── */}
        <div className="seg-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {[
            { n: resumen.calientes,    l: "🔥 Calientes",    c: "#b80000", bg: "rgba(239,68,68,0.08)",    t: "caliente" },
            { n: resumen.tibios,       l: "🟡 Tibios",       c: "#d4960c", bg: "rgba(245,158,11,0.08)",   t: "tibio" },
            { n: resumen.frios,        l: "❄️ Fríos",        c: "#4ab8d8", bg: "rgba(74,184,216,0.08)",   t: "frio" },
            { n: resumen.sinContacto,  l: "⚠️ Sin contacto", c: "#6b7280", bg: "rgba(107,114,128,0.08)", t: "" },
          ].map(k => (
            <div key={k.l}
              onClick={() => k.t ? setFiltroTemp(filtroTemp === k.t ? "todos" : k.t as typeof filtroTemp) : undefined}
              style={{ background: filtroTemp === k.t ? k.bg : "var(--gfi-bg-card)", border: `1px solid ${filtroTemp === k.t ? k.c + "40" : "var(--gfi-border-subtle)"}`, borderRadius: 8, padding: "12px 14px", textAlign: "center", cursor: k.t ? "pointer" : "default", transition: "all 0.15s" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: k.c }}>{k.n}</div>
              <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="seg-input" style={{ flex: 1, minWidth: 180 }} placeholder="Buscar contacto o zona..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          {(["todos","caliente","tibio","frio"] as const).map(t => (
            <button key={t} className="seg-chip"
              style={{
                background: filtroTemp === t ? (t === "todos" ? "rgba(153,0,0,0.12)" : TEMP_BG[t as keyof typeof TEMP_BG]) : "var(--gfi-border-subtle)",
                color: filtroTemp === t ? (t === "todos" ? "#990000" : TEMP_COLOR[t as keyof typeof TEMP_COLOR]) : "var(--gfi-text-muted)",
                border: `1px solid ${filtroTemp === t ? (t === "todos" ? "rgba(153,0,0,0.35)" : TEMP_COLOR[t as keyof typeof TEMP_COLOR] + "50") : "var(--gfi-border)"}`,
              }}
              onClick={() => setFiltroTemp(t)}>
              {t === "todos" ? "Todos" : TEMP_LABEL[t]}
            </button>
          ))}
        </div>

        {/* ── Lista ── */}
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--gfi-text-muted)", padding: 48, fontFamily: "Inter,sans-serif" }}>Calculando scores...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--gfi-text-dim)", fontFamily: "var(--font-display)" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
            <div style={{ fontWeight: 700 }}>No hay contactos en esta categoría</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtrados.map((s, idx) => {
              const c = s.contacto;
              const isOpen = vistaDetalle === c.id;
              return (
                <div key={c.id} className="seg-card">
                  {/* Fila principal */}
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {/* Ranking */}
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 800, color: "var(--gfi-text-dim)", minWidth: 24, textAlign: "center", paddingTop: 2 }}>
                      #{idx + 1}
                    </div>

                    {/* Avatar */}
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: TEMP_BG[s.temperatura], border: `2px solid ${TEMP_COLOR[s.temperatura]}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800, color: TEMP_COLOR[s.temperatura] }}>
                        {(c.nombre[0] ?? "?") + (c.apellido[0] ?? "")}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Link href={`/crm/contactos/${c.id}`} style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "#fff", textDecoration: "none" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#990000"}
                          onMouseLeave={e => e.currentTarget.style.color = "#fff"}>
                          {c.nombre} {c.apellido}
                        </Link>
                        {/* Temperatura */}
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 700, background: TEMP_BG[s.temperatura], color: TEMP_COLOR[s.temperatura], border: `1px solid ${TEMP_COLOR[s.temperatura]}40` }}>
                          {TEMP_LABEL[s.temperatura]}
                        </span>
                        {/* Negocio etapa */}
                        {s.negocio && (
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 700, background: `${ETAPA_COLOR[s.negocio.etapa]}18`, color: ETAPA_COLOR[s.negocio.etapa], border: `1px solid ${ETAPA_COLOR[s.negocio.etapa]}40` }}>
                            {ETAPA_LABEL[s.negocio.etapa] ?? s.negocio.etapa}
                          </span>
                        )}
                      </div>

                      {/* Barra de score */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                          <div className="seg-score-bar" style={{ width: `${s.score}%`, background: s.temperatura === "caliente" ? "#b80000" : s.temperatura === "tibio" ? "#d4960c" : "#4ab8d8" }} />
                        </div>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 800, color: TEMP_COLOR[s.temperatura], minWidth: 28 }}>{s.score}</span>
                      </div>

                      {/* Metainfo */}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: s.diasSinContacto !== null && s.diasSinContacto > 14 ? "#d4960c" : "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>
                          🕐 {fmtDias(s.diasSinContacto)}
                        </span>
                        {c.zona_interes && (
                          <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>📍 {c.zona_interes}</span>
                        )}
                        {fmtMonto(c.presupuesto_max, c.moneda) && (
                          <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>💰 hasta {fmtMonto(c.presupuesto_max, c.moneda)}</span>
                        )}
                        {s.negocio?.valor_operacion && (
                          <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>🤝 {fmtMonto(s.negocio.valor_operacion, s.negocio.moneda)}</span>
                        )}
                      </div>

                      {/* Acción sugerida */}
                      <div style={{ marginTop: 8, padding: "5px 10px", background: "var(--gfi-bg-card)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13 }}>{s.iconoAccion}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "Inter,sans-serif" }}>Sugerido: <strong style={{ color: "rgba(255,255,255,0.75)" }}>{s.accionSugerida}</strong></span>
                      </div>
                    </div>

                    {/* Acciones rápidas */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexDirection: "column", alignItems: "flex-end" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        {c.telefono && (
                          <a href={`https://wa.me/${c.telefono.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                            onClick={() => registrarInteraccion(c.id, "whatsapp")}
                            title="WhatsApp"
                            style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, textDecoration: "none", cursor: "pointer" }}>
                            💬
                          </a>
                        )}
                        {c.telefono && (
                          <a href={`tel:${c.telefono}`}
                            onClick={() => registrarInteraccion(c.id, "llamada")}
                            title="Llamar"
                            style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(74,184,216,0.1)", border: "1px solid rgba(74,184,216,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, textDecoration: "none", cursor: "pointer" }}>
                            📞
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`}
                            onClick={() => registrarInteraccion(c.id, "email")}
                            title="Email"
                            style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, textDecoration: "none", cursor: "pointer" }}>
                            ✉️
                          </a>
                        )}
                      </div>
                      <button className="seg-btn"
                        style={{ background: "var(--gfi-border-subtle)", color: "var(--gfi-text-muted)", border: "1px solid var(--gfi-border)", fontSize: 10 }}
                        onClick={() => setVistaDetalle(isOpen ? null : c.id)}>
                        {isOpen ? "▲ Cerrar" : "▼ Detalle"}
                      </button>
                    </div>
                  </div>

                  {/* ── Detalle expandido ── */}
                  {isOpen && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>Score breakdown</div>
                          {[
                            { label: "Recencia", val: s.diasSinContacto === null ? "Sin interacción" : fmtDias(s.diasSinContacto) },
                            { label: "Etapa negocio", val: s.negocio ? ETAPA_LABEL[s.negocio.etapa] : "Sin negocio activo" },
                            { label: "Estado contacto", val: c.estado ?? "—" },
                            { label: "Presupuesto máx.", val: fmtMonto(c.presupuesto_max, c.moneda) ?? "—" },
                          ].map(row => (
                            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--gfi-border-subtle)" }}>
                              <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>{row.label}</span>
                              <span style={{ fontSize: 11, color: "var(--gfi-text-primary)", fontFamily: "Inter,sans-serif", fontWeight: 600 }}>{row.val}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>Acciones</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <Link href={`/crm/contactos/${c.id}`}
                              style={{ padding: "8px 12px", background: "rgba(153,0,0,0.1)", border: "1px solid rgba(153,0,0,0.25)", borderRadius: 5, color: "#990000", fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                              Abrir ficha completa ↗
                            </Link>
                            {s.negocio && (
                              <Link href="/crm/negocios"
                                style={{ padding: "8px 12px", background: `${ETAPA_COLOR[s.negocio.etapa]}12`, border: `1px solid ${ETAPA_COLOR[s.negocio.etapa]}30`, borderRadius: 5, color: ETAPA_COLOR[s.negocio.etapa], fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                                Ver negocio → {ETAPA_LABEL[s.negocio.etapa]}
                              </Link>
                            )}
                            <button className="seg-btn"
                              style={{ background: "rgba(34,197,94,0.08)", color: "#3abab6", border: "1px solid rgba(34,197,94,0.2)", width: "100%" }}
                              onClick={() => { registrarInteraccion(c.id, "nota"); setVistaDetalle(null); }}>
                              ✓ Registrar contacto hoy
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Leyenda de score ── */}
        <div style={{ padding: "12px 16px", background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 6 }}>
          <div style={{ fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-dim)", marginBottom: 8 }}>Cómo se calcula el score</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              "🔥 ≥68 pts: Caliente — requiere contacto inmediato",
              "🟡 42–67 pts: Tibio — seguimiento esta semana",
              "❄️ <42 pts: Frío — recuperar o pausar",
            ].map(t => (
              <span key={t} style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
