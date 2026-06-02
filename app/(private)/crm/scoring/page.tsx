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
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: string | null;
  zona_interes: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

interface Interaccion {
  contacto_id: string;
  tipo: string;
  created_at: string;
}

interface Negocio {
  contacto_id: string | null;
  etapa: string;
  valor_operacion?: number | null;
}

interface Tarea {
  contacto_id: string | null;
  estado: string;
  fecha_vencimiento: string | null;
}

interface ContactoScore {
  contacto: Contacto;
  score: number;
  desglose: { label: string; pts: number; max: number }[];
  categoria: "caliente" | "tibio" | "frio";
  interacciones: number;
  ultimaInteraccion: string | null;
  tieneNegocio: boolean;
  etapaNegocio: string | null;
}

const ETAPA_PTS: Record<string, number> = {
  cerrado: 25,
  escritura: 22,
  reserva: 20,
  negociacion: 17,
  propuesta: 14,
  visita: 11,
  calificado: 8,
  nuevo: 4,
};

function calcScore(
  c: Contacto,
  ints: Interaccion[],
  negocios: Negocio[],
  tareas: Tarea[]
): ContactoScore {
  const hoy = new Date();
  const cInts = ints.filter(i => i.contacto_id === c.id);
  const cNegs = negocios.filter(n => n.contacto_id === c.id);
  const cTareas = tareas.filter(t => t.contacto_id === c.id);

  // 1. Interacciones recientes (max 20 pts)
  const intRecientes = cInts.filter(i => {
    const d = new Date(i.created_at);
    return (hoy.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 30;
  }).length;
  const ptsInt = Math.min(20, intRecientes * 5);

  // 2. Total de interacciones (max 15 pts)
  const ptsTotalInt = Math.min(15, cInts.length * 2);

  // 3. Etapa del negocio más avanzado (max 25 pts)
  const mejorEtapa = cNegs.reduce((best: string | null, n) => {
    const pts = ETAPA_PTS[n.etapa] ?? 0;
    const bestPts = ETAPA_PTS[best ?? ""] ?? 0;
    return pts > bestPts ? n.etapa : best;
  }, null);
  const ptsEtapa = mejorEtapa ? (ETAPA_PTS[mejorEtapa] ?? 0) : 0;

  // 4. Completitud del perfil (max 15 pts)
  let ptsPerfil = 0;
  if (c.telefono) ptsPerfil += 4;
  if (c.email) ptsPerfil += 3;
  if (c.presupuesto_min || c.presupuesto_max) ptsPerfil += 4;
  if (c.zona_interes) ptsPerfil += 2;
  if (c.notas && c.notas.length > 10) ptsPerfil += 2;

  // 5. Recencia del contacto (max 15 pts) — más viejo = menos
  const diasDesdeContacto = (hoy.getTime() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  const ptsRecencia = diasDesdeContacto <= 7 ? 15 : diasDesdeContacto <= 14 ? 12 : diasDesdeContacto <= 30 ? 8 : diasDesdeContacto <= 60 ? 4 : 0;

  // 6. Presupuesto declarado (max 5 pts)
  const ptsBudget = (c.presupuesto_min || c.presupuesto_max) ? 5 : 0;

  // 7. Tareas pendientes sobre este contacto (max 5 pts — muestran actividad activa)
  const tienesTareasPend = cTareas.filter(t => t.estado === "pendiente").length > 0;
  const ptsTareas = tienesTareasPend ? 5 : 0;

  const score = Math.min(100, ptsInt + ptsTotalInt + ptsEtapa + ptsPerfil + ptsRecencia + ptsBudget + ptsTareas);

  const ultimaInteraccion = cInts.length > 0
    ? cInts.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at
    : null;

  const categoria: "caliente" | "tibio" | "frio" = score >= 60 ? "caliente" : score >= 30 ? "tibio" : "frio";

  return {
    contacto: c,
    score,
    desglose: [
      { label: "Interacciones últimos 30d", pts: ptsInt, max: 20 },
      { label: "Total de interacciones", pts: ptsTotalInt, max: 15 },
      { label: "Etapa de negocio", pts: ptsEtapa, max: 25 },
      { label: "Perfil completo", pts: ptsPerfil, max: 15 },
      { label: "Recencia de contacto", pts: ptsRecencia, max: 15 },
      { label: "Presupuesto declarado", pts: ptsBudget, max: 5 },
      { label: "Tareas activas", pts: ptsTareas, max: 5 },
    ],
    categoria,
    interacciones: cInts.length,
    ultimaInteraccion,
    tieneNegocio: cNegs.length > 0,
    etapaNegocio: mejorEtapa,
  };
}

function diasDesde(fecha: string): string {
  const d = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  if (d === 0) return "Hoy";
  if (d === 1) return "Ayer";
  return `Hace ${d}d`;
}

export default function ScoringPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "caliente" | "tibio" | "frio">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<ContactoScore | null>(null);
  const [iaAnalisis, setIaAnalisis] = useState<Record<string, { temperatura: string; prioridad: string; resumen: string; proximo_paso: string; estrategia: string; riesgo: string; oportunidad: string }>>({});
  const [iaLoading, setIaLoading] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const uid = data.user.id;
      Promise.all([
        supabase.from("crm_contactos").select("id,nombre,apellido,telefono,email,tipo,estado,presupuesto_min,presupuesto_max,moneda,zona_interes,notas,created_at,updated_at").eq("perfil_id", uid),
        supabase.from("crm_interacciones").select("contacto_id,tipo,created_at").eq("perfil_id", uid),
        supabase.from("crm_negocios").select("contacto_id,etapa").eq("perfil_id", uid),
        supabase.from("crm_tareas").select("contacto_id,estado,fecha_vencimiento").eq("perfil_id", uid),
      ]).then(([{ data: c }, { data: i }, { data: n }, { data: t }]) => {
        setContactos((c ?? []) as Contacto[]);
        setInteracciones((i ?? []) as Interaccion[]);
        setNegocios((n ?? []) as Negocio[]);
        setTareas((t ?? []) as Tarea[]);
        setLoading(false);
      });
    });
  }, []);

  const scores = useMemo<ContactoScore[]>(() => {
    return contactos
      .map(c => calcScore(c, interacciones, negocios, tareas))
      .sort((a, b) => b.score - a.score);
  }, [contactos, interacciones, negocios, tareas]);

  const filtrados = useMemo(() => {
    return scores.filter(s => {
      if (filtro !== "todos" && s.categoria !== filtro) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const nom = `${s.contacto.nombre} ${s.contacto.apellido}`.toLowerCase();
        if (!nom.includes(q) && !(s.contacto.telefono ?? "").includes(q)) return false;
      }
      return true;
    });
  }, [scores, filtro, busqueda]);

  const totalCaliente = scores.filter(s => s.categoria === "caliente").length;
  const totalTibio = scores.filter(s => s.categoria === "tibio").length;
  const totalFrio = scores.filter(s => s.categoria === "frio").length;
  const promScore = scores.length > 0 ? scores.reduce((s, x) => s + x.score, 0) / scores.length : 0;

  const catColor = (cat: string) => cat === "caliente" ? "#cc0000" : cat === "tibio" ? "#f97316" : "#3b82f6";
  const catIcon = (cat: string) => cat === "caliente" ? "🔥" : cat === "tibio" ? "⚡" : "❄️";

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>🎯 Scoring de Contactos</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Ranking automático por interacciones, etapa y completitud de perfil</p>
          </div>
          <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Score promedio", value: promScore.toFixed(0), color: "#e5e5e5", sub: `de ${scores.length} contactos` },
            { label: "🔥 Calientes", value: totalCaliente, color: "#cc0000", sub: "score ≥ 60" },
            { label: "⚡ Tibios", value: totalTibio, color: "#f97316", sub: "score 30–59" },
            { label: "❄️ Fríos", value: totalFrio, color: "#3b82f6", sub: "score < 30" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "#4b5563" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text" placeholder="Buscar contacto..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 12px", fontSize: 13, flex: 1, minWidth: 200 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {(["todos", "caliente", "tibio", "frio"] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                style={{ background: filtro === f ? "#1f2937" : "transparent", border: `1px solid ${filtro === f ? "#374151" : "#1f2937"}`, borderRadius: 6, color: filtro === f ? "#e5e5e5" : "#6b7280", padding: "5px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "capitalize" }}>
                {f === "todos" ? "Todos" : catIcon(f) + " " + f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: seleccionado ? "1fr 360px" : "1fr", gap: 16 }}>
          {/* Lista */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loading ? (
              <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Cargando contactos...</div>
            ) : filtrados.length === 0 ? (
              <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Sin resultados</div>
            ) : filtrados.map((s, idx) => (
              <div key={s.contacto.id}
                onClick={() => setSeleccionado(seleccionado?.contacto.id === s.contacto.id ? null : s)}
                style={{ background: seleccionado?.contacto.id === s.contacto.id ? "#1a1a1a" : "#111", border: `1px solid ${seleccionado?.contacto.id === s.contacto.id ? catColor(s.categoria) + "66" : "#1f2937"}`, borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#4b5563", width: 32, textAlign: "center" }}>#{idx + 1}</div>
                <div style={{ background: `${catColor(s.categoria)}22`, color: catColor(s.categoria), borderRadius: 8, padding: "6px 10px", fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, minWidth: 60, textAlign: "center" }}>
                  {s.score}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>{s.contacto.nombre} {s.contacto.apellido}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {catIcon(s.categoria)} {s.categoria.charAt(0).toUpperCase() + s.categoria.slice(1)}
                    {s.tieneNegocio && s.etapaNegocio && <span style={{ marginLeft: 8, color: "#9ca3af" }}>· Negocio: {s.etapaNegocio}</span>}
                    <span style={{ marginLeft: 8 }}>· {s.interacciones} interacciones</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 180 }}>
                  <div style={{ background: "#0a0a0a", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${s.score}%`, height: "100%", background: catColor(s.categoria), transition: "width 0.4s" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#4b5563" }}>
                    {s.ultimaInteraccion ? diasDesde(s.ultimaInteraccion) : "Sin interacciones"}
                  </div>
                </div>
                {s.contacto.telefono && (
                  <a href={`https://wa.me/${s.contacto.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ background: "#25d36622", color: "#25d366", border: "1px solid #25d36644", borderRadius: 6, padding: "5px 10px", fontSize: 12, textDecoration: "none" }}>
                    WA
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Detalle scoring */}
          {seleccionado && (
            <div style={{ background: "#111", border: `1px solid ${catColor(seleccionado.categoria)}44`, borderRadius: 12, padding: 20, position: "sticky", top: 20, alignSelf: "flex-start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#fff" }}>
                    {seleccionado.contacto.nombre} {seleccionado.contacto.apellido}
                  </div>
                  <div style={{ fontSize: 12, color: catColor(seleccionado.categoria), marginTop: 2 }}>
                    {catIcon(seleccionado.categoria)} {seleccionado.categoria.charAt(0).toUpperCase() + seleccionado.categoria.slice(1)}
                  </div>
                </div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 40, color: catColor(seleccionado.categoria) }}>
                  {seleccionado.score}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Desglose de puntos</div>
                {seleccionado.desglose.map(d => (
                  <div key={d.label} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: "#9ca3af" }}>{d.label}</span>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: d.pts > 0 ? "#22c55e" : "#4b5563" }}>
                        {d.pts}/{d.max}
                      </span>
                    </div>
                    <div style={{ background: "#0a0a0a", borderRadius: 3, height: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(d.pts / d.max) * 100}%`, height: "100%", background: d.pts / d.max >= 0.7 ? "#22c55e" : d.pts / d.max >= 0.4 ? "#f97316" : "#cc0000" }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid #1f2937", paddingTop: 14 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Datos del contacto</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
                  {seleccionado.contacto.telefono && <div style={{ color: "#9ca3af" }}>📞 {seleccionado.contacto.telefono}</div>}
                  {seleccionado.contacto.email && <div style={{ color: "#9ca3af" }}>✉️ {seleccionado.contacto.email}</div>}
                  {seleccionado.contacto.zona_interes && <div style={{ color: "#9ca3af" }}>📍 {seleccionado.contacto.zona_interes}</div>}
                  {(seleccionado.contacto.presupuesto_min || seleccionado.contacto.presupuesto_max) && (
                    <div style={{ color: "#9ca3af" }}>💰 {seleccionado.contacto.moneda} {seleccionado.contacto.presupuesto_min?.toLocaleString("es-AR") ?? "?"} – {seleccionado.contacto.presupuesto_max?.toLocaleString("es-AR") ?? "?"}</div>
                  )}
                  {seleccionado.ultimaInteraccion && <div style={{ color: "#9ca3af" }}>🕐 Última: {diasDesde(seleccionado.ultimaInteraccion)}</div>}
                </div>
              </div>

              {/* Análisis IA */}
              {iaAnalisis[seleccionado.contacto.id] ? (
                <div style={{ marginTop: 14, padding: 14, background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(139,92,246,0.25)" }}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, color: "#8b5cf6", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                    🤖 Análisis IA
                  </div>
                  <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6, marginBottom: 8 }}>
                    {iaAnalisis[seleccionado.contacto.id].resumen}
                  </div>
                  <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, marginBottom: 4, fontFamily: "Montserrat,sans-serif", textTransform: "uppercase" }}>Próximo paso</div>
                    <div style={{ fontSize: 12, color: "#d1d5db" }}>{iaAnalisis[seleccionado.contacto.id].proximo_paso}</div>
                  </div>
                  {iaAnalisis[seleccionado.contacto.id].riesgo && (
                    <div style={{ fontSize: 11, color: "#f87171", marginBottom: 4 }}>⚠️ {iaAnalisis[seleccionado.contacto.id].riesgo}</div>
                  )}
                  {iaAnalisis[seleccionado.contacto.id].oportunidad && (
                    <div style={{ fontSize: 11, color: "#34d399" }}>✨ {iaAnalisis[seleccionado.contacto.id].oportunidad}</div>
                  )}
                </div>
              ) : (
                <button
                  disabled={iaLoading === seleccionado.contacto.id}
                  onClick={async () => {
                    setIaLoading(seleccionado.contacto.id);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch("/api/crm/scoring-ia", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token ?? ""}` },
                        body: JSON.stringify({ contacto_id: seleccionado.contacto.id }),
                      });
                      const data = await res.json();
                      if (data.analisis) setIaAnalisis(prev => ({ ...prev, [seleccionado.contacto.id]: data.analisis }));
                    } finally {
                      setIaLoading(null);
                    }
                  }}
                  style={{ width: "100%", marginTop: 12, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 6, color: "#8b5cf6", padding: "10px", fontSize: 12, fontWeight: 700, cursor: iaLoading === seleccionado.contacto.id ? "not-allowed" : "pointer", fontFamily: "Montserrat,sans-serif", opacity: iaLoading === seleccionado.contacto.id ? 0.7 : 1 }}>
                  {iaLoading === seleccionado.contacto.id ? "Analizando con IA..." : "🤖 Analizar con IA"}
                </button>
              )}

              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <Link href={`/crm/contactos?id=${seleccionado.contacto.id}`}
                  style={{ flex: 1, background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#e5e5e5", padding: "8px", fontSize: 12, textDecoration: "none", textAlign: "center" }}>
                  Ver perfil
                </Link>
                {seleccionado.contacto.telefono && (
                  <a href={`https://wa.me/${seleccionado.contacto.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                    style={{ flex: 1, background: "#25d36622", border: "1px solid #25d36644", borderRadius: 6, color: "#25d366", padding: "8px", fontSize: 12, textDecoration: "none", textAlign: "center" }}>
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
