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
  interes: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: string | null;
  zona_interes: string | null;
  estado: string | null;
  etiquetas: string[] | null;
}

interface Propiedad {
  id: string;
  titulo: string;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string;
  zona: string | null;
  ciudad: string | null;
  dormitorios: number | null;
  ambientes: number | null;
  superficie_cubierta: number | null;
  estado: string;
  apto_credito: boolean;
  con_cochera: boolean;
}

interface MatchResult {
  contacto: Contacto;
  propiedad: Propiedad;
  score: number;
  motivos: string[];
  alertas: string[];
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function normalizar(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function zonasSolapan(zonaContacto: string | null, zonaProp: string | null, ciudadProp: string | null): number {
  if (!zonaContacto) return 0;
  const zc = normalizar(zonaContacto);
  const zp = normalizar(zonaProp ?? "");
  const cp = normalizar(ciudadProp ?? "");
  const palabrasContacto = zc.split(" ").filter(p => p.length > 2);
  if (palabrasContacto.length === 0) return 0;
  let hits = 0;
  for (const p of palabrasContacto) {
    if (zp.includes(p) || cp.includes(p)) hits++;
  }
  return hits / palabrasContacto.length;
}

function interesMatchTipo(interes: string | null, tipo: string): number {
  if (!interes) return 0.5; // neutral
  const i = normalizar(interes);
  const t = normalizar(tipo);
  const TIPOS: Record<string, string[]> = {
    departamento: ["depto", "departamento", "dpto", "piso", "monoambiente", "studio"],
    casa: ["casa", "chalet", "quinta", "petit hotel"],
    ph: ["ph"],
    local: ["local", "comercial", "galpon", "galpón", "bodega"],
    oficina: ["oficina", "consultorio"],
    terreno: ["terreno", "lote", "campo", "tierra"],
  };
  for (const [key, sinonimos] of Object.entries(TIPOS)) {
    const keyN = normalizar(key);
    if (keyN === t || sinonimos.some(s => t.includes(s))) {
      // tipo de la propiedad identificado
      if (sinonimos.some(s => i.includes(s)) || i.includes(keyN)) return 1;
      // interes menciona otro tipo
      for (const [k2, sins2] of Object.entries(TIPOS)) {
        if (k2 !== key && (i.includes(normalizar(k2)) || sins2.some(s => i.includes(s)))) return 0;
      }
      return 0.5;
    }
  }
  return 0.5;
}

function operacionMatch(interes: string | null, operacion: string): number {
  if (!interes) return 0.5;
  const i = normalizar(interes);
  const o = normalizar(operacion);
  const VENTA = ["compra", "comprar", "venta", "adquirir", "adquisicion"];
  const ALQUILER = ["alquiler", "alquilar", "renta", "locacion", "arrendar"];
  const wantsVenta = VENTA.some(v => i.includes(v));
  const wantsAlquiler = ALQUILER.some(v => i.includes(v));
  const isVenta = o === "venta";
  const isAlquiler = ["alquiler", "locacion", "alquiler_temporal"].includes(o);
  if (wantsVenta && isVenta) return 1;
  if (wantsAlquiler && isAlquiler) return 1;
  if (wantsVenta && isAlquiler) return 0;
  if (wantsAlquiler && isVenta) return 0;
  return 0.5;
}

function precioFit(presupuestoMax: number | null, precio: number | null, monedaC: string | null, monedaP: string): number {
  if (!presupuestoMax || !precio) return 0.5;
  // Solo comparamos misma moneda (simplificado)
  if ((monedaC ?? "USD").toUpperCase() !== monedaP.toUpperCase()) return 0.5;
  const ratio = precio / presupuestoMax;
  if (ratio <= 1.0) return 1.0;       // dentro del presupuesto
  if (ratio <= 1.10) return 0.75;     // 10% sobre — negociable
  if (ratio <= 1.20) return 0.40;     // 20% sobre — difícil
  return 0;                            // muy fuera
}

function calcularScore(c: Contacto, p: Propiedad): { score: number; motivos: string[]; alertas: string[] } {
  const motivos: string[] = [];
  const alertas: string[] = [];
  let score = 0;

  // Precio (40 pts)
  const pf = precioFit(c.presupuesto_max, p.precio, c.moneda, p.moneda);
  score += pf * 40;
  if (pf === 1) motivos.push("Precio dentro del presupuesto");
  else if (pf >= 0.75) { motivos.push("Precio ~10% sobre presupuesto (negociable)"); alertas.push("Precio levemente elevado"); }
  else if (pf >= 0.4) alertas.push("Precio 20% sobre presupuesto");
  else if (pf === 0 && c.presupuesto_max && p.precio) alertas.push("Precio muy por encima del presupuesto");

  // Zona (30 pts)
  const zs = zonasSolapan(c.zona_interes, p.zona, p.ciudad);
  score += zs * 30;
  if (zs >= 0.8) motivos.push("Zona exacta");
  else if (zs >= 0.4) motivos.push("Zona parcialmente coincidente");
  else if (zs > 0) alertas.push("Zona con baja coincidencia");
  else if (c.zona_interes) alertas.push("Zona no coincide");

  // Tipo (20 pts)
  const tm = interesMatchTipo(c.interes, p.tipo);
  score += tm * 20;
  if (tm === 1) motivos.push("Tipo de propiedad coincide");
  else if (tm === 0) alertas.push("Tipo de propiedad no coincide");

  // Operación (10 pts)
  const om = operacionMatch(c.interes, p.operacion);
  score += om * 10;
  if (om === 1) motivos.push("Operación coincide (compra/alquiler)");
  else if (om === 0) alertas.push("Operación no coincide");

  return { score: Math.round(score), motivos, alertas };
}

const scoreColor = (s: number) => s >= 75 ? "#22c55e" : s >= 50 ? "#f59e0b" : s >= 30 ? "#f97316" : "#6b7280";
const scoreLabel = (s: number) => s >= 75 ? "Excelente" : s >= 50 ? "Bueno" : s >= 30 ? "Posible" : "Débil";

// ── Componente ───────────────────────────────────────────────────────────────

export default function SmartMatch() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroScore, setFiltroScore] = useState<number>(40);
  const [filtroContacto, setFiltroContacto] = useState<string>("");
  const [vista, setVista] = useState<"por-contacto" | "por-prop">("por-contacto");
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("crm_contactos").select("id,nombre,apellido,telefono,email,interes,presupuesto_min,presupuesto_max,moneda,zona_interes,estado,etiquetas").eq("estado", "activo"),
        supabase.from("cartera_propiedades").select("id,titulo,operacion,tipo,precio,moneda,zona,ciudad,dormitorios,ambientes,superficie_cubierta,estado,apto_credito,con_cochera").eq("estado", "activa"),
      ]);
      setContactos((c ?? []) as Contacto[]);
      setPropiedades((p ?? []) as Propiedad[]);
      setLoading(false);
    }
    load();
  }, []);

  const matches = useMemo<MatchResult[]>(() => {
    const result: MatchResult[] = [];
    for (const c of contactos) {
      if (filtroContacto && !`${c.nombre} ${c.apellido}`.toLowerCase().includes(filtroContacto.toLowerCase())) continue;
      for (const p of propiedades) {
        const { score, motivos, alertas } = calcularScore(c, p);
        if (score >= filtroScore) {
          result.push({ contacto: c, propiedad: p, score, motivos, alertas });
        }
      }
    }
    return result.sort((a, b) => b.score - a.score);
  }, [contactos, propiedades, filtroScore, filtroContacto]);

  // Agrupar por contacto
  const porContacto = useMemo(() => {
    const map = new Map<string, { contacto: Contacto; matches: MatchResult[] }>();
    for (const m of matches) {
      const key = m.contacto.id;
      if (!map.has(key)) map.set(key, { contacto: m.contacto, matches: [] });
      map.get(key)!.matches.push(m);
    }
    return Array.from(map.values()).sort((a, b) => b.matches[0].score - a.matches[0].score);
  }, [matches]);

  // Agrupar por propiedad
  const porPropiedad = useMemo(() => {
    const map = new Map<string, { propiedad: Propiedad; matches: MatchResult[] }>();
    for (const m of matches) {
      const key = m.propiedad.id;
      if (!map.has(key)) map.set(key, { propiedad: m.propiedad, matches: [] });
      map.get(key)!.matches.push(m);
    }
    return Array.from(map.values()).sort((a, b) => b.matches.length - a.matches.length);
  }, [matches]);

  const cardStyle: React.CSSProperties = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "16px 18px",
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>Analizando matches…</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Smart Match</h1>
        <span style={{ background: "#22c55e", color: "#000", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>AUTOMÁTICO</span>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>
        Cruza {contactos.length} contactos activos con {propiedades.length} propiedades disponibles
      </div>

      {/* KPIs y filtros */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "Matches totales", val: matches.length, color: "#22c55e" },
          { label: "Excelentes (≥75)", val: matches.filter(m => m.score >= 75).length, color: "#22c55e" },
          { label: "Buenos (50-74)", val: matches.filter(m => m.score >= 50 && m.score < 75).length, color: "#f59e0b" },
          { label: "Contactos con match", val: porContacto.length, color: "#3b82f6" },
          { label: "Props con demanda", val: porPropiedad.length, color: "#a78bfa" },
        ].map((k, i) => (
          <div key={i} style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{k.label}</div>
          </div>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>Score mínimo: {filtroScore}</div>
            <input type="range" min={20} max={90} step={5} value={filtroScore} onChange={e => setFiltroScore(Number(e.target.value))}
              style={{ width: 120, accentColor: "#cc0000" }} />
          </div>
          <input
            placeholder="Filtrar contacto…"
            value={filtroContacto}
            onChange={e => setFiltroContacto(e.target.value)}
            style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 12, padding: "7px 10px" }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {(["por-contacto", "por-prop"] as const).map(v => (
              <button key={v} onClick={() => setVista(v)} style={{ background: vista === v ? "rgba(204,0,0,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${vista === v ? "rgba(204,0,0,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: vista === v ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 11, padding: "6px 12px", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                {v === "por-contacto" ? "Por Contacto" : "Por Propiedad"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
            Sin matches con score ≥ {filtroScore}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            Bajá el score mínimo o completá presupuesto/zona/interés en los contactos
          </div>
        </div>
      ) : vista === "por-contacto" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {porContacto.map(({ contacto, matches: ms }) => {
            const key = contacto.id;
            const isOpen = expandido === key;
            const best = ms[0].score;
            return (
              <div key={key} style={{ ...cardStyle, borderColor: best >= 75 ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setExpandido(isOpen ? null : key)}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: scoreColor(best) + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 800, color: scoreColor(best) }}>{best}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 700 }}>{contacto.nombre} {contacto.apellido}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {contacto.interes ? `Busca: ${contacto.interes}` : "Sin interés definido"}
                      {contacto.zona_interes ? ` · Zona: ${contacto.zona_interes}` : ""}
                      {contacto.presupuesto_max ? ` · Max: ${contacto.moneda ?? "USD"} ${contacto.presupuesto_max.toLocaleString("es-AR")}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ background: scoreColor(best) + "22", color: scoreColor(best), fontSize: 10, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "3px 9px", borderRadius: 4 }}>{scoreLabel(best)}</span>
                    <span style={{ background: "#111", color: "rgba(255,255,255,0.5)", fontSize: 11, padding: "3px 9px", borderRadius: 4 }}>{ms.length} match{ms.length > 1 ? "es" : ""}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Acciones rápidas */}
                    <div style={{ display: "flex", gap: 8 }}>
                      {contacto.telefono && (
                        <a href={`https://wa.me/${contacto.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener"
                          style={{ background: "#22c55e22", border: "1px solid #22c55e44", color: "#22c55e", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "5px 12px", borderRadius: 5, textDecoration: "none" }}>
                          WhatsApp
                        </a>
                      )}
                      {contacto.email && (
                        <a href={`mailto:${contacto.email}`}
                          style={{ background: "#3b82f622", border: "1px solid #3b82f644", color: "#3b82f6", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "5px 12px", borderRadius: 5, textDecoration: "none" }}>
                          Email
                        </a>
                      )}
                      <Link href={`/crm/contactos/${contacto.id}`}
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "5px 12px", borderRadius: 5, textDecoration: "none" }}>
                        Ver ficha
                      </Link>
                    </div>

                    {ms.map((m, mi) => (
                      <div key={mi} style={{ background: "#111", borderRadius: 8, padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, background: scoreColor(m.score) + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 800, color: scoreColor(m.score) }}>{m.score}</span>
                            </div>
                            <div>
                              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700 }}>{m.propiedad.titulo}</div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                                {m.propiedad.operacion} · {m.propiedad.tipo}
                                {m.propiedad.zona ? ` · ${m.propiedad.zona}` : ""}
                                {m.propiedad.precio ? ` · ${m.propiedad.moneda} ${m.propiedad.precio.toLocaleString("es-AR")}` : ""}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {m.motivos.map((mot, k) => (
                              <span key={k} style={{ background: "#22c55e18", color: "#22c55e", fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>✓ {mot}</span>
                            ))}
                            {m.alertas.map((al, k) => (
                              <span key={k} style={{ background: "#f59e0b18", color: "#f59e0b", fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>⚠ {al}</span>
                            ))}
                          </div>
                        </div>
                        <Link href={`/crm/cartera/ficha/${m.propiedad.id}`}
                          style={{ alignSelf: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 11, padding: "5px 10px", borderRadius: 5, textDecoration: "none", whiteSpace: "nowrap" }}>
                          Ver prop ↗
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {porPropiedad.map(({ propiedad, matches: ms }) => {
            const key = propiedad.id;
            const isOpen = expandido === key;
            const best = Math.max(...ms.map(m => m.score));
            return (
              <div key={key} style={{ ...cardStyle, borderColor: best >= 75 ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setExpandido(isOpen ? null : key)}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#3b82f622", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 800, color: "#3b82f6" }}>{ms.length}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 700 }}>{propiedad.titulo}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {propiedad.operacion} · {propiedad.tipo}
                      {propiedad.zona ? ` · ${propiedad.zona}` : ""}
                      {propiedad.precio ? ` · ${propiedad.moneda} ${propiedad.precio.toLocaleString("es-AR")}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ background: "#3b82f622", color: "#3b82f6", fontSize: 10, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "3px 9px", borderRadius: 4 }}>{ms.length} interesado{ms.length > 1 ? "s" : ""}</span>
                    <span style={{ background: scoreColor(best) + "22", color: scoreColor(best), fontSize: 10, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "3px 9px", borderRadius: 4 }}>mejor: {best}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {ms.map((m, mi) => (
                      <div key={mi} style={{ background: "#111", borderRadius: 8, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: scoreColor(m.score) + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 800, color: scoreColor(m.score) }}>{m.score}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700 }}>{m.contacto.nombre} {m.contacto.apellido}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                            {m.contacto.interes ?? "Sin interés definido"}
                            {m.contacto.presupuesto_max ? ` · Max: ${m.contacto.moneda ?? "USD"} ${m.contacto.presupuesto_max.toLocaleString("es-AR")}` : ""}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                            {m.motivos.map((mot, k) => (
                              <span key={k} style={{ background: "#22c55e18", color: "#22c55e", fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>✓ {mot}</span>
                            ))}
                            {m.alertas.map((al, k) => (
                              <span key={k} style={{ background: "#f59e0b18", color: "#f59e0b", fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>⚠ {al}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {m.contacto.telefono && (
                            <a href={`https://wa.me/${m.contacto.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener"
                              style={{ background: "#22c55e22", border: "1px solid #22c55e44", color: "#22c55e", fontSize: 10, padding: "4px 9px", borderRadius: 5, textDecoration: "none" }}>
                              WA
                            </a>
                          )}
                          <Link href={`/crm/contactos/${m.contacto.id}`}
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 10, padding: "4px 9px", borderRadius: 5, textDecoration: "none" }}>
                            Ficha ↗
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
