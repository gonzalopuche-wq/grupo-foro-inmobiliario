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
  updated_at: string;
  created_at: string;
}

interface Interaccion {
  id: string;
  contacto_id: string;
  tipo: string;
  created_at: string;
}

interface ContactoAnalizado extends Contacto {
  ultimaInteraccion: string | null;
  diasSinContacto: number;
  totalInteracciones: number;
  riesgo: "frio" | "tibio" | "caliente" | "inactivo";
  score: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function diasDesde(fecha: string | null): number {
  if (!fecha) return 9999;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

function riesgoColor(r: ContactoAnalizado["riesgo"]) {
  return r === "caliente" ? "#3abab6" : r === "tibio" ? "#d4960c" : r === "frio" ? "#990000" : "var(--gfi-text-dim)";
}

function riesgoLabel(r: ContactoAnalizado["riesgo"]) {
  return r === "caliente" ? "Al día" : r === "tibio" ? "Tibio" : r === "frio" ? "En riesgo" : "Inactivo";
}

function riesgoIcon(r: ContactoAnalizado["riesgo"]) {
  return r === "caliente" ? "🟢" : r === "tibio" ? "🟡" : r === "frio" ? "🔴" : "⚫";
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function Retencion() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroRiesgo, setFiltroRiesgo] = useState<"todos"|"frio"|"tibio"|"caliente"|"inactivo">("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [ordenar, setOrdenar] = useState<"riesgo"|"dias"|"interacciones">("riesgo");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: c }, { data: i }] = await Promise.all([
        supabase.from("crm_contactos").select("id,nombre,apellido,telefono,email,tipo,estado,updated_at,created_at").eq("perfil_id", user.id).neq("estado", "archivado"),
        supabase.from("crm_interacciones").select("id,contacto_id,tipo,created_at").eq("perfil_id", user.id).order("created_at", { ascending: false }),
      ]);
      setContactos((c ?? []) as Contacto[]);
      setInteracciones((i ?? []) as Interaccion[]);
      setLoading(false);
    }
    load();
  }, []);

  const analizados = useMemo((): ContactoAnalizado[] => {
    // Agrupar interacciones por contacto
    const porContacto = new Map<string, Interaccion[]>();
    interacciones.forEach(i => {
      const arr = porContacto.get(i.contacto_id) ?? [];
      arr.push(i);
      porContacto.set(i.contacto_id, arr);
    });

    return contactos.map(c => {
      const ints = porContacto.get(c.id) ?? [];
      const ultima = ints.length > 0 ? ints[0].created_at : null;
      const dias = diasDesde(ultima ?? c.updated_at);
      const total = ints.length;

      let riesgo: ContactoAnalizado["riesgo"];
      if (dias <= 14) riesgo = "caliente";
      else if (dias <= 45) riesgo = "tibio";
      else if (dias <= 120) riesgo = "frio";
      else riesgo = "inactivo";

      // score: menor días sin contacto = mejor, más interacciones = mejor
      const score = Math.max(0, 100 - dias * 0.5) + Math.min(30, total * 2);

      return { ...c, ultimaInteraccion: ultima, diasSinContacto: dias, totalInteracciones: total, riesgo, score };
    });
  }, [contactos, interacciones]);

  const tipos = useMemo(() => Array.from(new Set(contactos.map(c => c.tipo).filter(Boolean) as string[])), [contactos]);

  const filtrados = useMemo(() => {
    let arr = analizados;
    if (filtroRiesgo !== "todos") arr = arr.filter(c => c.riesgo === filtroRiesgo);
    if (filtroTipo !== "todos") arr = arr.filter(c => c.tipo === filtroTipo);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      arr = arr.filter(c => `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q));
    }
    arr = [...arr].sort((a, b) => {
      if (ordenar === "riesgo") {
        const orden = { frio: 0, tibio: 1, inactivo: 2, caliente: 3 };
        return orden[a.riesgo] - orden[b.riesgo];
      }
      if (ordenar === "dias") return b.diasSinContacto - a.diasSinContacto;
      return b.totalInteracciones - a.totalInteracciones;
    });
    return arr;
  }, [analizados, filtroRiesgo, filtroTipo, busqueda, ordenar]);

  const stats = useMemo(() => ({
    caliente: analizados.filter(c => c.riesgo === "caliente").length,
    tibio: analizados.filter(c => c.riesgo === "tibio").length,
    frio: analizados.filter(c => c.riesgo === "frio").length,
    inactivo: analizados.filter(c => c.riesgo === "inactivo").length,
    total: analizados.length,
  }), [analizados]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "var(--gfi-text-muted)", fontFamily: "var(--font-body)" }}>Cargando retención...</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "var(--font-body)" }}>
      {/* Header */}
      <div style={{ background: "var(--gfi-bg-secondary)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "var(--gfi-text-muted)", textDecoration: "none", fontSize: 12 }}>← CRM</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Retención de Clientes
        </h1>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--gfi-text-muted)" }}>{stats.total} contactos activos</span>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Al día", count: stats.caliente, color: "#3abab6", desc: "≤14 días", riesgo: "caliente" as const },
            { label: "Tibios", count: stats.tibio, color: "#d4960c", desc: "15–45 días", riesgo: "tibio" as const },
            { label: "En riesgo", count: stats.frio, color: "#990000", desc: "46–120 días", riesgo: "frio" as const },
            { label: "Inactivos", count: stats.inactivo, color: "var(--gfi-text-dim)", desc: "+120 días", riesgo: "inactivo" as const },
          ].map(kpi => (
            <div key={kpi.label} onClick={() => setFiltroRiesgo(filtroRiesgo === kpi.riesgo ? "todos" : kpi.riesgo)} style={{ background: filtroRiesgo === kpi.riesgo ? `${kpi.color}11` : "var(--gfi-bg-secondary)", border: `1px solid ${filtroRiesgo === kpi.riesgo ? kpi.color + "44" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: "16px 20px", cursor: "pointer", transition: "all 0.15s" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: 9, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{kpi.label}</p>
              <p style={{ margin: 0, fontSize: 32, fontFamily: "var(--font-display)", fontWeight: 800, color: kpi.color }}>{kpi.count}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "var(--gfi-text-muted)" }}>{kpi.desc}</p>
            </div>
          ))}
        </div>

        {/* Barra de retención */}
        <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Salud del pipeline de clientes</span>
            <span style={{ fontSize: 11, color: stats.caliente / Math.max(stats.total, 1) > 0.5 ? "#3abab6" : "#990000", fontWeight: 700 }}>
              {((stats.caliente + stats.tibio) / Math.max(stats.total, 1) * 100).toFixed(0)}% activos
            </span>
          </div>
          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 1 }}>
            {stats.total > 0 && [
              { v: stats.caliente, c: "#3abab6" },
              { v: stats.tibio, c: "#d4960c" },
              { v: stats.frio, c: "#990000" },
              { v: stats.inactivo, c: "var(--gfi-border)" },
            ].map((seg, i) => seg.v > 0 && (
              <div key={i} style={{ flex: seg.v, background: seg.c, transition: "flex 0.5s" }} />
            ))}
          </div>
        </div>

        {/* Controles */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Buscar contacto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ flex: 1, minWidth: 180, background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 8, color: "#fff", padding: "7px 12px", fontFamily: "var(--font-body)", fontSize: 13 }}
          />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 8, color: "var(--gfi-text-primary)", padding: "7px 10px", fontFamily: "var(--font-body)", fontSize: 12 }}>
            <option value="todos">Todos los tipos</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ display: "flex", gap: 6 }}>
            {(["riesgo","dias","interacciones"] as const).map(o => (
              <button key={o} onClick={() => setOrdenar(o)} style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${ordenar === o ? "rgba(153,0,0,0.5)" : "var(--gfi-border)"}`, background: ordenar === o ? "rgba(153,0,0,0.12)" : "transparent", color: ordenar === o ? "#990000" : "var(--gfi-text-muted)", fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {o === "riesgo" ? "Por riesgo" : o === "dias" ? "Por días" : "Interacciones"}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--gfi-bg-card)" }}>
                {["Estado", "Contacto", "Tipo", "Último contacto", "Días sin contacto", "Interacciones", "Score", "Acción"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: h === "Contacto" || h === "Acción" ? "left" : "center", fontSize: 9, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid var(--gfi-border-subtle)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--gfi-text-dim)", fontSize: 13 }}>Sin resultados</td></tr>
              ) : filtrados.map((c, idx) => (
                <tr key={c.id} style={{ background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", borderLeft: `2px solid ${riesgoColor(c.riesgo)}22` }}>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 16 }}>{riesgoIcon(c.riesgo)}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre} {c.apellido}</div>
                    {c.email && <div style={{ fontSize: 10, color: "var(--gfi-text-muted)" }}>{c.email}</div>}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "var(--gfi-text-secondary)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                      {c.tipo ?? "—"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--gfi-text-muted)" }}>
                    {c.ultimaInteraccion ? new Date(c.ultimaInteraccion).toLocaleDateString("es-AR") : "Nunca"}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: riesgoColor(c.riesgo) }}>
                      {c.diasSinContacto === 9999 ? "∞" : c.diasSinContacto + "d"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, color: "var(--gfi-text-secondary)" }}>{c.totalInteracciones}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                      <div style={{ width: 30, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, c.score)}%`, background: riesgoColor(c.riesgo), borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: "var(--gfi-text-muted)" }}>{c.score.toFixed(0)}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 10, color: riesgoColor(c.riesgo), fontFamily: "var(--font-display)", fontWeight: 700 }}>
                      {c.riesgo === "caliente" ? "Mantener" :
                       c.riesgo === "tibio" ? "Contactar pronto" :
                       c.riesgo === "frio" ? "URGENTE" : "Reactivar"}
                    </span>
                    {c.telefono && (
                      <a href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 9, color: "#3abab6", textDecoration: "none", marginTop: 2 }}>💬 WhatsApp</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tip re-engagement */}
        {stats.frio + stats.inactivo > 0 && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: "rgba(153,0,0,0.06)", border: "1px solid rgba(153,0,0,0.15)" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--gfi-text-primary)", lineHeight: 1.6 }}>
              <strong style={{ color: "#990000" }}>⚡ {stats.frio + stats.inactivo} contactos requieren atención.</strong>{" "}
              Considera enviar un mensaje de re-engagement: actualizaciones de mercado, nuevas propiedades en su zona de interés, o simplemente un check-in. El contacto proactivo aumenta la tasa de conversión en un 40%.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
