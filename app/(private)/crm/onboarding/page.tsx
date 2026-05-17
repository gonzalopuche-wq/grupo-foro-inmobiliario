"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface TareaOnboarding {
  id: string;
  grupo: string;
  titulo: string;
  descripcion: string;
  prioridad: "alta" | "media" | "baja";
  responsable: "corredor" | "vendedor" | "administracion";
  plazo: string; // "día 1", "semana 1", etc.
}

// ── Checklist base ────────────────────────────────────────────────────────────

const TAREAS_BASE: TareaOnboarding[] = [
  // Documentación
  { id: "t1", grupo: "Documentación", titulo: "Fotocopia DNI propietario(s)", descripcion: "Frente y dorso vigente. Si hay varios titulares, de todos.", prioridad: "alta", responsable: "vendedor", plazo: "Día 1" },
  { id: "t2", grupo: "Documentación", titulo: "Título de propiedad o escritura", descripcion: "Copia completa o acceso al original para verificar dominio.", prioridad: "alta", responsable: "vendedor", plazo: "Día 1" },
  { id: "t3", grupo: "Documentación", titulo: "Plano de mensura / subdivisión", descripcion: "Plano registrado en catastro o registro de la propiedad.", prioridad: "alta", responsable: "vendedor", plazo: "Semana 1" },
  { id: "t4", grupo: "Documentación", titulo: "Reglamento de copropiedad (PH)", descripcion: "Solo para propiedades horizontales. Verificar restricciones.", prioridad: "media", responsable: "vendedor", plazo: "Semana 1" },
  { id: "t5", grupo: "Documentación", titulo: "Últimas boletas ABL / ARBA", descripcion: "Mínimo 3 boletas. Verificar deuda pendiente.", prioridad: "alta", responsable: "vendedor", plazo: "Día 1" },
  { id: "t6", grupo: "Documentación", titulo: "Expensas últimos 6 meses", descripcion: "Liquidaciones de administración. Detectar deuda o juicio.", prioridad: "alta", responsable: "vendedor", plazo: "Día 1" },
  { id: "t7", grupo: "Documentación", titulo: "Últimas boletas servicios", descripcion: "Gas, luz, agua. Verificar deuda y titularidad.", prioridad: "media", responsable: "vendedor", plazo: "Semana 1" },
  { id: "t8", grupo: "Documentación", titulo: "Inhibiciones y anotaciones (RPBA)", descripcion: "Informe de inhibiciones del/los titular(es).", prioridad: "alta", responsable: "corredor", plazo: "Semana 1" },

  // Tasación y precio
  { id: "t9", grupo: "Tasación y Precio", titulo: "Tasación formal del inmueble", descripcion: "Comparativa de valores de mercado zona / m².", prioridad: "alta", responsable: "corredor", plazo: "Día 1" },
  { id: "t10", grupo: "Tasación y Precio", titulo: "Definición de precio de publicación", descripcion: "Acordar precio inicial con el propietario.", prioridad: "alta", responsable: "corredor", plazo: "Día 1" },
  { id: "t11", grupo: "Tasación y Precio", titulo: "Precio mínimo de cierre acordado", descripcion: "Piso de negociación definido y documentado.", prioridad: "alta", responsable: "corredor", plazo: "Día 1" },
  { id: "t12", grupo: "Tasación y Precio", titulo: "Contrato de captación firmado", descripcion: "Exclusividad, honorarios, plazo, condiciones.", prioridad: "alta", responsable: "administracion", plazo: "Día 1" },

  // Marketing
  { id: "t13", grupo: "Marketing", titulo: "Fotografías profesionales", descripcion: "Mínimo 15 fotos. Gran angular, buena iluminación, orden.", prioridad: "alta", responsable: "corredor", plazo: "Semana 1" },
  { id: "t14", grupo: "Marketing", titulo: "Video / recorrido virtual 360°", descripcion: "Opcional pero recomendado para propiedades +USD 150k.", prioridad: "baja", responsable: "corredor", plazo: "Semana 1" },
  { id: "t15", grupo: "Marketing", titulo: "Plano de distribución (si hay)", descripcion: "Plano acotado de la propiedad para publicación.", prioridad: "media", responsable: "vendedor", plazo: "Semana 1" },
  { id: "t16", grupo: "Marketing", titulo: "Publicación en portales principales", descripcion: "ZonaProp, Argenprop, MercadoLibre, portal propio.", prioridad: "alta", responsable: "corredor", plazo: "Semana 1" },
  { id: "t17", grupo: "Marketing", titulo: "Cartel en propiedad", descripcion: "Cartel actualizado con datos de contacto vigentes.", prioridad: "media", responsable: "corredor", plazo: "Semana 1" },
  { id: "t18", grupo: "Marketing", titulo: "Difusión en redes sociales", descripcion: "Instagram, Facebook, WhatsApp status. Primeras 48hs.", prioridad: "media", responsable: "corredor", plazo: "Semana 1" },

  // Inspección
  { id: "t19", grupo: "Inspección Técnica", titulo: "Visita de inspección presencial", descripcion: "Recorrido completo. Registrar estado de ambientes.", prioridad: "alta", responsable: "corredor", plazo: "Día 1" },
  { id: "t20", grupo: "Inspección Técnica", titulo: "Verificar instalación eléctrica", descripcion: "Tablero, cableado visible, disyuntores.", prioridad: "alta", responsable: "corredor", plazo: "Día 1" },
  { id: "t21", grupo: "Inspección Técnica", titulo: "Verificar instalación de gas", descripcion: "Conexiones, calefón, cocina. Detectar irregularidades.", prioridad: "alta", responsable: "corredor", plazo: "Día 1" },
  { id: "t22", grupo: "Inspección Técnica", titulo: "Estado de humedad / filtraciones", descripcion: "Revisión de paredes, techos, sótanos, terrazas.", prioridad: "alta", responsable: "corredor", plazo: "Día 1" },
  { id: "t23", grupo: "Inspección Técnica", titulo: "Superficies cubiertas vs. descubiertas", descripcion: "Verificar contra título y reglamento.", prioridad: "media", responsable: "corredor", plazo: "Semana 1" },

  // CRM
  { id: "t24", grupo: "CRM y Seguimiento", titulo: "Cargar propiedad en sistema CRM", descripcion: "Alta en cartera con todos los datos: zona, tipo, precio, fotos.", prioridad: "alta", responsable: "corredor", plazo: "Día 1" },
  { id: "t25", grupo: "CRM y Seguimiento", titulo: "Crear alerta de Smart Match", descripcion: "Activar matching automático con contactos interesados.", prioridad: "media", responsable: "corredor", plazo: "Semana 1" },
  { id: "t26", grupo: "CRM y Seguimiento", titulo: "Registrar contacto del propietario", descripcion: "Datos completos + preferencia de comunicación.", prioridad: "alta", responsable: "corredor", plazo: "Día 1" },
  { id: "t27", grupo: "CRM y Seguimiento", titulo: "Programar reunión de seguimiento (30 días)", descripcion: "Agenda revisión de precio y actividad del inmueble.", prioridad: "media", responsable: "corredor", plazo: "Semana 1" },
];

const GRUPOS = Array.from(new Set(TAREAS_BASE.map(t => t.grupo)));

const STORAGE_KEY = "crm_onboarding_estado";

// ── Componente ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [estados, setEstados] = useState<Record<string, boolean>>({});
  const [propiedadId, setPropiedadId] = useState("nueva");
  const [filtroGrupo, setFiltroGrupo] = useState<string>("Todos");
  const [filtroResponsable, setFiltroResponsable] = useState<string>("todos");

  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${propiedadId}`);
    if (stored) setEstados(JSON.parse(stored));
    else setEstados({});
  }, [propiedadId]);

  function toggleTarea(id: string) {
    setEstados(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(`${STORAGE_KEY}_${propiedadId}`, JSON.stringify(next));
      return next;
    });
  }

  function resetear() {
    localStorage.removeItem(`${STORAGE_KEY}_${propiedadId}`);
    setEstados({});
  }

  const tareasFiltradas = useMemo(() => {
    let arr = TAREAS_BASE;
    if (filtroGrupo !== "Todos") arr = arr.filter(t => t.grupo === filtroGrupo);
    if (filtroResponsable !== "todos") arr = arr.filter(t => t.responsable === filtroResponsable);
    return arr;
  }, [filtroGrupo, filtroResponsable]);

  const stats = useMemo(() => {
    const completadas = TAREAS_BASE.filter(t => estados[t.id]).length;
    const alta = TAREAS_BASE.filter(t => t.prioridad === "alta" && !estados[t.id]).length;
    const pct = Math.round((completadas / TAREAS_BASE.length) * 100);
    return { completadas, total: TAREAS_BASE.length, alta, pct };
  }, [estados]);

  const prioridadColor = { alta: "#cc0000", media: "#f97316", baja: "rgba(255,255,255,0.3)" };
  const responsableLabel = { corredor: "Corredor", vendedor: "Propietario", administracion: "Admin." };
  const responsableColor = { corredor: "#3b82f6", vendedor: "#22c55e", administracion: "#a78bfa" };

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Onboarding — ${propiedadId}</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;max-width:750px}h1{font-size:20px}h3{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px}.tarea{padding:8px 0;border-bottom:1px solid #f5f5f5;display:flex;gap:10px;align-items:flex-start}.check{width:14px;height:14px;border:1px solid #ccc;border-radius:3px;flex-shrink:0;margin-top:2px}.done{background:#22c55e;border-color:#22c55e}.pri{font-size:9px;padding:2px 6px;border-radius:4px;font-weight:bold;color:white}.alta{background:#cc0000}.media{background:#f97316}.baja{background:#aaa}</style>
    </head><body>
    <h1>Checklist Onboarding — ${propiedadId}</h1>
    <p>${stats.completadas}/${stats.total} completadas (${stats.pct}%)</p>
    ${GRUPOS.map(g => {
      const tareasG = TAREAS_BASE.filter(t => t.grupo === g);
      return `<h3>${g}</h3>${tareasG.map(t => `<div class="tarea"><div class="check ${estados[t.id] ? "done" : ""}"></div><div><b>${t.titulo}</b> <span class="pri ${t.prioridad}">${t.prioridad.toUpperCase()}</span><br><small style="color:#666">${t.descripcion} | ${t.plazo} · ${responsableLabel[t.responsable]}</small></div></div>`).join("")}`;
    }).join("")}
    <p style="font-size:10px;color:#999;margin-top:20px">Generado ${new Date().toLocaleDateString("es-AR")}</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← CRM</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Onboarding de Inmueble
        </h1>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{stats.completadas}/{stats.total} tareas completadas</span>
      </div>

      <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
        {/* ID propiedad + barra progreso */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 8 }}>Propiedad / Expediente:</span>
              <input type="text" value={propiedadId} onChange={e => setPropiedadId(e.target.value || "nueva")} placeholder="ID o dirección" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: "5px 10px", fontFamily: "'Inter',sans-serif", fontSize: 12, width: 200 }} />
            </div>
            <button onClick={exportarPDF} style={{ padding: "6px 16px", borderRadius: 8, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>PDF</button>
            <button onClick={resetear} style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>Resetear</button>
          </div>

          {/* Barra progreso */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${stats.pct}%`, background: stats.pct === 100 ? "#22c55e" : stats.pct >= 60 ? "#f97316" : "#cc0000", borderRadius: 5, transition: "width 0.4s" }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", color: stats.pct === 100 ? "#22c55e" : "#fff", minWidth: 40 }}>{stats.pct}%</span>
          </div>
          {stats.alta > 0 && (
            <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#cc0000" }}>⚠ {stats.alta} tarea{stats.alta !== 1 ? "s" : ""} de ALTA prioridad pendiente{stats.alta !== 1 ? "s" : ""}</p>
          )}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {["Todos", ...GRUPOS].map(g => (
            <button key={g} onClick={() => setFiltroGrupo(g)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${filtroGrupo === g ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: filtroGrupo === g ? "rgba(204,0,0,0.12)" : "transparent", color: filtroGrupo === g ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
              {g}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {(["todos", "corredor", "vendedor", "administracion"] as const).map(r => (
              <button key={r} onClick={() => setFiltroResponsable(r)} style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${filtroResponsable === r ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`, background: filtroResponsable === r ? "rgba(255,255,255,0.08)" : "transparent", color: filtroResponsable === r ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {r === "todos" ? "Todos" : r === "corredor" ? "Corredor" : r === "vendedor" ? "Propietario" : "Admin"}
              </button>
            ))}
          </div>
        </div>

        {/* Lista agrupada */}
        {(filtroGrupo === "Todos" ? GRUPOS : [filtroGrupo]).map(grupo => {
          const tareasGrupo = tareasFiltradas.filter(t => t.grupo === grupo);
          if (tareasGrupo.length === 0) return null;
          const completadasGrupo = tareasGrupo.filter(t => estados[t.id]).length;
          return (
            <div key={grupo} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ padding: "12px 20px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{grupo}</span>
                <span style={{ fontSize: 11, color: completadasGrupo === tareasGrupo.length ? "#22c55e" : "rgba(255,255,255,0.3)" }}>{completadasGrupo}/{tareasGrupo.length}</span>
              </div>
              {tareasGrupo.map((tarea, idx) => (
                <div key={tarea.id} onClick={() => toggleTarea(tarea.id)} style={{ padding: "14px 20px", borderBottom: idx < tareasGrupo.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", gap: 14, alignItems: "flex-start", cursor: "pointer", background: estados[tarea.id] ? "rgba(34,197,94,0.03)" : "transparent", transition: "background 0.15s" }}>
                  {/* Checkbox */}
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${estados[tarea.id] ? "#22c55e" : "rgba(255,255,255,0.15)"}`, background: estados[tarea.id] ? "#22c55e" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                    {estados[tarea.id] && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                  </div>
                  {/* Contenido */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: estados[tarea.id] ? "rgba(255,255,255,0.3)" : "#fff", textDecoration: estados[tarea.id] ? "line-through" : "none" }}>{tarea.titulo}</span>
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: `${prioridadColor[tarea.prioridad]}22`, color: prioridadColor[tarea.prioridad], fontFamily: "'Montserrat',sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{tarea.prioridad}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{tarea.descripcion}</p>
                    <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                      <span style={{ fontSize: 9, padding: "1px 8px", borderRadius: 8, background: `${responsableColor[tarea.responsable]}18`, color: responsableColor[tarea.responsable], fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>{responsableLabel[tarea.responsable]}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{tarea.plazo}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
