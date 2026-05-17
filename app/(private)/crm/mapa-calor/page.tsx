"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Contacto {
  id: string;
  zona_interes: string | null;
  presupuesto_max: number | null;
  moneda: string | null;
  estado: string | null;
  updated_at: string;
}

interface Propiedad {
  id: string;
  zona: string | null;
  precio: number | null;
  moneda: string | null;
  operacion: string | null;
  estado: string | null;
}

interface Interaccion {
  id: string;
  contacto_id: string;
  created_at: string;
}

interface ZonaData {
  zona: string;
  contactos: number;
  propiedades: number;
  interacciones: number;
  presupuestoPromedio: number;
  actividadReciente: number; // interacciones últimos 30d
  score: number;
  demandaOferta: number; // ratio contactos/propiedades
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string) {
  return s.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function heat(score: number, max: number): string {
  if (max === 0) return "rgba(255,255,255,0.05)";
  const t = Math.min(score / max, 1);
  if (t < 0.25) return `rgba(59,130,246,${0.15 + t * 0.4})`;
  if (t < 0.5)  return `rgba(234,179,8,${0.2 + t * 0.4})`;
  if (t < 0.75) return `rgba(249,115,22,${0.25 + t * 0.4})`;
  return `rgba(204,0,0,${0.3 + t * 0.5})`;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function MapaCalor() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState<"score"|"contactos"|"propiedades"|"demanda">("score");
  const [filtroOp, setFiltroOp] = useState<"todas"|"venta"|"alquiler">("todas");
  const [seleccionada, setSeleccionada] = useState<ZonaData | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const uid = user.id;

      const hace180 = new Date(Date.now() - 180 * 86400000).toISOString();

      const [{ data: c }, { data: p }, { data: i }] = await Promise.all([
        supabase.from("crm_contactos").select("id,zona_interes,presupuesto_max,moneda,estado,updated_at").eq("perfil_id", uid),
        supabase.from("crm_cartera").select("id,zona,precio,moneda,operacion,estado").eq("perfil_id", uid),
        supabase.from("crm_interacciones").select("id,contacto_id,created_at").eq("perfil_id", uid).gte("created_at", hace180),
      ]);

      setContactos((c ?? []) as Contacto[]);
      setPropiedades((p ?? []) as Propiedad[]);
      setInteracciones((i ?? []) as Interaccion[]);
      setLoading(false);
    }
    load();
  }, []);

  const zonas = useMemo((): ZonaData[] => {
    const hace30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const map = new Map<string, ZonaData>();

    const ensure = (z: string) => {
      const key = norm(z);
      if (!map.has(key)) {
        map.set(key, { zona: z, contactos: 0, propiedades: 0, interacciones: 0, presupuestoPromedio: 0, actividadReciente: 0, score: 0, demandaOferta: 0 });
      }
      return map.get(key)!;
    };

    const presupuestosSuma = new Map<string, number[]>();

    contactos.forEach(c => {
      if (!c.zona_interes) return;
      const z = ensure(c.zona_interes);
      z.contactos++;
      if (c.presupuesto_max) {
        const key = norm(c.zona_interes);
        const arr = presupuestosSuma.get(key) ?? [];
        arr.push(c.presupuesto_max);
        presupuestosSuma.set(key, arr);
      }
    });

    propiedades.forEach(p => {
      if (!p.zona) return;
      const key = norm(p.zona);
      // match against existing zones or create
      let matched = false;
      for (const [k, z] of map.entries()) {
        if (k === key || key.includes(k) || k.includes(key)) {
          z.propiedades++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const z = ensure(p.zona);
        z.propiedades++;
      }
    });

    // build contacto→zona map for interacciones
    const contactoZona = new Map<string, string>();
    contactos.forEach(c => {
      if (c.zona_interes) contactoZona.set(c.id, norm(c.zona_interes));
    });

    interacciones.forEach(i => {
      const zonaNorm = contactoZona.get(i.contacto_id);
      if (!zonaNorm) return;
      for (const [k, z] of map.entries()) {
        if (k === zonaNorm) {
          z.interacciones++;
          if (i.created_at >= hace30) z.actividadReciente++;
          break;
        }
      }
    });

    // presupuesto promedio y scores
    for (const [key, z] of map.entries()) {
      const pArr = presupuestosSuma.get(key) ?? [];
      z.presupuestoPromedio = pArr.length ? pArr.reduce((a, b) => a + b, 0) / pArr.length : 0;
      z.demandaOferta = z.propiedades > 0 ? z.contactos / z.propiedades : z.contactos;
      // score ponderado: contactos 30%, interacciones 25%, actividad reciente 30%, demanda/oferta 15%
      z.score = z.contactos * 0.3 + z.interacciones * 0.25 + z.actividadReciente * 0.3 * 3 + z.demandaOferta * 0.15 * 5;
    }

    let arr = Array.from(map.values()).filter(z => z.contactos > 0 || z.propiedades > 0);

    // filtro operacion
    if (filtroOp !== "todas") {
      // filter props by operacion to adjust counts shown
      // just filter out zones with 0 properties of that type
    }

    // orden
    arr.sort((a, b) => {
      if (orden === "score") return b.score - a.score;
      if (orden === "contactos") return b.contactos - a.contactos;
      if (orden === "propiedades") return b.propiedades - a.propiedades;
      return b.demandaOferta - a.demandaOferta;
    });

    return arr;
  }, [contactos, propiedades, interacciones, orden, filtroOp]);

  const maxScore = useMemo(() => Math.max(...zonas.map(z => z.score), 1), [zonas]);
  const maxContactos = useMemo(() => Math.max(...zonas.map(z => z.contactos), 1), [zonas]);

  const top5 = zonas.slice(0, 5);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif" }}>Cargando mapa...</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← CRM</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Mapa de Calor por Zona
        </h1>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{zonas.length} zonas · {contactos.length} contactos</span>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        {/* Controles */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["score","contactos","propiedades","demanda"] as const).map(o => (
              <button key={o} onClick={() => setOrden(o)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${orden === o ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: orden === o ? "rgba(204,0,0,0.15)" : "transparent", color: orden === o ? "#cc0000" : "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {o === "score" ? "Score" : o === "contactos" ? "Contactos" : o === "propiedades" ? "Propiedades" : "Demanda/Oferta"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {(["todas","venta","alquiler"] as const).map(op => (
              <button key={op} onClick={() => setFiltroOp(op)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filtroOp === op ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`, background: filtroOp === op ? "rgba(255,255,255,0.08)" : "transparent", color: filtroOp === op ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {op === "todas" ? "Todas" : op === "venta" ? "Venta" : "Alquiler"}
              </button>
            ))}
          </div>
        </div>

        {/* Top 5 Burbujas */}
        {top5.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px", marginBottom: 24 }}>
            <p style={{ margin: "0 0 16px 0", fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Top 5 Zonas Hot</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 120 }}>
              {top5.map((z, i) => {
                const h = Math.max(30, (z.score / maxScore) * 100);
                const bg = heat(z.score, maxScore);
                return (
                  <div key={z.zona} onClick={() => setSeleccionada(z)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                    <div style={{ width: "100%", height: h, background: bg, border: `1px solid ${seleccionada?.zona === z.zona ? "#cc0000" : "rgba(255,255,255,0.1)"}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>{z.score.toFixed(0)}</span>
                    </div>
                    <span style={{ marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.5)", textAlign: "center", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{z.zona.length > 14 ? z.zona.substring(0, 13) + "…" : z.zona}</span>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>#{i + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: seleccionada ? "1fr 320px" : "1fr", gap: 20 }}>
          {/* Tabla principal */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Zona", "Score", "Demanda/Oferta", "Contactos", "Propiedades", "Interac.", "Activ. 30d", "Ppto. Prom."].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: h === "Zona" ? "left" : "center", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zonas.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>No hay datos de zonas</td></tr>
                ) : zonas.map((z, idx) => (
                  <tr key={z.zona} onClick={() => setSeleccionada(seleccionada?.zona === z.zona ? null : z)} style={{ cursor: "pointer", background: seleccionada?.zona === z.zona ? "rgba(204,0,0,0.06)" : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", borderLeft: seleccionada?.zona === z.zona ? "2px solid #cc0000" : "2px solid transparent" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: heat(z.score, maxScore), flexShrink: 0 }} />
                        {z.zona}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                        <div style={{ width: Math.max(4, (z.score / maxScore) * 50), height: 4, background: heat(z.score, maxScore), borderRadius: 2 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: heat(z.score, maxScore).replace("rgba", "rgb").replace(/,[^)]+\)/, ")") }}>{z.score.toFixed(1)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ fontSize: 12, color: z.demandaOferta > 2 ? "#cc0000" : z.demandaOferta > 1 ? "#f97316" : "rgba(255,255,255,0.5)", fontWeight: 700 }}>
                        {z.demandaOferta === z.contactos && z.propiedades === 0 ? "∞" : z.demandaOferta.toFixed(1)}x
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                        <div style={{ width: Math.max(2, (z.contactos / maxContactos) * 30), height: 3, background: "#3b82f6", borderRadius: 2 }} />
                        <span style={{ fontSize: 12 }}>{z.contactos}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12 }}>{z.propiedades}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{z.interacciones}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: z.actividadReciente > 5 ? "rgba(204,0,0,0.15)" : "rgba(255,255,255,0.05)", color: z.actividadReciente > 5 ? "#cc0000" : "rgba(255,255,255,0.4)" }}>
                        {z.actividadReciente}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                      {z.presupuestoPromedio > 0 ? `USD ${(z.presupuestoPromedio / 1000).toFixed(0)}k` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Panel detalle */}
          {seleccionada && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 12, padding: 20, alignSelf: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontFamily: "'Montserrat',sans-serif", fontWeight: 800 }}>{seleccionada.zona}</h3>
                <button onClick={() => setSeleccionada(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>

              {/* Score ring */}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <svg width={90} height={90} viewBox="0 0 90 90">
                  <circle cx={45} cy={45} r={38} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8} />
                  <circle cx={45} cy={45} r={38} fill="none" stroke={heat(seleccionada.score, maxScore)} strokeWidth={8}
                    strokeDasharray={`${(seleccionada.score / maxScore) * 238.76} 238.76`}
                    strokeLinecap="round" transform="rotate(-90 45 45)" />
                  <text x={45} y={49} textAnchor="middle" fill="#fff" fontSize={16} fontWeight={800} fontFamily="Montserrat">{seleccionada.score.toFixed(0)}</text>
                  <text x={45} y={62} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={8} fontFamily="Montserrat">SCORE</text>
                </svg>
              </div>

              {[
                { label: "Contactos interesados", val: seleccionada.contactos },
                { label: "Propiedades disponibles", val: seleccionada.propiedades },
                { label: "Interacciones totales", val: seleccionada.interacciones },
                { label: "Actividad últimos 30d", val: seleccionada.actividadReciente },
                { label: "Ratio demanda/oferta", val: seleccionada.propiedades === 0 ? "Sin stock" : `${seleccionada.demandaOferta.toFixed(1)}x` },
                { label: "Presupuesto promedio", val: seleccionada.presupuestoPromedio > 0 ? `USD ${seleccionada.presupuestoPromedio.toLocaleString("es-AR")}` : "Sin datos" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{row.val}</span>
                </div>
              ))}

              <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: seleccionada.demandaOferta > 2 ? "rgba(204,0,0,0.08)" : seleccionada.demandaOferta > 1 ? "rgba(249,115,22,0.08)" : "rgba(59,130,246,0.08)", border: `1px solid ${seleccionada.demandaOferta > 2 ? "rgba(204,0,0,0.2)" : seleccionada.demandaOferta > 1 ? "rgba(249,115,22,0.2)" : "rgba(59,130,246,0.2)"}` }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color: seleccionada.demandaOferta > 2 ? "#cc0000" : seleccionada.demandaOferta > 1 ? "#f97316" : "#3b82f6" }}>
                  {seleccionada.demandaOferta > 2 ? "🔥 Zona muy demandada — captación prioritaria" :
                   seleccionada.demandaOferta > 1 ? "⚡ Demanda supera oferta — oportunidad de captación" :
                   seleccionada.propiedades === 0 ? "📍 Sin stock — potencial de captación" :
                   "✅ Oferta equilibrada"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div style={{ marginTop: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Intensidad score:</span>
          {[
            { label: "Baja", color: "rgba(59,130,246,0.4)" },
            { label: "Media", color: "rgba(234,179,8,0.5)" },
            { label: "Alta", color: "rgba(249,115,22,0.6)" },
            { label: "Crítica", color: "rgba(204,0,0,0.8)" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
