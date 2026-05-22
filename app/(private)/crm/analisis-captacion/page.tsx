"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Contacto {
  id: string;
  nombre: string;
  apellido: string | null;
  tipo: string | null;
  estado: string | null;
  created_at: string | null;
  origen: string | null;
}

interface Negocio {
  id: string;
  etapa: string;
  contacto_id: string | null;
  created_at: string | null;
  valor_operacion: number | null;
  honorarios_pct: number | null;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const ORIGEN_LABELS: Record<string, string> = {
  portal_inmobiliario: "🌐 Portal inmobiliario",
  referido: "👥 Referido",
  redes_sociales: "📱 Redes sociales",
  web_propia: "💻 Web propia",
  whatsapp_directo: "💬 WhatsApp directo",
  cartel: "🪧 Cartel / PV",
  otro: "⚡ Otro",
};
const ORIGEN_COLORES: Record<string, string> = {
  portal_inmobiliario: "#3b82f6",
  referido: "#22c55e",
  redes_sociales: "#a78bfa",
  web_propia: "#f59e0b",
  whatsapp_directo: "#06b6d4",
  cartel: "#f97316",
  otro: "#6b7280",
};

const MESES_NOMBRE = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function mesAnioKey(fecha: string | null): string {
  if (!fecha) return "Sin fecha";
  return fecha.substring(0, 7);
}

function mesAnioLabel(key: string): string {
  if (key === "Sin fecha") return key;
  const [y, m] = key.split("-");
  return `${MESES_NOMBRE[parseInt(m) - 1]} ${y}`;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function AnalisisCaptacion() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [mesesVer, setMesesVer] = useState(12);

  useEffect(() => {
    Promise.all([
      supabase.from("crm_contactos").select("id,nombre,apellido,tipo,estado,created_at,origen").order("created_at", { ascending: false }),
      supabase.from("crm_negocios").select("id,etapa,contacto_id,created_at,valor_operacion,honorarios_pct"),
    ]).then(([{ data: c }, { data: n }]) => {
      setContactos((c ?? []) as Contacto[]);
      setNegocios((n ?? []) as Negocio[]);
      setLoading(false);
    });
  }, []);

  const hoy = new Date();
  const limiteDesde = new Date(hoy);
  limiteDesde.setMonth(hoy.getMonth() - mesesVer);
  const limitKey = limiteDesde.toISOString().substring(0, 7);

  const contactosFiltrados = useMemo(() => {
    return contactos.filter(c => {
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (c.created_at && mesAnioKey(c.created_at) < limitKey) return false;
      return true;
    });
  }, [contactos, filtroTipo, limitKey]);

  const porMes = useMemo(() => {
    const mapa: Record<string, number> = {};
    contactosFiltrados.forEach(c => {
      const key = mesAnioKey(c.created_at);
      mapa[key] = (mapa[key] ?? 0) + 1;
    });
    return Object.entries(mapa).sort((a, b) => a[0].localeCompare(b[0])).slice(-mesesVer);
  }, [contactosFiltrados, mesesVer]);

  const maxMes = Math.max(...porMes.map(([, v]) => v), 1);

  const porOrigen = useMemo(() => {
    const mapa: Record<string, number> = {};
    contactosFiltrados.forEach(c => {
      const origen = c.origen ?? "otro";
      mapa[origen] = (mapa[origen] ?? 0) + 1;
    });
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [contactosFiltrados]);

  const totalContactos = contactosFiltrados.length;

  const contactosConNegocio = useMemo(() => {
    const ids = new Set(negocios.map(n => n.contacto_id).filter(Boolean) as string[]);
    return contactosFiltrados.filter(c => ids.has(c.id)).length;
  }, [contactosFiltrados, negocios]);

  const contactosCerrados = useMemo(() => {
    const cerrados = new Set(negocios.filter(n => ["cerrado","escriturado","firmado"].includes(n.etapa)).map(n => n.contacto_id).filter(Boolean) as string[]);
    return contactosFiltrados.filter(c => cerrados.has(c.id)).length;
  }, [contactosFiltrados, negocios]);

  const tiempoCaptNeg = useMemo(() => {
    const pares = negocios.filter(n => n.contacto_id && n.created_at)
      .map(n => {
        const c = contactos.find(x => x.id === n.contacto_id);
        if (!c?.created_at) return null;
        const dias = (new Date(n.created_at!).getTime() - new Date(c.created_at).getTime()) / 86400000;
        return dias >= 0 ? dias : null;
      }).filter((d): d is number => d !== null);
    return pares.length > 0 ? pares.reduce((s, d) => s + d, 0) / pares.length : null;
  }, [contactos, negocios]);

  const convPorOrigen = useMemo(() => {
    const negContactos = new Set(negocios.map(n => n.contacto_id).filter(Boolean) as string[]);
    return porOrigen.map(([origen, total]) => {
      const conNeg = contactosFiltrados.filter(c => (c.origen ?? "otro") === origen && negContactos.has(c.id)).length;
      return { origen, total, conNeg, tasa: total > 0 ? conNeg / total : 0 };
    });
  }, [porOrigen, contactosFiltrados, negocios]);

  const tiposDisponibles = useMemo(() => Array.from(new Set(contactos.map(c => c.tipo).filter(Boolean) as string[])), [contactos]);

  const embudoPasos = useMemo(() => [
    { label: "Contactos captados", val: totalContactos, color: "#3b82f6" },
    { label: "Con negocio abierto", val: contactosConNegocio, color: "#a78bfa" },
    { label: "En reserva/escritura", val: negocios.filter(n => ["reserva","escritura","escriturado"].includes(n.etapa) && contactosFiltrados.some(c => c.id === n.contacto_id)).length, color: "#f59e0b" },
    { label: "Operación cerrada", val: contactosCerrados, color: "#22c55e" },
  ], [totalContactos, contactosConNegocio, contactosCerrados, negocios, contactosFiltrados]);

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>🎣 Análisis de Captación</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Nuevos contactos, fuentes y tasas de conversión</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los tipos</option>
            {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={mesesVer} onChange={e => setMesesVer(+e.target.value)} style={inputStyle}>
            {[3, 6, 12, 24].map(m => <option key={m} value={m}>Últimos {m} meses</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: 48 }}>Cargando...</div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "Nuevos contactos", val: totalContactos.toString(), sub: `Últimos ${mesesVer} meses`, color: "#3b82f6" },
                { label: "Con negocio abierto", val: `${contactosConNegocio} (${totalContactos > 0 ? (contactosConNegocio/totalContactos*100).toFixed(0) : 0}%)`, sub: "Conversión a negocio", color: "#a78bfa" },
                { label: "Cerraron operación", val: `${contactosCerrados} (${totalContactos > 0 ? (contactosCerrados/totalContactos*100).toFixed(0) : 0}%)`, sub: "De captados totales", color: "#22c55e" },
                { label: "Días captac. → negocio", val: tiempoCaptNeg !== null ? `${tiempoCaptNeg.toFixed(0)}d` : "—", sub: "Promedio", color: "#f59e0b" },
                { label: "Fuentes", val: porOrigen.length.toString(), sub: "Orígenes distintos", color: "#f97316" },
              ].map((kpi, i) => (
                <div key={i} style={{ background: "#111", border: `1px solid ${kpi.color}33`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Evolución mensual */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                Nuevos contactos por mes
              </h2>
              {porMes.length === 0 ? (
                <div style={{ color: "#555", textAlign: "center", padding: 24 }}>Sin datos para el período seleccionado</div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
                  {porMes.map(([key, count]) => (
                    <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 10, color: "#888" }}>{count}</span>
                      <div style={{ width: "100%", background: "#3b82f6", height: `${(count / maxMes) * 70}px`, borderRadius: "3px 3px 0 0", minHeight: 3 }} />
                      <span style={{ fontSize: 9, color: "#555", textAlign: "center" }}>{mesAnioLabel(key)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Por origen */}
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
                <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                  Fuente de captación
                </h2>
                {porOrigen.length === 0 ? (
                  <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: 16 }}>
                    Sin campo "origen" en crm_contactos.<br />Agregá el origen al cargar contactos.
                  </div>
                ) : porOrigen.map(([origen, count]) => {
                  const pct = totalContactos > 0 ? (count / totalContactos) * 100 : 0;
                  const color = ORIGEN_COLORES[origen] ?? "#888";
                  return (
                    <div key={origen} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#ccc" }}>{ORIGEN_LABELS[origen] ?? origen}</span>
                        <span style={{ fontSize: 12, color: "#888" }}>{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Conversión por origen */}
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
                <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                  Conversión por fuente
                </h2>
                {convPorOrigen.length === 0 ? (
                  <div style={{ color: "#555", fontSize: 12, padding: 16 }}>Sin datos</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Fuente","Total","C/ Neg.","Tasa"].map(h => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {convPorOrigen.map(row => (
                        <tr key={row.origen} style={{ borderBottom: "1px solid #111" }}>
                          <td style={{ padding: "8px", fontSize: 11, color: "#ccc" }}>{ORIGEN_LABELS[row.origen] ?? row.origen}</td>
                          <td style={{ padding: "8px", fontSize: 12, color: "#888" }}>{row.total}</td>
                          <td style={{ padding: "8px", fontSize: 12, color: "#888" }}>{row.conNeg}</td>
                          <td style={{ padding: "8px", fontSize: 13, fontWeight: 700, color: row.tasa >= 0.3 ? "#22c55e" : row.tasa >= 0.1 ? "#f59e0b" : "#888" }}>
                            {(row.tasa * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Embudo */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                Embudo de conversión
              </h2>
              {embudoPasos.map((step, i) => {
                const pct = embudoPasos[0].val > 0 ? (step.val / embudoPasos[0].val) * 100 : 0;
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "#ccc" }}>{step.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: step.color }}>
                        {step.val} <span style={{ fontSize: 11, color: "#555" }}>({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 12, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: step.color, borderRadius: 4 }} />
                    </div>
                    {i < embudoPasos.length - 1 && (
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2, textAlign: "right" }}>
                        → {embudoPasos[0].val > 0 ? ((embudoPasos[i+1].val / (step.val || 1)) * 100).toFixed(0) : 0}% pasan a la etapa siguiente
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
