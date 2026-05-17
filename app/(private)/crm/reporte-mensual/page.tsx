"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtMon = (v: number, m = "USD") =>
  m === "USD" ? `USD ${Math.round(v).toLocaleString("es-AR")}` : `$ ${Math.round(v).toLocaleString("es-AR")}`;
const fmtPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const isoMes = (d: Date) => d.toISOString().slice(0, 7);
const primerDia = (mes: string) => new Date(mes + "-01T00:00:00");
const ultimoDia = (mes: string) => {
  const d = new Date(mes + "-01T00:00:00");
  d.setMonth(d.getMonth() + 1);
  return d;
};

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  fecha_cierre: string | null;
  updated_at: string;
  created_at: string;
}

interface Interaccion {
  id: string;
  tipo: string;
  created_at: string;
}

interface Tarea {
  id: string;
  titulo: string;
  estado: string;
  fecha_vencimiento: string | null;
}

interface Contacto {
  id: string;
  created_at: string;
}

interface Meta {
  id: string;
  titulo: string;
  tipo: string;
  periodo: string;
  objetivo: number;
  progreso: number;
  activa: boolean;
  fecha_inicio: string;
  fecha_fin: string | null;
}

interface Perfil {
  nombre: string;
  apellido: string;
  inmobiliaria: string | null;
  matricula: string | null;
}

const ETAPA_COLOR: Record<string, string> = {
  prospecto: "#6b7280", contactado: "#3b82f6", visita_coordinada: "#8b5cf6",
  visita_realizada: "#a78bfa", oferta_enviada: "#f59e0b", negociacion: "#f97316",
  reserva: "#06b6d4", escritura: "#10b981", cerrado: "#22c55e", perdido: "#ef4444",
};

// ── componente ────────────────────────────────────────────────────────────────
export default function ReporteMensualPage() {
  const [uid, setUid]               = useState<string | null>(null);
  const [perfil, setPerfil]         = useState<Perfil | null>(null);
  const [mesSeleccionado, setMes]   = useState(() => isoMes(new Date()));
  const [negocios, setNegocios]     = useState<Negocio[]>([]);
  const [interacciones, setInts]    = useState<Interaccion[]>([]);
  const [tareas, setTareas]         = useState<Tarea[]>([]);
  const [contactos, setContactos]   = useState<Contacto[]>([]);
  const [metas, setMetas]           = useState<Meta[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id, mesSeleccionado);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (uid) cargar(uid, mesSeleccionado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSeleccionado]);

  const cargar = async (userId: string, mes: string) => {
    setLoading(true);
    const desde = primerDia(mes).toISOString();
    const hasta = ultimoDia(mes).toISOString();

    const [
      { data: perf },
      { data: negs },
      { data: ints },
      { data: tars },
      { data: ctcs },
      { data: mts },
    ] = await Promise.all([
      supabase.from("perfiles").select("nombre,apellido,inmobiliaria,matricula").eq("id", userId).single(),
      supabase.from("crm_negocios").select("id,titulo,etapa,tipo_operacion,valor_operacion,moneda,honorarios_pct,fecha_cierre,updated_at,created_at").eq("perfil_id", userId).eq("archivado", false),
      supabase.from("crm_interacciones").select("id,tipo,created_at").eq("perfil_id", userId).gte("created_at", desde).lt("created_at", hasta),
      supabase.from("crm_tareas").select("id,titulo,estado,fecha_vencimiento").eq("perfil_id", userId),
      supabase.from("crm_contactos").select("id,created_at").eq("perfil_id", userId).gte("created_at", desde).lt("created_at", hasta),
      supabase.from("crm_metas").select("*").eq("perfil_id", userId).eq("activa", true),
    ]);

    setPerfil((perf as Perfil) ?? null);
    setNegocios((negs ?? []) as Negocio[]);
    setInts((ints ?? []) as Interaccion[]);
    setTareas((tars ?? []) as Tarea[]);
    setContactos((ctcs ?? []) as Contacto[]);
    setMetas((mts ?? []) as Meta[]);
    setLoading(false);
  };

  // ── métricas del mes seleccionado ─────────────────────────────────────────
  const stats = useMemo(() => {
    const desde = primerDia(mesSeleccionado);
    const hasta = ultimoDia(mesSeleccionado);

    const enMes = (iso: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d >= desde && d < hasta;
    };

    const cerradosMes = negocios.filter(n => n.etapa === "cerrado" && enMes(n.fecha_cierre ?? n.updated_at));
    const nuevasMes   = negocios.filter(n => enMes(n.created_at));
    const activos     = negocios.filter(n => !["cerrado","perdido"].includes(n.etapa));

    const valorCerrado = cerradosMes.reduce((s, n) => s + (n.valor_operacion ?? 0), 0);
    const honCerrado   = cerradosMes.reduce((s, n) => {
      const v = n.valor_operacion ?? 0;
      const h = n.honorarios_pct ?? 0;
      return s + v * h / 100;
    }, 0);
    const valorPipeline = activos.reduce((s, n) => s + (n.valor_operacion ?? 0), 0);

    const tareasCompletas = tareas.filter(t => t.estado === "completada" && t.fecha_vencimiento && enMes(t.fecha_vencimiento));

    // Por etapa de activos
    const porEtapa: Record<string, number> = {};
    activos.forEach(n => { porEtapa[n.etapa] = (porEtapa[n.etapa] ?? 0) + 1; });

    // Por tipo de interacción
    const porTipoInt: Record<string, number> = {};
    interacciones.forEach(i => { porTipoInt[i.tipo] = (porTipoInt[i.tipo] ?? 0) + 1; });

    return {
      cerradosMes: cerradosMes.length,
      nuevasMes: nuevasMes.length,
      activosTotal: activos.length,
      valorCerrado,
      honCerrado,
      valorPipeline,
      interacciones: interacciones.length,
      contactosNuevos: contactos.length,
      tareasCompletas: tareasCompletas.length,
      porEtapa,
      porTipoInt,
      cerradosList: cerradosMes,
    };
  }, [negocios, interacciones, tareas, contactos, mesSeleccionado]);

  // ── metas del mes ─────────────────────────────────────────────────────────
  const metasActivas = useMemo(() => {
    return metas.filter(m => {
      if (m.periodo === "mensual") {
        const inicio = m.fecha_inicio.slice(0, 7);
        return inicio === mesSeleccionado || !m.fecha_fin;
      }
      return true;
    });
  }, [metas, mesSeleccionado]);

  // ── opciones de mes (últimos 12) ──────────────────────────────────────────
  const opcionesMes = useMemo(() => {
    const opts = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      opts.push(isoMes(d));
    }
    return opts;
  }, []);

  const labelMes = (iso: string) => {
    const [a, m] = iso.split("-");
    return `${MESES[parseInt(m) - 1]} ${a}`;
  };

  // ── generador de PDF ──────────────────────────────────────────────────────
  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const nombre = perfil ? `${perfil.nombre} ${perfil.apellido}` : "Corredor";
    const inmob  = perfil?.inmobiliaria ?? "";
    const mat    = perfil?.matricula ?? "";

    const filaEtapa = Object.entries(stats.porEtapa)
      .map(([e, c]) => `<tr><td style="padding:5px 10px">${e}</td><td style="padding:5px 10px;text-align:right;font-weight:600">${c}</td></tr>`)
      .join("");

    const filaInt = Object.entries(stats.porTipoInt)
      .map(([t, c]) => `<tr><td style="padding:5px 10px">${t}</td><td style="padding:5px 10px;text-align:right;font-weight:600">${c}</td></tr>`)
      .join("");

    const filasMetas = metasActivas.map(m => {
      const pct = Math.min(100, Math.round((m.progreso / m.objetivo) * 100));
      return `<tr><td style="padding:5px 10px">${m.titulo}</td><td style="padding:5px 10px;text-align:right">${m.progreso}/${m.objetivo}</td><td style="padding:5px 10px;text-align:right;font-weight:600;color:${pct>=100?"#16a34a":pct>=60?"#d97706":"#dc2626"}">${pct}%</td></tr>`;
    }).join("");

    const filasCerrados = stats.cerradosList.map(n => `
      <tr><td style="padding:5px 10px">${n.titulo}</td>
      <td style="padding:5px 10px">${n.tipo_operacion}</td>
      <td style="padding:5px 10px;text-align:right">${fmtMon(n.valor_operacion ?? 0, n.moneda)}</td>
      <td style="padding:5px 10px;text-align:right">${n.honorarios_pct ?? 0}%</td></tr>`).join("");

    win.document.write(`<!DOCTYPE html><html><head><title>Reporte ${labelMes(mesSeleccionado)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;padding:28px;font-size:13px}
      h1{font-size:20px;margin-bottom:4px}
      h2{font-size:14px;margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid #cc0000;color:#cc0000}
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
      .kpi{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}
      .kpi-n{font-size:20px;font-weight:800;color:#111}
      .kpi-l{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-top:4px}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280}
      td{font-size:12px;border-bottom:1px solid #f0f0f0}
      .footer{margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}
    </style></head>
    <body>
      <h1>Reporte de Actividad · ${labelMes(mesSeleccionado)}</h1>
      <p style="color:#6b7280;margin-bottom:20px">${nombre}${inmob ? " · " + inmob : ""}${mat ? " · Mat. " + mat : ""}</p>

      <h2>Resumen ejecutivo</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-n">${stats.cerradosMes}</div><div class="kpi-l">Operaciones cerradas</div></div>
        <div class="kpi"><div class="kpi-n">${fmtMon(stats.honCerrado)}</div><div class="kpi-l">Honorarios brutos</div></div>
        <div class="kpi"><div class="kpi-n">${stats.interacciones}</div><div class="kpi-l">Interacciones</div></div>
        <div class="kpi"><div class="kpi-n">${stats.contactosNuevos}</div><div class="kpi-l">Nuevos contactos</div></div>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-n">${stats.activosTotal}</div><div class="kpi-l">Negocios activos</div></div>
        <div class="kpi"><div class="kpi-n">${stats.nuevasMes}</div><div class="kpi-l">Nuevos negocios</div></div>
        <div class="kpi"><div class="kpi-n">${fmtMon(stats.valorPipeline)}</div><div class="kpi-l">Valor pipeline</div></div>
        <div class="kpi"><div class="kpi-n">${stats.tareasCompletas}</div><div class="kpi-l">Tareas completadas</div></div>
      </div>

      ${stats.cerradosList.length > 0 ? `
      <h2>Operaciones cerradas</h2>
      <table><thead><tr><th>Negocio</th><th>Tipo</th><th>Valor</th><th>Hon.%</th></tr></thead>
      <tbody>${filasCerrados}</tbody></table>` : ""}

      <h2>Pipeline activo por etapa</h2>
      <table><thead><tr><th>Etapa</th><th style="text-align:right">Cantidad</th></tr></thead>
      <tbody>${filaEtapa}</tbody></table>

      <h2>Interacciones por tipo</h2>
      <table><thead><tr><th>Tipo</th><th style="text-align:right">Cantidad</th></tr></thead>
      <tbody>${filaInt}</tbody></table>

      ${metasActivas.length > 0 ? `
      <h2>Metas activas</h2>
      <table><thead><tr><th>Meta</th><th style="text-align:right">Progreso</th><th style="text-align:right">%</th></tr></thead>
      <tbody>${filasMetas}</tbody></table>` : ""}

      <div class="footer">Generado por Grupo Foro Inmobiliario · ${new Date().toLocaleDateString("es-AR")}</div>
    </body></html>`);
    setTimeout(() => win.print(), 500);
  };

  const [m, a] = mesSeleccionado.split("-");
  const mesLabel = `${MESES[parseInt(m) - 1]} ${a}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .rm-card { background:rgba(14,14,14,0.9); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:18px; }
        .rm-kpi { text-align:center; }
        .rm-kpi-n { font-family:'Montserrat',sans-serif; font-size:20px; font-weight:800; }
        .rm-kpi-l { font-size:10px; color:rgba(255,255,255,0.3); font-family:'Montserrat',sans-serif; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; margin-top:4px; }
        .rm-btn { padding:8px 16px; border:none; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; }
        .rm-select { padding:8px 12px; background:rgba(14,14,14,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:#fff; font-size:13px; font-family:'Inter',sans-serif; outline:none; }
        .rm-section { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.3); font-family:'Montserrat',sans-serif; margin-bottom:12px; }
        .rm-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
        .rm-row:last-child { border-bottom:none; }
        @media(max-width:700px){.rm-grid4{grid-template-columns:repeat(2,1fr)!important;} .rm-cols{flex-direction:column!important;}}
      `}</style>

      <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#fff" }}>
              Reporte de <span style={{ color: "#cc0000" }}>Actividad</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
              Resumen ejecutivo mensual del CRM
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select className="rm-select" value={mesSeleccionado} onChange={e => setMes(e.target.value)}>
              {opcionesMes.map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
            </select>
            <button className="rm-btn" style={{ background: "#cc0000", color: "#fff" }} onClick={exportarPDF}>
              ↓ Exportar PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 48, fontFamily: "Inter,sans-serif" }}>Cargando datos...</div>
        ) : (
          <>
            {/* ── KPIs principales ── */}
            <div className="rm-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { n: stats.cerradosMes,                          l: "Operaciones cerradas", c: "#22c55e" },
                { n: fmtMon(stats.honCerrado),                   l: "Honorarios brutos",    c: "#f59e0b" },
                { n: stats.interacciones,                        l: "Interacciones",        c: "#60a5fa" },
                { n: stats.contactosNuevos,                      l: "Nuevos contactos",     c: "#a78bfa" },
              ].map(k => (
                <div key={k.l} className="rm-card rm-kpi">
                  <div className="rm-kpi-n" style={{ color: k.c, fontSize: typeof k.n === "string" ? 14 : 20 }}>{k.n}</div>
                  <div className="rm-kpi-l">{k.l}</div>
                </div>
              ))}
            </div>

            <div className="rm-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { n: stats.activosTotal,                         l: "Negocios activos",     c: "#fff" },
                { n: stats.nuevasMes,                            l: "Nuevos negocios",      c: "#60a5fa" },
                { n: fmtMon(stats.valorPipeline),                l: "Valor pipeline",       c: "#f97316" },
                { n: stats.tareasCompletas,                      l: "Tareas completadas",   c: "#10b981" },
              ].map(k => (
                <div key={k.l} className="rm-card rm-kpi">
                  <div className="rm-kpi-n" style={{ color: k.c, fontSize: typeof k.n === "string" ? 14 : 20 }}>{k.n}</div>
                  <div className="rm-kpi-l">{k.l}</div>
                </div>
              ))}
            </div>

            {/* ── Layout 2 cols ── */}
            <div className="rm-cols" style={{ display: "flex", gap: 16 }}>

              {/* Col izquierda */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Operaciones cerradas */}
                <div className="rm-card">
                  <div className="rm-section">Operaciones cerradas — {mesLabel}</div>
                  {stats.cerradosList.length === 0 ? (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", textAlign: "center", padding: "16px 0" }}>Sin operaciones cerradas en este período</div>
                  ) : (
                    stats.cerradosList.map(n => {
                      const hon = ((n.valor_operacion ?? 0) * (n.honorarios_pct ?? 0) / 100);
                      return (
                        <div key={n.id} className="rm-row">
                          <div>
                            <div style={{ fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff" }}>{n.titulo}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>{n.tipo_operacion} · {fmtMon(n.valor_operacion ?? 0, n.moneda)}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#22c55e" }}>{fmtMon(hon, n.moneda)}</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>Hon. {n.honorarios_pct ?? 0}%</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Interacciones por tipo */}
                <div className="rm-card">
                  <div className="rm-section">Interacciones por tipo</div>
                  {Object.keys(stats.porTipoInt).length === 0 ? (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", textAlign: "center", padding: "16px 0" }}>Sin interacciones registradas</div>
                  ) : (
                    Object.entries(stats.porTipoInt)
                      .sort((a, b) => b[1] - a[1])
                      .map(([tipo, count]) => {
                        const total = stats.interacciones;
                        const pct = total > 0 ? (count / total) * 100 : 0;
                        const iconos: Record<string, string> = { llamada: "📞", whatsapp: "💬", email: "✉️", reunion: "🤝", visita: "🏠", nota: "📝" };
                        return (
                          <div key={tipo} style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter,sans-serif" }}>{iconos[tipo] ?? "💬"} {tipo}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "Montserrat,sans-serif" }}>{count} <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                            </div>
                            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: "#cc0000", borderRadius: 2, transition: "width 0.5s" }} />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Col derecha */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Pipeline por etapa */}
                <div className="rm-card">
                  <div className="rm-section">Pipeline activo por etapa</div>
                  {Object.keys(stats.porEtapa).length === 0 ? (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", textAlign: "center", padding: "16px 0" }}>Sin negocios activos</div>
                  ) : (
                    Object.entries(stats.porEtapa)
                      .sort((a, b) => b[1] - a[1])
                      .map(([etapa, count]) => {
                        const color = ETAPA_COLOR[etapa] ?? "#6b7280";
                        const maxCount = Math.max(...Object.values(stats.porEtapa));
                        return (
                          <div key={etapa} style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter,sans-serif" }}>{etapa.replace("_", " ")}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "Montserrat,sans-serif" }}>{count}</span>
                            </div>
                            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                              <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, background: color, borderRadius: 2, transition: "width 0.5s" }} />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Metas */}
                {metasActivas.length > 0 && (
                  <div className="rm-card">
                    <div className="rm-section">Metas activas</div>
                    {metasActivas.map(meta => {
                      const pct = Math.min(100, Math.round((meta.progreso / meta.objetivo) * 100));
                      const color = pct >= 100 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
                      return (
                        <div key={meta.id} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <div>
                              <div style={{ fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff" }}>{meta.titulo}</div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>{meta.periodo} · {meta.tipo}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 800, color }}>{pct}%</div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>{meta.progreso}/{meta.objetivo}</div>
                            </div>
                          </div>
                          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Nota de período */}
                <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>Período analizado</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter,sans-serif" }}>
                    {mesLabel} · {primerDia(mesSeleccionado).toLocaleDateString("es-AR")} al {new Date(ultimoDia(mesSeleccionado).getTime() - 86400000).toLocaleDateString("es-AR")}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif", marginTop: 4 }}>
                    Las interacciones y contactos se cuentan por fecha de creación. Los cierres por fecha de cierre o última actualización dentro del mes.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
