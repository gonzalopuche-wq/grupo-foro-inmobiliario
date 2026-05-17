"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  tipo: string | null;
  estado: string | null;
  interes: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: string | null;
  zona_interes: string | null;
  created_at: string;
}

interface Negocio {
  id: string;
  titulo: string;
  tipo_operacion: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string;
  direccion: string | null;
  descripcion: string | null;
  contacto_id: string | null;
  archivado: boolean;
}

interface Match {
  contacto: Contacto;
  negocio: Negocio;
  score: number;
  razones: string[];
}

function normStr(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Normaliza monedas a USD usando TC
function toUSD(monto: number, moneda: string, tc: number): number {
  if (moneda === "USD") return monto;
  return monto / tc;
}

function calcularMatch(contacto: Contacto, negocio: Negocio, tc: number): { score: number; razones: string[] } {
  const razones: string[] = [];
  let score = 0;

  // 1. Tipo de operación vs interes del cliente
  const interes = normStr(contacto.interes);
  const tipoOp = normStr(negocio.tipo_operacion);
  const coincideTipo =
    (interes.includes("venta") && tipoOp.includes("venta")) ||
    (interes.includes("alquiler") && (tipoOp.includes("alquiler") || tipoOp.includes("locacion"))) ||
    (interes.includes("compra") && tipoOp.includes("venta")) ||
    interes === "" || tipoOp === "";

  if (coincideTipo && interes !== "" && tipoOp !== "") {
    score += 30;
    razones.push(`Operación compatible (${negocio.tipo_operacion})`);
  } else if (interes === "" || tipoOp === "") {
    score += 10;
  }

  // 2. Presupuesto
  if (negocio.valor_operacion && (contacto.presupuesto_min || contacto.presupuesto_max)) {
    const valorUSD = toUSD(negocio.valor_operacion, negocio.moneda, tc);
    const clienteMoneda = contacto.moneda ?? "USD";
    const minUSD = contacto.presupuesto_min ? toUSD(contacto.presupuesto_min, clienteMoneda, tc) : null;
    const maxUSD = contacto.presupuesto_max ? toUSD(contacto.presupuesto_max, clienteMoneda, tc) : null;

    const dentroDe = (!minUSD || valorUSD >= minUSD * 0.85) && (!maxUSD || valorUSD <= maxUSD * 1.15);
    if (dentroDe) {
      score += 35;
      razones.push("Precio dentro del presupuesto");
    } else if (!minUSD && maxUSD && valorUSD <= maxUSD * 1.3) {
      score += 15;
      razones.push("Precio cerca del presupuesto");
    }
  } else if (!negocio.valor_operacion) {
    score += 10;
  }

  // 3. Zona de interés vs dirección del negocio
  const zonaCliente = normStr(contacto.zona_interes);
  const dirNegocio = normStr(negocio.direccion) + " " + normStr(negocio.descripcion);
  if (zonaCliente && zonaCliente.length >= 3) {
    const palabras = zonaCliente.split(/\s+/).filter(p => p.length >= 3);
    const coincidencias = palabras.filter(p => dirNegocio.includes(p)).length;
    if (coincidencias > 0) {
      score += Math.min(coincidencias * 15, 30);
      razones.push(`Zona coincide (${contacto.zona_interes})`);
    }
  }

  // 4. Etapa activa del negocio — penalizar etapas muy avanzadas
  const etapa = normStr(negocio.etapa);
  if (etapa.includes("cerrado") || etapa.includes("escritura")) {
    score = Math.round(score * 0.3);
  } else if (etapa.includes("reserva")) {
    score = Math.round(score * 0.6);
  }

  return { score, razones };
}

export default function MatchClientesPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [tc, setTc] = useState(1300);
  const [scoreMinimo, setScoreMinimo] = useState(40);
  const [filtroEtapa, setFiltroEtapa] = useState("activos");
  const [busqueda, setBusqueda] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    const cargar = async () => {
      const [{ data: ctcs }, { data: negs }] = await Promise.all([
        supabase.from("crm_contactos").select("id,nombre,apellido,telefono,tipo,estado,interes,presupuesto_min,presupuesto_max,moneda,zona_interes,created_at"),
        supabase.from("crm_negocios").select("id,titulo,tipo_operacion,etapa,valor_operacion,moneda,direccion,descripcion,contacto_id,archivado"),
      ]);
      setContactos((ctcs ?? []) as Contacto[]);
      setNegocios((negs ?? []) as Negocio[]);
      setLoading(false);
    };
    cargar();
  }, []);

  const negociosFiltrados = useMemo(() => {
    return negocios.filter(n => {
      if (n.archivado) return false;
      if (filtroEtapa === "activos") {
        const e = normStr(n.etapa);
        return !e.includes("cerrado") && !e.includes("cancelado") && !e.includes("perdido");
      }
      return true;
    });
  }, [negocios, filtroEtapa]);

  const matches = useMemo<Match[]>(() => {
    const resultado: Match[] = [];
    const contactosFiltrados = contactos.filter(c => {
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) ||
        (c.zona_interes ?? "").toLowerCase().includes(q);
    });

    for (const contacto of contactosFiltrados) {
      for (const negocio of negociosFiltrados) {
        if (negocio.contacto_id === contacto.id) continue;
        const { score, razones } = calcularMatch(contacto, negocio, tc);
        if (score >= scoreMinimo && razones.length > 0) {
          resultado.push({ contacto, negocio, score, razones });
        }
      }
    }

    return resultado.sort((a, b) => b.score - a.score);
  }, [contactos, negociosFiltrados, tc, scoreMinimo, busqueda]);

  const topContactos = useMemo(() => {
    const map: Record<string, number> = {};
    matches.forEach(m => { map[m.contacto.id] = (map[m.contacto.id] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [matches]);

  const toggleExpand = (key: string) => {
    setExpandidos(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  const scoreColor = (s: number) => s >= 70 ? "#22c55e" : s >= 50 ? "#f97316" : "#eab308";
  const scoreLabel = (s: number) => s >= 70 ? "Alta" : s >= 50 ? "Media" : "Baja";

  const fmtPresup = (c: Contacto) => {
    const m = c.moneda ?? "USD";
    if (!c.presupuesto_min && !c.presupuesto_max) return "Sin definir";
    const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : `${Math.round(n / 1000)}k`;
    if (c.presupuesto_min && c.presupuesto_max) return `${m} ${fmt(c.presupuesto_min)}–${fmt(c.presupuesto_max)}`;
    if (c.presupuesto_max) return `${m} hasta ${fmt(c.presupuesto_max)}`;
    return `${m} desde ${fmt(c.presupuesto_min!)}`;
  };

  const fmtValor = (n: Negocio) => {
    if (!n.valor_operacion) return "Sin precio";
    const v = n.valor_operacion;
    const f = v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`;
    return `${n.moneda} ${f}`;
  };

  // Agrupar por contacto
  const porContacto = useMemo(() => {
    const map: Record<string, Match[]> = {};
    matches.forEach(m => {
      if (!map[m.contacto.id]) map[m.contacto.id] = [];
      map[m.contacto.id].push(m);
    });
    return Object.entries(map).sort((a, b) => {
      const maxA = Math.max(...a[1].map(x => x.score));
      const maxB = Math.max(...b[1].map(x => x.score));
      return maxB - maxA;
    });
  }, [matches]);

  const waMsg = (c: Contacto, n: Negocio) => {
    const msg = `Hola ${c.nombre}! 🏠 Te escribo porque tenemos una propiedad que podría interesarte: ${n.titulo}${n.direccion ? ` en ${n.direccion}` : ""}${n.valor_operacion ? ` — ${fmtValor(n)}` : ""}. ¿Te interesaría conocer más detalles? Saludos desde Grupo Foro Inmobiliario!`;
    const tel = (c.telefono ?? "").replace(/\D/g, "");
    if (tel) window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>🎯 Match Clientes–Propiedades</h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Cruza perfiles de clientes con negocios activos por zona, presupuesto y tipo de operación</p>
          </div>
          <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Matches encontrados", value: matches.length, color: "#cc0000" },
            { label: "Clientes con match", value: porContacto.length, color: "#f97316" },
            { label: "Negocios activos", value: negociosFiltrados.length, color: "#3b82f6" },
            { label: "Alta compatibilidad", value: matches.filter(m => m.score >= 70).length, color: "#22c55e" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Controles */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente..."
            style={{ flex: 1, background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "7px 10px", fontSize: 13, minWidth: 140 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, color: "#6b7280" }}>Score mín:</label>
            <input type="number" value={scoreMinimo} min={0} max={100} step={5}
              onChange={e => setScoreMinimo(parseInt(e.target.value) || 0)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 12, width: 60 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, color: "#6b7280" }}>TC:</label>
            <input type="number" value={tc} step={50}
              onChange={e => setTc(parseFloat(e.target.value) || 1)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 12, width: 80 }} />
          </div>
          {[
            { id: "activos", label: "Negocios activos" },
            { id: "todos", label: "Todos" },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltroEtapa(f.id)}
              style={{ background: filtroEtapa === f.id ? "#1f2937" : "transparent", border: `1px solid ${filtroEtapa === f.id ? "#374151" : "#1f2937"}`, borderRadius: 6, color: filtroEtapa === f.id ? "#e5e5e5" : "#6b7280", padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 48 }}>Cargando datos...</div>
        ) : matches.length === 0 ? (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#9ca3af" }}>Sin matches para los filtros actuales</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Probá bajando el score mínimo o completando más datos en los perfiles</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {porContacto.map(([contactoId, ms]) => {
              const c = ms[0].contacto;
              const isExpanded = expandidos.has(contactoId);
              const maxScore = Math.max(...ms.map(m => m.score));
              return (
                <div key={contactoId} style={{ background: "#111", border: `1px solid ${scoreColor(maxScore)}33`, borderRadius: 12, overflow: "hidden" }}>
                  {/* Header contacto */}
                  <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    onClick={() => toggleExpand(contactoId)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>
                          {c.nombre} {c.apellido}
                          {c.tipo && <span style={{ marginLeft: 8, fontSize: 10, color: "#6b7280", background: "#1f2937", padding: "2px 7px", borderRadius: 4 }}>{c.tipo}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                          {c.zona_interes && <span>📍 {c.zona_interes}</span>}
                          <span>💰 {fmtPresup(c)}</span>
                          {c.interes && <span>🔍 {c.interes}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ background: `${scoreColor(maxScore)}22`, color: scoreColor(maxScore), padding: "4px 12px", borderRadius: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13 }}>
                        {ms.length} match{ms.length > 1 ? "es" : ""}
                      </span>
                      <span style={{ color: "#4b5563", fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Matches del contacto */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #1f2937" }}>
                      {ms.slice(0, 5).map((m, i) => (
                        <div key={m.negocio.id}
                          style={{ padding: "12px 16px", borderBottom: i < ms.slice(0, 5).length - 1 ? "1px solid #1a1a1a" : "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 13, color: "#e5e5e5", marginBottom: 4 }}>
                              {m.negocio.titulo}
                              <span style={{ marginLeft: 8, fontSize: 10, color: "#4b5563" }}>{m.negocio.etapa}</span>
                            </div>
                            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#6b7280", marginBottom: 6, flexWrap: "wrap" }}>
                              {m.negocio.direccion && <span>📍 {m.negocio.direccion}</span>}
                              <span>💰 {fmtValor(m.negocio)}</span>
                              <span>🔄 {m.negocio.tipo_operacion}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {m.razones.map(r => (
                                <span key={r} style={{ background: `${scoreColor(m.score)}15`, color: scoreColor(m.score), padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: scoreColor(m.score) }}>
                              {m.score}
                            </div>
                            <div style={{ fontSize: 10, color: scoreColor(m.score) }}>{scoreLabel(m.score)}</div>
                            {c.telefono && (
                              <button onClick={() => waMsg(c, m.negocio)}
                                style={{ background: "#25d366", border: "none", borderRadius: 5, color: "#fff", padding: "5px 10px", fontSize: 10, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                                💬 WA
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {ms.length > 5 && (
                        <div style={{ padding: "8px 16px", fontSize: 11, color: "#6b7280", textAlign: "center" }}>
                          +{ms.length - 5} matches más
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Top contactos sidebar info */}
        {topContactos.length > 0 && !loading && (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", marginTop: 16, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>TOP CLIENTES:</span>
            {topContactos.map(([id, count]) => {
              const c = contactos.find(x => x.id === id);
              if (!c) return null;
              return (
                <span key={id} style={{ fontSize: 12, color: "#e5e5e5" }}>
                  <strong style={{ color: "#cc0000" }}>{c.nombre} {c.apellido}</strong>
                  <span style={{ color: "#6b7280", marginLeft: 4 }}>({count} matches)</span>
                </span>
              );
            })}
          </div>
        )}

        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", marginTop: 12, fontSize: 12, color: "#6b7280" }}>
          <strong style={{ color: "#9ca3af" }}>📌 Cómo funciona:</strong> Cruza zona de interés, presupuesto y tipo de operación de cada cliente con los negocios activos. Score basado en compatibilidad de precio (±15%), zona por palabras clave y tipo de operación. No cruza el cliente con su propio negocio.
        </div>
      </div>
    </div>
  );
}
