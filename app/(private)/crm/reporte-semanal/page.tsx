"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string | null;
  tipo_operacion: string | null;
  created_at: string;
  updated_at: string;
}

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  created_at: string;
}

interface Interaccion {
  id: string;
  contacto_id: string;
  tipo: string;
  descripcion: string;
  created_at: string;
}

interface Tarea {
  id: string;
  titulo: string;
  estado: string;
  fecha_vencimiento: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function inicioSemana(offset = 0): Date {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=dom
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((dia === 0 ? 7 : dia) - 1) + offset * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function finSemana(inicio: Date): Date {
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

function enRango(fecha: string, desde: Date, hasta: Date): boolean {
  const d = new Date(fecha);
  return d >= desde && d <= hasta;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ReporteSemanal() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaOffset, setSemanaOffset] = useState(0); // 0=esta semana, -1=anterior, etc.
  const [tcDolar, setTcDolar] = useState(1200);
  const [honorariosPct, setHonorariosPct] = useState(3.0);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const hace90 = new Date(Date.now() - 90 * 86400000).toISOString();
      const [{ data: n }, { data: c }, { data: i }, { data: t }] = await Promise.all([
        supabase.from("crm_negocios").select("id,titulo,etapa,valor_operacion,moneda,tipo_operacion,created_at,updated_at").eq("perfil_id", user.id).gte("updated_at", hace90),
        supabase.from("crm_contactos").select("id,nombre,apellido,created_at").eq("perfil_id", user.id).gte("created_at", hace90),
        supabase.from("crm_interacciones").select("id,contacto_id,tipo,descripcion,created_at").eq("perfil_id", user.id).gte("created_at", hace90),
        supabase.from("crm_tareas").select("id,titulo,estado,fecha_vencimiento,created_at").eq("perfil_id", user.id),
      ]);
      setNegocios((n ?? []) as Negocio[]);
      setContactos((c ?? []) as Contacto[]);
      setInteracciones((i ?? []) as Interaccion[]);
      setTareas((t ?? []) as Tarea[]);
      setLoading(false);
    }
    load();
  }, []);

  const reporte = useMemo(() => {
    const inicio = inicioSemana(semanaOffset);
    const fin = finSemana(inicio);
    const inicioAnterior = inicioSemana(semanaOffset - 1);
    const finAnterior = finSemana(inicioAnterior);

    // Esta semana
    const contactosNuevos = contactos.filter(c => enRango(c.created_at, inicio, fin));
    const interaccionesSemana = interacciones.filter(i => enRango(i.created_at, inicio, fin));
    const negociosActualizados = negocios.filter(n => enRango(n.updated_at, inicio, fin));
    const negociosCerrados = negociosActualizados.filter(n => n.etapa === "cerrado");
    const negociosNuevos = negocios.filter(n => enRango(n.created_at, inicio, fin));
    const tareasCompletadas = tareas.filter(t => t.estado === "completada" && t.fecha_vencimiento && enRango(t.fecha_vencimiento, inicio, fin));
    const tareasPendientes = tareas.filter(t => t.estado !== "completada");

    // Semana anterior
    const contactosAnt = contactos.filter(c => enRango(c.created_at, inicioAnterior, finAnterior)).length;
    const interaccionesAnt = interacciones.filter(i => enRango(i.created_at, inicioAnterior, finAnterior)).length;

    // Valor cerrado
    const valorCerradoUSD = negociosCerrados.reduce((acc, n) => {
      const usd = n.moneda === "ARS" ? (n.valor_operacion ?? 0) / tcDolar : (n.valor_operacion ?? 0);
      return acc + usd;
    }, 0);
    const honorariosEstimados = valorCerradoUSD * honorariosPct / 100;

    // Pipeline total
    const pipelineUSD = negocios
      .filter(n => !["cerrado","perdido"].includes(n.etapa))
      .reduce((acc, n) => {
        const usd = n.moneda === "ARS" ? (n.valor_operacion ?? 0) / tcDolar : (n.valor_operacion ?? 0);
        return acc + usd;
      }, 0);

    // Por tipo de interacción
    const tiposInt = new Map<string, number>();
    interaccionesSemana.forEach(i => tiposInt.set(i.tipo, (tiposInt.get(i.tipo) ?? 0) + 1));

    // Variaciones
    const varContactos = contactosAnt > 0 ? ((contactosNuevos.length - contactosAnt) / contactosAnt) * 100 : 0;
    const varInteracciones = interaccionesAnt > 0 ? ((interaccionesSemana.length - interaccionesAnt) / interaccionesAnt) * 100 : 0;

    const fechaLabel = `${inicio.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${fin.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`;

    return {
      inicio, fin, fechaLabel,
      contactosNuevos: contactosNuevos.length,
      interaccionesSemana: interaccionesSemana.length,
      negociosNuevos: negociosNuevos.length,
      negociosCerrados: negociosCerrados.length,
      tareasCompletadas: tareasCompletadas.length,
      tareasPendientes: tareasPendientes.length,
      valorCerradoUSD,
      honorariosEstimados,
      pipelineUSD,
      tiposInt,
      varContactos,
      varInteracciones,
      negociosCerradosLista: negociosCerrados,
      contactosNuevosLista: contactosNuevos.slice(0, 5),
      interaccionesPorTipo: Array.from(tiposInt.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [negocios, contactos, interacciones, tareas, semanaOffset, tcDolar, honorariosPct]);

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    const { fechaLabel } = reporte;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte Semanal CRM</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;max-width:750px}h1{font-size:20px}h3{font-size:13px;margin:14px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px}.kpi{display:inline-block;margin:6px;padding:10px 14px;background:#f5f5f5;border-radius:6px;text-align:center;min-width:100px}table{width:100%;border-collapse:collapse;margin:10px 0}th{background:#f0f0f0;padding:6px;font-size:10px;text-align:left}td{padding:6px;border-bottom:1px solid #f5f5f5;font-size:11px}</style>
    </head><body>
    <h1>Reporte Semanal CRM</h1>
    <p>${fechaLabel}</p>
    <div>
      <span class="kpi"><b>${reporte.contactosNuevos}</b><br><small>Nuevos contactos</small></span>
      <span class="kpi"><b>${reporte.interaccionesSemana}</b><br><small>Interacciones</small></span>
      <span class="kpi"><b>${reporte.negociosNuevos}</b><br><small>Negocios abiertos</small></span>
      <span class="kpi"><b>${reporte.negociosCerrados}</b><br><small>Operaciones cerradas</small></span>
      <span class="kpi"><b>USD ${fmt(reporte.honorariosEstimados)}</b><br><small>Honorarios est.</small></span>
    </div>
    ${reporte.negociosCerradosLista.length > 0 ? `<h3>Operaciones Cerradas</h3><table><tr><th>Negocio</th><th>Tipo</th><th>Valor</th></tr>${reporte.negociosCerradosLista.map(n => `<tr><td>${n.titulo}</td><td>${n.tipo_operacion ?? "—"}</td><td>${n.moneda} ${fmt(n.valor_operacion ?? 0)}</td></tr>`).join("")}</table>` : ""}
    <h3>Actividad por tipo</h3>
    <table><tr><th>Tipo</th><th>Cantidad</th></tr>${reporte.interaccionesPorTipo.map(([tipo, cant]) => `<tr><td>${tipo}</td><td>${cant}</td></tr>`).join("")}</table>
    <p style="font-size:10px;color:#999;margin-top:20px">Generado ${new Date().toLocaleDateString("es-AR")}</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif" }}>Generando reporte...</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← CRM</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Reporte Semanal
        </h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setSemanaOffset(s => s - 1)} style={{ padding: "5px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer" }}>◀</button>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", minWidth: 160, textAlign: "center" }}>{reporte.fechaLabel}</span>
          <button onClick={() => setSemanaOffset(s => Math.min(0, s + 1))} style={{ padding: "5px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: semanaOffset === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", fontSize: 14, cursor: semanaOffset === 0 ? "default" : "pointer" }}>▶</button>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>TC: $</span>
          <input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} style={{ width: 75, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "#fff", padding: "4px 7px", fontSize: 11 }} />
          <input type="number" step="0.5" value={honorariosPct} onChange={e => setHonorariosPct(+e.target.value)} style={{ width: 50, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "#fff", padding: "4px 7px", fontSize: 11 }} />
          <button onClick={exportarPDF} style={{ padding: "5px 14px", borderRadius: 8, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>PDF</button>
        </div>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        {/* KPIs principales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Nuevos contactos", val: reporte.contactosNuevos, var: reporte.varContactos, color: "#3b82f6" },
            { label: "Interacciones", val: reporte.interaccionesSemana, var: reporte.varInteracciones, color: "#f97316" },
            { label: "Negocios abiertos", val: reporte.negociosNuevos, color: "#a78bfa" },
            { label: "Operaciones cerradas", val: reporte.negociosCerrados, color: "#22c55e" },
            { label: "Honorarios est.", val: `USD ${fmt(reporte.honorariosEstimados)}`, color: "#cc0000" },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 6px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{kpi.label}</p>
              <p style={{ margin: 0, fontSize: 24, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
              {"var" in kpi && kpi.var !== undefined && (
                <p style={{ margin: "4px 0 0 0", fontSize: 10, color: kpi.var >= 0 ? "#22c55e" : "#cc0000" }}>
                  {kpi.var >= 0 ? "▲" : "▼"} {Math.abs(kpi.var).toFixed(0)}% vs sem. ant.
                </p>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Operaciones cerradas */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "#22c55e", letterSpacing: "0.08em", textTransform: "uppercase" }}>✅ Operaciones Cerradas</span>
              <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>USD {fmt(reporte.valorCerradoUSD)}</span>
            </div>
            {reporte.negociosCerradosLista.length === 0 ? (
              <p style={{ padding: "24px 18px", color: "rgba(255,255,255,0.2)", fontSize: 12, margin: 0, textAlign: "center" }}>Sin cierres esta semana</p>
            ) : reporte.negociosCerradosLista.map(n => (
              <div key={n.id} style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{n.titulo}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{n.tipo_operacion ?? "—"}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>{n.moneda} {fmt(n.valor_operacion ?? 0)}</span>
              </div>
            ))}
          </div>

          {/* Nuevos contactos */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "#3b82f6", letterSpacing: "0.08em", textTransform: "uppercase" }}>👤 Nuevos Contactos</span>
            </div>
            {reporte.contactosNuevosLista.length === 0 ? (
              <p style={{ padding: "24px 18px", color: "rgba(255,255,255,0.2)", fontSize: 12, margin: 0, textAlign: "center" }}>Sin nuevos contactos esta semana</p>
            ) : reporte.contactosNuevosLista.map(c => (
              <div key={c.id} style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.nombre} {c.apellido}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{new Date(c.created_at).toLocaleDateString("es-AR")}</span>
              </div>
            ))}
          </div>

          {/* Actividad por tipo */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Actividad por Tipo</p>
            {reporte.interaccionesPorTipo.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, margin: 0, textAlign: "center" }}>Sin interacciones esta semana</p>
            ) : reporte.interaccionesPorTipo.map(([tipo, cant]) => {
              const maxCant = reporte.interaccionesPorTipo[0][1];
              return (
                <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, width: 100, color: "rgba(255,255,255,0.6)", textTransform: "capitalize" }}>{tipo}</span>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(cant / maxCant) * 100}%`, background: "#f97316", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, width: 24, textAlign: "right" }}>{cant}</span>
                </div>
              );
            })}
          </div>

          {/* Pipeline y tareas */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Estado del Pipeline</p>
            {[
              { label: "Valor total en pipeline", val: `USD ${fmt(reporte.pipelineUSD)}`, color: "#a78bfa" },
              { label: "Tareas completadas (sem.)", val: reporte.tareasCompletadas, color: "#22c55e" },
              { label: "Tareas pendientes", val: reporte.tareasPendientes, color: reporte.tareasPendientes > 10 ? "#cc0000" : "#f97316" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{row.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", color: row.color }}>{row.val}</span>
              </div>
            ))}

            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                {reporte.negociosCerrados > 0
                  ? `🎉 ¡Buena semana! ${reporte.negociosCerrados} operación${reporte.negociosCerrados !== 1 ? "es" : ""} cerrada${reporte.negociosCerrados !== 1 ? "s" : ""}.`
                  : reporte.interaccionesSemana > 5
                  ? "📞 Semana activa en contactos. Mantener el ritmo para cierres próximos."
                  : "💡 Semana tranquila. Considerar reactivar contactos tibios."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
