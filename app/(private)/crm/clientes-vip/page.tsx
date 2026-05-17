"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipo: string | null;
  estado: string | null;
  presupuesto_max: number | null;
  moneda: string | null;
  zona_interes: string | null;
  notas: string | null;
  etiquetas: string[] | null;
  created_at: string;
}

interface Negocio {
  id: string;
  contacto_id: string | null;
  valor_estimado: number | null;
  moneda: string | null;
  etapa: string;
  tipo_operacion: string | null;
  created_at: string;
}

interface Interaccion {
  id: string;
  contacto_id: string;
  created_at: string;
}

interface ClienteVIP extends Contacto {
  negociosTotal: number;
  negociosCerrados: number;
  valorTotalUSD: number;
  honorariosEstimados: number;
  interacciones: number;
  scoreVIP: number;
  tipoVIP: "platinum" | "gold" | "silver" | "regular";
  probabilidadReferido: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function tipoColor(t: ClienteVIP["tipoVIP"]) {
  return t === "platinum" ? "#e5e7eb" : t === "gold" ? "#f59e0b" : t === "silver" ? "#9ca3af" : "rgba(255,255,255,0.3)";
}

function tipoIcon(t: ClienteVIP["tipoVIP"]) {
  return t === "platinum" ? "💎" : t === "gold" ? "🥇" : t === "silver" ? "🥈" : "👤";
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ClientesVIP() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tcDolar, setTcDolar] = useState(1200);
  const [honorariosPct, setHonorariosPct] = useState(3.0);
  const [filtroTipo, setFiltroTipo] = useState<"todos"|"platinum"|"gold"|"silver">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<ClienteVIP | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: c }, { data: n }, { data: i }] = await Promise.all([
        supabase.from("crm_contactos").select("id,nombre,apellido,telefono,email,tipo,estado,presupuesto_max,moneda,zona_interes,notas,etiquetas,created_at").eq("perfil_id", user.id).neq("estado", "archivado"),
        supabase.from("crm_negocios").select("id,contacto_id,valor_estimado,moneda,etapa,tipo_operacion,created_at").eq("perfil_id", user.id),
        supabase.from("crm_interacciones").select("id,contacto_id,created_at").eq("perfil_id", user.id),
      ]);
      setContactos((c ?? []) as Contacto[]);
      setNegocios((n ?? []) as Negocio[]);
      setInteracciones((i ?? []) as Interaccion[]);
      setLoading(false);
    }
    load();
  }, []);

  const clientesVIP = useMemo((): ClienteVIP[] => {
    const negociosPorContacto = new Map<string, Negocio[]>();
    negocios.forEach(n => {
      if (!n.contacto_id) return;
      const arr = negociosPorContacto.get(n.contacto_id) ?? [];
      arr.push(n);
      negociosPorContacto.set(n.contacto_id, arr);
    });

    const interaccionesPorContacto = new Map<string, number>();
    interacciones.forEach(i => {
      interaccionesPorContacto.set(i.contacto_id, (interaccionesPorContacto.get(i.contacto_id) ?? 0) + 1);
    });

    const clientes: ClienteVIP[] = contactos.map(c => {
      const negs = negociosPorContacto.get(c.id) ?? [];
      const cerrados = negs.filter(n => n.etapa === "cerrado");
      const totalUSD = cerrados.reduce((acc, n) => {
        const usd = n.moneda === "ARS" ? (n.valor_estimado ?? 0) / tcDolar : (n.valor_estimado ?? 0);
        return acc + usd;
      }, 0);
      const honorarios = totalUSD * honorariosPct / 100;
      const ints = interaccionesPorContacto.get(c.id) ?? 0;
      const presupuestoPuntaje = Math.min(30, ((c.presupuesto_max ?? 0) / 10000));

      // Score VIP: operaciones cerradas (40%), valor total (30%), interacciones (20%), presupuesto (10%)
      const score = cerrados.length * 15 + Math.min(40, totalUSD / 5000) + Math.min(20, ints * 1.5) + presupuestoPuntaje;

      const tipoVIP: ClienteVIP["tipoVIP"] = score >= 60 ? "platinum" : score >= 30 ? "gold" : score >= 10 ? "silver" : "regular";

      // Probabilidad de referido: más operaciones y más interacciones = más probable
      const probReferido = Math.min(95, cerrados.length * 20 + ints * 2 + (tipoVIP === "platinum" ? 30 : tipoVIP === "gold" ? 15 : 0));

      return { ...c, negociosTotal: negs.length, negociosCerrados: cerrados.length, valorTotalUSD: totalUSD, honorariosEstimados: honorarios, interacciones: ints, scoreVIP: score, tipoVIP, probabilidadReferido: probReferido };
    });

    return clientes
      .filter(c => c.scoreVIP > 0 || c.negociosTotal > 0)
      .sort((a, b) => b.scoreVIP - a.scoreVIP);
  }, [contactos, negocios, interacciones, tcDolar, honorariosPct]);

  const filtrados = useMemo(() => {
    let arr = clientesVIP;
    if (filtroTipo !== "todos") arr = arr.filter(c => c.tipoVIP === filtroTipo);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      arr = arr.filter(c => `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q));
    }
    return arr;
  }, [clientesVIP, filtroTipo, busqueda]);

  const stats = useMemo(() => ({
    platinum: clientesVIP.filter(c => c.tipoVIP === "platinum").length,
    gold: clientesVIP.filter(c => c.tipoVIP === "gold").length,
    silver: clientesVIP.filter(c => c.tipoVIP === "silver").length,
    totalHonorarios: clientesVIP.reduce((a, c) => a + c.honorariosEstimados, 0),
    totalValor: clientesVIP.reduce((a, c) => a + c.valorTotalUSD, 0),
  }), [clientesVIP]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif" }}>Cargando clientes VIP...</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← CRM</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Clientes VIP
        </h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>TC:</span>
          <input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} style={{ width: 80, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: "4px 8px", fontSize: 11 }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Hon.%:</span>
          <input type="number" step="0.5" value={honorariosPct} onChange={e => setHonorariosPct(+e.target.value)} style={{ width: 55, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: "4px 8px", fontSize: 11 }} />
        </div>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "💎 Platinum", val: stats.platinum, color: "#e5e7eb" },
            { label: "🥇 Gold", val: stats.gold, color: "#f59e0b" },
            { label: "🥈 Silver", val: stats.silver, color: "#9ca3af" },
            { label: "Hon. generados", val: `USD ${fmt(stats.totalHonorarios)}`, color: "#cc0000" },
            { label: "Valor gestionado", val: `USD ${fmt(stats.totalValor)}`, color: "#3b82f6" },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 6px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{kpi.label}</p>
              <p style={{ margin: 0, fontSize: 22, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <input type="text" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "7px 12px", fontFamily: "'Inter',sans-serif", fontSize: 12 }} />
          <div style={{ display: "flex", gap: 6 }}>
            {(["todos","platinum","gold","silver"] as const).map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${filtroTipo === t ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: filtroTipo === t ? "rgba(204,0,0,0.12)" : "transparent", color: filtroTipo === t ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                {t === "todos" ? "Todos" : t === "platinum" ? "💎 Platinum" : t === "gold" ? "🥇 Gold" : "🥈 Silver"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: seleccionado ? "1fr 320px" : "1fr", gap: 20 }}>
          {/* Tabla */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Tier", "Cliente", "Operaciones", "Valor total", "Honorarios", "Interacciones", "P. Referido", "Score"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: h === "Tier" || h === "Cliente" ? "left" : "center", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Sin clientes VIP aún</td></tr>
                ) : filtrados.map((c, idx) => (
                  <tr key={c.id} onClick={() => setSeleccionado(seleccionado?.id === c.id ? null : c)} style={{ cursor: "pointer", background: seleccionado?.id === c.id ? "rgba(204,0,0,0.06)" : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", borderLeft: seleccionado?.id === c.id ? "2px solid #cc0000" : "2px solid transparent" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 18 }}>{tipoIcon(c.tipoVIP)}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre} {c.apellido}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{c.tipo ?? "—"}{c.zona_interes ? ` · ${c.zona_interes}` : ""}</div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{c.negociosCerrados}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>/{c.negociosTotal}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#3b82f6" }}>
                      {c.valorTotalUSD > 0 ? `USD ${fmt(c.valorTotalUSD)}` : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#cc0000" }}>
                      {c.honorariosEstimados > 0 ? `USD ${fmt(c.honorariosEstimados)}` : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12 }}>{c.interacciones}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                        <div style={{ width: 32, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${c.probabilidadReferido}%`, background: c.probabilidadReferido >= 60 ? "#22c55e" : "#f97316", borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10 }}>{c.probabilidadReferido.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", color: tipoColor(c.tipoVIP) }}>{c.scoreVIP.toFixed(0)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Panel detalle */}
          {seleccionado && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 12, padding: 20, alignSelf: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{tipoIcon(seleccionado.tipoVIP)}</div>
                  <h3 style={{ margin: 0, fontSize: 16, fontFamily: "'Montserrat',sans-serif", fontWeight: 800 }}>{seleccionado.nombre} {seleccionado.apellido}</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: 11, color: tipoColor(seleccionado.tipoVIP), fontFamily: "'Montserrat',sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{seleccionado.tipoVIP}</p>
                </div>
                <button onClick={() => setSeleccionado(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>

              {seleccionado.email && <p style={{ margin: "0 0 4px 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>✉ {seleccionado.email}</p>}
              {seleccionado.telefono && (
                <a href={`https://wa.me/${seleccionado.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 11, color: "#22c55e", textDecoration: "none", marginBottom: 4 }}>
                  💬 {seleccionado.telefono}
                </a>
              )}
              {seleccionado.zona_interes && <p style={{ margin: "0 0 12px 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>📍 {seleccionado.zona_interes}</p>}

              {[
                { label: "Operaciones cerradas", val: seleccionado.negociosCerrados },
                { label: "Total en pipeline", val: seleccionado.negociosTotal },
                { label: "Valor gestionado", val: seleccionado.valorTotalUSD > 0 ? `USD ${fmt(seleccionado.valorTotalUSD)}` : "Sin cierres" },
                { label: "Honorarios generados", val: seleccionado.honorariosEstimados > 0 ? `USD ${fmt(seleccionado.honorariosEstimados)}` : "—" },
                { label: "Interacciones", val: seleccionado.interacciones },
                { label: "Prob. de referido", val: `${seleccionado.probabilidadReferido.toFixed(0)}%` },
                { label: "Presupuesto declarado", val: seleccionado.presupuesto_max ? `USD ${fmt(seleccionado.presupuesto_max)}` : "—" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{row.val}</span>
                </div>
              ))}

              {seleccionado.etiquetas && seleccionado.etiquetas.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {seleccionado.etiquetas.map(e => (
                    <span key={e} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>{e}</span>
                  ))}
                </div>
              )}

              {seleccionado.probabilidadReferido >= 60 && (
                <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <p style={{ margin: 0, fontSize: 11, color: "#22c55e", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>
                    🎯 Alto potencial de referido — considerar programa de beneficios
                  </p>
                </div>
              )}

              {seleccionado.notas && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Notas</p>
                  <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{seleccionado.notas}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
