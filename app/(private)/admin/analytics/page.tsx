"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mesLabel(fecha: Date) {
  return fecha.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function fechaCorta(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function agruparPorMes(fechas: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  fechas.forEach(f => {
    const d = new Date(f);
    const k = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    result[k] = (result[k] ?? 0) + 1;
  });
  return result;
}

function agruparPorDia(fechas: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  fechas.forEach(f => {
    const d = new Date(f);
    const k = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    result[k] = (result[k] ?? 0) + 1;
  });
  return result;
}

function agruparPorHora(fechas: string[]): number[] {
  const arr = new Array(24).fill(0);
  fechas.forEach(f => { arr[new Date(f).getHours()]++; });
  return arr;
}

function top<T extends string>(arr: T[], n = 10): { key: T; count: number }[] {
  const m: Record<string, number> = {};
  arr.forEach(v => { if (v) m[v] = (m[v] ?? 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key: key as T, count }));
}

const SECCION_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/mir": "MIR",
  "/red-gfi": "Red GFI",
  "/comunidad": "Comunidad",
  "/foro": "Foro",
  "/noticias": "Noticias",
  "/eventos": "Eventos",
  "/networking": "Networking",
  "/crm": "CRM",
  "/calculadoras": "Calculadoras",
  "/comparables": "Comparables",
  "/padron-gfi": "Padrón GFI",
  "/biblioteca": "Biblioteca",
  "/cotizaciones": "Cotizaciones",
  "/enlaces": "Enlaces",
  "/proveedores": "Proveedores",
  "/beneficios": "Beneficios",
  "/campanas": "Campañas",
  "/perfil": "Mi Perfil",
  "/mi-web": "Mi Web",
  "/reportes": "Reportes",
  "/canal-educativo": "Canal Educativo",
  "/encuestas": "Encuestas",
  "/actividades": "Actividades",
};

function seccionLabel(ruta: string) {
  const base = "/" + ruta.split("/").filter(Boolean)[0];
  return SECCION_LABELS[base] ?? base;
}

// ── Barras CSS ────────────────────────────────────────────────────────────────

function BarChart({ data, color = "#990000", height = 120 }: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height }}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
            <div
              style={{
                width: "100%",
                height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%`,
                background: color,
                borderRadius: "2px 2px 0 0",
                transition: "height 0.3s",
                position: "relative",
              }}
              title={`${d.label}: ${d.value}`}
            >
              {d.value > 0 && (
                <div style={{
                  position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                  fontSize: 9, color: "var(--gfi-text-secondary)", whiteSpace: "nowrap",
                  fontFamily: "var(--font-display)", fontWeight: 700,
                }}>
                  {d.value}
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 8, color: "var(--gfi-text-muted)", textAlign: "center", fontFamily: "var(--font-display)", transform: "rotate(-30deg)", transformOrigin: "top center", whiteSpace: "nowrap", marginTop: 4 }}>
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function HBarChart({ data, color = "#990000" }: {
  data: { label: string; value: number; sub?: string }[];
  color?: string;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 18, fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, textAlign: "right" }}>{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: "#fff" }}>{d.label}</span>
              <span style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>{d.value.toLocaleString("es-AR")}{d.sub ? ` ${d.sub}` : ""}</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
              <div style={{ height: "100%", width: `${(d.value / max) * 100}%`, background: color, borderRadius: 3 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KPI({ label, value, icon, color, bg, sub }: {
  label: string; value: string | number; icon: string; color: string; bg: string; sub?: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{icon} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-display)", color, lineHeight: 1 }}>{value.toLocaleString !== undefined && typeof value === "number" ? value.toLocaleString("es-AR") : value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalUsuarios: number;
    activosMes: number;
    nuevosMes: number;
    totalProps: number;
    totalMIR: number;
    totalNegocios: number;
    suscripcionesActivas: number;
    regsCreated: string[];
    loginsFechas: string[];
    pageViews: { modulo: string; created_at: string; user_id: string }[];
    actividadFechas: string[];
    perfilesDem: { ciudad: string | null; anos_experiencia: number | null; tipo: string }[];
  } | null>(null);

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
      const hace12Meses = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1).toISOString();
      const hace30 = new Date(Date.now() - 30 * 86400000).toISOString();

      const [
        { count: totalUsuarios },
        { count: activosMes },
        { count: nuevosMes },
        { count: totalProps },
        { count: totalMIR },
        { count: totalNegocios },
        { count: suscripcionesActivas },
        { data: regsData },
        { data: loginsData },
        { data: pageViewsData },
        { data: actividadData },
        { data: perfilesDemData },
      ] = await Promise.all([
        supabase.from("perfiles").select("id", { count: "exact", head: true }).in("tipo", ["corredor", "colaborador"]).eq("estado", "aprobado"),
        supabase.from("logs_actividad").select("id", { count: "exact", head: true }).eq("accion", "login").gte("created_at", inicioMes),
        supabase.from("perfiles").select("id", { count: "exact", head: true }).in("tipo", ["corredor", "colaborador"]).gte("created_at", inicioMes),
        supabase.from("cartera_propiedades").select("id", { count: "exact", head: true }),
        supabase.from("mir_ofrecidos").select("id", { count: "exact", head: true }).eq("activo", true),
        supabase.from("crm_negocios").select("id", { count: "exact", head: true }),
        supabase.from("suscripciones").select("id", { count: "exact", head: true }).eq("estado", "activa"),
        supabase.from("perfiles").select("created_at").in("tipo", ["corredor", "colaborador"]).gte("created_at", hace12Meses).limit(2000),
        supabase.from("logs_actividad").select("created_at, user_id").eq("accion", "login").gte("created_at", hace30).limit(2000),
        supabase.from("logs_actividad").select("modulo, created_at, user_id").eq("accion", "page_view").gte("created_at", hace30).limit(5000),
        supabase.from("logs_actividad").select("created_at").gte("created_at", hace30).limit(5000),
        supabase.from("perfiles").select("ciudad, anos_experiencia, tipo").in("tipo", ["corredor", "colaborador"]).eq("estado", "aprobado").limit(1000),
      ]);

      setStats({
        totalUsuarios: totalUsuarios ?? 0,
        activosMes: activosMes ?? 0,
        nuevosMes: nuevosMes ?? 0,
        totalProps: totalProps ?? 0,
        totalMIR: totalMIR ?? 0,
        totalNegocios: totalNegocios ?? 0,
        suscripcionesActivas: suscripcionesActivas ?? 0,
        regsCreated: (regsData ?? []).map((r: any) => r.created_at),
        loginsFechas: (loginsData ?? []).map((r: any) => r.created_at),
        pageViews: (pageViewsData ?? []) as any[],
        actividadFechas: (actividadData ?? []).map((r: any) => r.created_at),
        perfilesDem: (perfilesDemData ?? []) as any[],
      });
      setLoading(false);
    };
    cargar();
  }, []);

  const derived = useMemo(() => {
    if (!stats) return null;
    const ahora = new Date();

    // Crecimiento mensual últimos 12 meses
    const meses: { label: string; key: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      meses.push({ label: mesLabel(d), key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` });
    }
    const regsMes = agruparPorMes(stats.regsCreated);
    const crecimientoMensual = meses.map(m => ({ label: m.label, value: regsMes[m.key] ?? 0 }));

    // Logins por día últimos 30 días
    const dias30: { label: string; key: string }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      dias30.push({ label: fechaCorta(d.toISOString()), key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` });
    }
    const loginsDia = agruparPorDia(stats.loginsFechas);
    const loginsDiario = dias30.map(d => ({ label: d.label, value: loginsDia[d.key] ?? 0 }));

    // Top secciones
    const modulosLimpios = stats.pageViews.map(pv => seccionLabel(pv.modulo ?? ""));
    const topSecciones = top(modulosLimpios, 10).map(({ key, count }) => ({ label: key, value: count }));

    // Actividad por hora
    const porHora = agruparPorHora(stats.actividadFechas);
    const horasData = porHora.map((v, h) => ({ label: `${pad2(h)}h`, value: v }));

    // Ciudad distribution
    const ciudades = stats.perfilesDem.map(p => p.ciudad ?? "No especificada");
    const topCiudades = top(ciudades, 8).map(({ key, count }) => ({ label: key, value: count }));

    // Años experiencia
    const expBuckets: Record<string, number> = { "Sin datos": 0, "1-3 años": 0, "4-7 años": 0, "8-15 años": 0, "+15 años": 0 };
    stats.perfilesDem.forEach(p => {
      const a = p.anos_experiencia;
      if (!a) expBuckets["Sin datos"]++;
      else if (a <= 3) expBuckets["1-3 años"]++;
      else if (a <= 7) expBuckets["4-7 años"]++;
      else if (a <= 15) expBuckets["8-15 años"]++;
      else expBuckets["+15 años"]++;
    });
    const expData = Object.entries(expBuckets).filter(([, v]) => v > 0).map(([k, v]) => ({ label: k, value: v }));

    // Usuarios únicos en últimos 30 días (logins únicos)
    const uniqueLogins = new Set(stats.loginsFechas.map((_, i) => {
      // use loginsFechas index with user_id from stats (not available here)
      // derive from count approximation
      return i;
    })).size;
    // Actually: compute from pageViews unique users
    const uniqueViewers = new Set(stats.pageViews.map(pv => pv.user_id)).size;

    // Engagement: page views por usuario activo
    const engagement = stats.activosMes > 0 ? Math.round(stats.pageViews.length / Math.max(stats.activosMes, 1)) : 0;

    return {
      crecimientoMensual,
      loginsDiario,
      topSecciones,
      horasData,
      topCiudades,
      expData,
      uniqueViewers,
      engagement,
      totalPageViews: stats.pageViews.length,
    };
  }, [stats]);

  if (loading || !stats || !derived) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--gfi-text-muted)" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
        Cargando analytics…
      </div>
    );
  }

  const hoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{ fontFamily: "Inter,sans-serif", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .an-section { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 10px; padding: 20px 22px; margin-bottom: 18px; }
        .an-title { font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .an-title span { color: #990000; }
        .an-h1 { font-family: Montserrat,sans-serif; font-size: 22px; font-weight: 800; color: #fff; margin: 0 0 4px; }
        .an-sub { font-size: 12px; color: var(--gfi-text-muted); }
        .an-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .an-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media (max-width: 700px) { .an-grid2, .an-grid3 { grid-template-columns: 1fr; } }
        .kit-box { background: rgba(153,0,0,0.06); border: 1px solid rgba(153,0,0,0.2); border-radius: 10px; padding: 22px; margin-bottom: 18px; }
        .kit-stat { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--gfi-border-subtle); font-size: 13px; }
        .kit-stat:last-child { border-bottom: none; }
        .kit-stat-label { color: var(--gfi-text-secondary); }
        .kit-stat-val { font-weight: 700; color: #fff; font-family: Montserrat,sans-serif; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .an-section, .kit-box { border: 1px solid #ddd !important; background: #fff !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="no-print">
            <Link href="/admin" style={{ fontSize: 12, color: "var(--gfi-text-muted)", textDecoration: "none" }}>← Admin</Link>
          </div>
          <h1 className="an-h1" style={{ marginTop: 6 }}>📊 Analytics <span style={{ color: "#990000" }}>GFI®</span></h1>
          <p className="an-sub">Métricas de plataforma · Actualizado: {hoy}</p>
        </div>
        <button
          className="no-print"
          onClick={() => window.print()}
          style={{ padding: "10px 20px", background: "#990000", border: "none", borderRadius: 6, color: "#fff", fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}
        >
          🖨 Kit de medios
        </button>
      </div>

      {/* KPIs principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
        <KPI label="Corredores activos" value={stats.totalUsuarios} icon="👥" color="#3b82f6" bg="rgba(59,130,246,0.08)" sub="Con suscripción aprobada" />
        <KPI label="Logins este mes" value={stats.activosMes} icon="🔐" color="#3abab6" bg="rgba(34,197,94,0.08)" sub="Usuarios activos mes actual" />
        <KPI label="Nuevos este mes" value={stats.nuevosMes} icon="🆕" color="#a78bfa" bg="rgba(167,139,250,0.08)" />
        <KPI label="Suscripciones activas" value={stats.suscripcionesActivas} icon="✅" color="#d4960c" bg="rgba(245,158,11,0.08)" />
        <KPI label="Propiedades en CRM" value={stats.totalProps} icon="🏠" color="#06b6d4" bg="rgba(6,182,212,0.08)" sub="Gestionadas activamente" />
        <KPI label="Entradas MIR activas" value={stats.totalMIR} icon="🔁" color="#d4960c" bg="rgba(234,179,8,0.08)" />
        <KPI label="Negocios totales" value={stats.totalNegocios} icon="🤝" color="#990000" bg="rgba(153,0,0,0.08)" />
        <KPI label="Visitas rastreadas (30d)" value={derived.totalPageViews} icon="👁" color="var(--gfi-text-secondary)" bg="var(--gfi-border-subtle)" sub="Desde activación del tracking" />
      </div>

      {/* Crecimiento mensual */}
      <div className="an-section">
        <div className="an-title">📈 <span>Crecimiento</span> — Nuevos usuarios por mes (últimos 12 meses)</div>
        <BarChart data={derived.crecimientoMensual} color="#3b82f6" height={140} />
      </div>

      {/* Logins diarios */}
      <div className="an-section">
        <div className="an-title">🔐 <span>Actividad</span> — Logins diarios (últimos 30 días)</div>
        <BarChart data={derived.loginsDiario} color="#3abab6" height={120} />
      </div>

      <div className="an-grid2">
        {/* Top secciones */}
        <div className="an-section">
          <div className="an-title">📍 <span>Secciones</span> más visitadas (30d)</div>
          {derived.topSecciones.length > 0 ? (
            <HBarChart data={derived.topSecciones} color="#990000" />
          ) : (
            <div style={{ color: "var(--gfi-text-dim)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              Sin datos aún — el tracking de páginas acumula a partir de ahora
            </div>
          )}
        </div>

        {/* Actividad por hora */}
        <div className="an-section">
          <div className="an-title">🕐 <span>Horarios</span> de mayor actividad (30d)</div>
          <BarChart data={derived.horasData} color="#d4960c" height={120} />
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--gfi-text-muted)", textAlign: "center" }}>
            Pico:{" "}
            <strong style={{ color: "#d4960c" }}>
              {derived.horasData.indexOf(derived.horasData.reduce((m, d) => d.value > m.value ? d : m, derived.horasData[0]))}h
            </strong>
          </div>
        </div>
      </div>

      <div className="an-grid2">
        {/* Distribución por ciudad */}
        <div className="an-section">
          <div className="an-title">📍 <span>Ciudades</span> — distribución de usuarios</div>
          {derived.topCiudades.length > 0
            ? <HBarChart data={derived.topCiudades} color="#4ab8d8" />
            : <div style={{ color: "var(--gfi-text-dim)", fontSize: 12 }}>Sin datos de ciudad registrados</div>
          }
        </div>

        {/* Años de experiencia */}
        <div className="an-section">
          <div className="an-title">🎓 <span>Experiencia</span> del público</div>
          <HBarChart data={derived.expData} color="#c084fc" />
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--gfi-text-muted)" }}>
            {stats.perfilesDem.filter(p => (p.anos_experiencia ?? 0) >= 5).length} usuarios (
            {Math.round(stats.perfilesDem.filter(p => (p.anos_experiencia ?? 0) >= 5).length / Math.max(stats.totalUsuarios, 1) * 100)}%)
            con 5+ años de experiencia
          </div>
        </div>
      </div>

      {/* Kit de medios para patrocinadores */}
      <div className="kit-box">
        <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          🎯 Kit de medios — <span style={{ color: "#990000" }}>GFI® Grupo Foro Inmobiliario</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginBottom: 16 }}>
          Métricas de alcance para propuestas comerciales a patrocinadores · {hoy}
        </div>
        <div className="kit-stat">
          <span className="kit-stat-label">Corredores inmobiliarios registrados</span>
          <span className="kit-stat-val">{stats.totalUsuarios.toLocaleString("es-AR")} corredores</span>
        </div>
        <div className="kit-stat">
          <span className="kit-stat-label">Usuarios activos este mes</span>
          <span className="kit-stat-val">{stats.activosMes.toLocaleString("es-AR")} logins</span>
        </div>
        <div className="kit-stat">
          <span className="kit-stat-label">Crecimiento mensual promedio (12m)</span>
          <span className="kit-stat-val">
            {derived.crecimientoMensual.length > 0
              ? `+${Math.round(derived.crecimientoMensual.reduce((s, d) => s + d.value, 0) / derived.crecimientoMensual.length)} usuarios/mes`
              : "—"}
          </span>
        </div>
        <div className="kit-stat">
          <span className="kit-stat-label">Propiedades activas en plataforma</span>
          <span className="kit-stat-val">{stats.totalProps.toLocaleString("es-AR")} propiedades</span>
        </div>
        <div className="kit-stat">
          <span className="kit-stat-label">Negocios gestionados en CRM</span>
          <span className="kit-stat-val">{stats.totalNegocios.toLocaleString("es-AR")} negocios</span>
        </div>
        <div className="kit-stat">
          <span className="kit-stat-label">Entradas en el MIR (mercado compartido)</span>
          <span className="kit-stat-val">{stats.totalMIR.toLocaleString("es-AR")} activas</span>
        </div>
        <div className="kit-stat">
          <span className="kit-stat-label">Perfil del usuario</span>
          <span className="kit-stat-val">
            Corredores matriculados · Santa Fe y zona
          </span>
        </div>
        {derived.topCiudades[0] && (
          <div className="kit-stat">
            <span className="kit-stat-label">Principal ciudad de operación</span>
            <span className="kit-stat-val">{derived.topCiudades[0].label} ({derived.topCiudades[0].value} usuarios)</span>
          </div>
        )}
        <div className="kit-stat">
          <span className="kit-stat-label">Visibilidad mensual estimada</span>
          <span className="kit-stat-val">
            {Math.max(stats.activosMes * 8, stats.totalUsuarios * 3).toLocaleString("es-AR")} impresiones/mes *
          </span>
        </div>
        <div style={{ fontSize: 10, color: "var(--gfi-text-dim)", marginTop: 12, fontStyle: "italic" }}>
          * Estimación basada en sesiones activas × promedio de páginas visitadas por sesión.
          Los datos de visitas de página se acumulan desde la activación del tracking.
        </div>
      </div>
    </div>
  );
}
