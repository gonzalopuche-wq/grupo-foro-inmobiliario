"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── tipos ──────────────────────────────────────────────────────────────────────
interface PropiedadCartera {
  id: string;
  operacion: string | null;
  tipo: string | null;
  zona: string | null;
  precio: number | null;
  moneda: string | null;
  estado: string | null;
  descripcion: string | null;
  perfil_id: string;
  created_at: string;
}

interface Contacto {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  perfil_id: string;
}

interface ActividadItem {
  id: string;
  tipo: "visita" | "consulta" | "oferta" | "publicacion";
  fecha: string;
  descripcion: string;
  resultado: string;
}

interface ReportePropietario {
  id: string;
  propiedad_id: string;
  propietario_id: string;
  periodo: string;
  actividad: ActividadItem[];
  observaciones: string;
  precio_sugerido: number | null;
  moneda_sugerida: string;
  enviado: boolean;
  fecha_envio: string | null;
  created_at: string;
}

type TabPrincipal = "cartera" | "editor" | "historial";
type TipoActividad = ActividadItem["tipo"];

// ── constantes ─────────────────────────────────────────────────────────────────
const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TIPO_ACTIVIDAD_LABEL: Record<TipoActividad, string> = {
  visita:      "Visita",
  consulta:    "Consulta",
  oferta:      "Oferta",
  publicacion: "Publicación",
};

const TIPO_ACTIVIDAD_COLOR: Record<TipoActividad, string> = {
  visita:      "#3b82f6",
  consulta:    "#8b5cf6",
  oferta:      "#d4960c",
  publicacion: "#3abab6",
};

// ── helpers ────────────────────────────────────────────────────────────────────
function generarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function fmtPrecio(precio: number | null, moneda: string | null): string {
  if (precio === null || precio === 0) return "—";
  const sym = moneda === "USD" ? "USD " : "$ ";
  return `${sym}${precio.toLocaleString("es-AR")}`;
}

function fmtFecha(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function periodoLabel(periodoKey: string): string {
  const parts = periodoKey.split("-");
  if (parts.length < 2) return periodoKey;
  const mes = parseInt(parts[1], 10);
  const anio = parseInt(parts[0], 10);
  return `${MESES_NOMBRES[mes - 1]} ${anio}`;
}

function buildPeriodos(): { key: string; label: string }[] {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth() + 1;
  const lista: { key: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(anio, mes - 1 - i, 1);
    const a = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${a}-${String(m).padStart(2, "0")}`;
    lista.push({ key, label: `${MESES_NOMBRES[m - 1]} ${a}` });
  }
  return lista;
}

async function upsertReportesSupabase(
  uid: string,
  reportes: ReportePropietario[],
  asignaciones: Record<string, string>
): Promise<void> {
  await supabase
    .from("crm_reportes_propietarios")
    .upsert(
      { perfil_id: uid, reportes, asignaciones, updated_at: new Date().toISOString() },
      { onConflict: "perfil_id" }
    );
}

// ── componente principal ───────────────────────────────────────────────────────
export default function ReportesPropietariosPage() {
  const ahora = new Date();
  const periodoActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const periodos = useMemo(() => buildPeriodos(), []);

  // ── estado global ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabPrincipal>("cartera");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // ── datos supabase ─────────────────────────────────────────────────────────
  const [propiedades, setPropiedades] = useState<PropiedadCartera[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);

  // ── asignaciones (supabase) ────────────────────────────────────────────────
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [reportes, setReportes] = useState<ReportePropietario[]>([]);

  // ── editor ────────────────────────────────────────────────────────────────
  const [editorPropiedadId, setEditorPropiedadId] = useState<string>("");
  const [editorPeriodo, setEditorPeriodo] = useState<string>(periodoActual);
  const [editorActividad, setEditorActividad] = useState<ActividadItem[]>([]);
  const [editorObservaciones, setEditorObservaciones] = useState<string>("");
  const [editorPrecioSugerido, setEditorPrecioSugerido] = useState<string>("");
  const [editorMonedaSugerida, setEditorMonedaSugerida] = useState<string>("USD");
  const [editorReporteId, setEditorReporteId] = useState<string | null>(null);

  // ── auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
    });
  }, []);

  // ── cargar datos ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    cargarDatos(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const cargarDatos = async (uid: string) => {
    setLoading(true);
    const [resProp, resCont, resReportes] = await Promise.all([
      supabase
        .from("cartera_propiedades")
        .select("id,created_at,operacion,tipo,zona,precio,moneda,estado,descripcion,perfil_id")
        .eq("perfil_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_contactos")
        .select("id,nombre,email,telefono,perfil_id")
        .eq("perfil_id", uid)
        .order("nombre", { ascending: true }),
      supabase
        .from("crm_reportes_propietarios")
        .select("reportes,asignaciones")
        .eq("perfil_id", uid)
        .single(),
    ]);
    setPropiedades((resProp.data ?? []) as PropiedadCartera[]);
    setContactos((resCont.data ?? []) as Contacto[]);

    // cargar reportes y asignaciones desde Supabase
    const reportesData = resReportes.data;
    if (reportesData && Array.isArray(reportesData.reportes)) {
      setReportes(reportesData.reportes as ReportePropietario[]);
    } else {
      setReportes([]);
    }
    if (reportesData && reportesData.asignaciones && typeof reportesData.asignaciones === "object") {
      setAsignaciones(reportesData.asignaciones as Record<string, string>);
    } else {
      setAsignaciones({});
    }

    setLoading(false);
  };

  // ── asignaciones ───────────────────────────────────────────────────────────
  const asignarPropietario = useCallback((propiedadId: string, contactoId: string) => {
    setAsignaciones(prev => {
      const next = { ...prev };
      if (contactoId === "") {
        delete next[propiedadId];
      } else {
        next[propiedadId] = contactoId;
      }
      if (userId) upsertReportesSupabase(userId, reportes, next);
      return next;
    });
  }, [userId, reportes]);

  // ── editor helpers ─────────────────────────────────────────────────────────
  const limpiarEditor = useCallback(() => {
    setEditorReporteId(null);
    setEditorPropiedadId("");
    setEditorPeriodo(periodoActual);
    setEditorActividad([]);
    setEditorObservaciones("");
    setEditorPrecioSugerido("");
    setEditorMonedaSugerida("USD");
  }, [periodoActual]);

  const abrirEditorParaPropiedad = useCallback((propiedadId: string) => {
    limpiarEditor();
    setEditorPropiedadId(propiedadId);
    setTab("editor");
  }, [limpiarEditor]);

  const cargarReporteEnEditor = useCallback((reporte: ReportePropietario) => {
    setEditorReporteId(reporte.id);
    setEditorPropiedadId(reporte.propiedad_id);
    setEditorPeriodo(reporte.periodo);
    setEditorActividad(reporte.actividad.map(a => ({ ...a })));
    setEditorObservaciones(reporte.observaciones);
    setEditorPrecioSugerido(reporte.precio_sugerido !== null ? String(reporte.precio_sugerido) : "");
    setEditorMonedaSugerida(reporte.moneda_sugerida);
    setTab("editor");
  }, []);

  const agregarActividad = useCallback(() => {
    const nueva: ActividadItem = {
      id: generarId(),
      tipo: "visita",
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: "",
      resultado: "",
    };
    setEditorActividad(prev => [...prev, nueva]);
  }, []);

  const actualizarActividad = useCallback(<K extends keyof ActividadItem>(
    id: string,
    campo: K,
    valor: ActividadItem[K]
  ) => {
    setEditorActividad(prev =>
      prev.map(a => a.id === id ? { ...a, [campo]: valor } : a)
    );
  }, []);

  const eliminarActividad = useCallback((id: string) => {
    setEditorActividad(prev => prev.filter(a => a.id !== id));
  }, []);

  const guardarReporte = useCallback(() => {
    if (!editorPropiedadId) return;
    const propiedadActual = propiedades.find(p => p.id === editorPropiedadId);
    const propietarioId = asignaciones[editorPropiedadId] ?? "";

    const precioNum = editorPrecioSugerido !== "" ? parseFloat(editorPrecioSugerido) : null;

    if (editorReporteId) {
      // actualizar existente
      setReportes(prev => {
        const next = prev.map(r =>
          r.id === editorReporteId
            ? {
                ...r,
                propiedad_id: editorPropiedadId,
                propietario_id: propietarioId,
                periodo: editorPeriodo,
                actividad: editorActividad,
                observaciones: editorObservaciones,
                precio_sugerido: !isNaN(precioNum ?? NaN) ? precioNum : null,
                moneda_sugerida: editorMonedaSugerida,
              }
            : r
        );
        if (userId) upsertReportesSupabase(userId, next, asignaciones);
        return next;
      });
    } else {
      // crear nuevo
      const nuevo: ReportePropietario = {
        id: generarId(),
        propiedad_id: editorPropiedadId,
        propietario_id: propietarioId,
        periodo: editorPeriodo,
        actividad: editorActividad,
        observaciones: editorObservaciones,
        precio_sugerido: !isNaN(precioNum ?? NaN) ? precioNum : null,
        moneda_sugerida: editorMonedaSugerida,
        enviado: false,
        fecha_envio: null,
        created_at: new Date().toISOString(),
      };
      // no duplicar misma propiedad + período
      setReportes(prev => {
        const filtrado = prev.filter(r => !(r.propiedad_id === editorPropiedadId && r.periodo === editorPeriodo));
        const next = [nuevo, ...filtrado];
        if (userId) upsertReportesSupabase(userId, next, asignaciones);
        return next;
      });
      setEditorReporteId(nuevo.id);
    }

    void propiedadActual; // suppress unused warning
  }, [
    editorPropiedadId, editorPeriodo, editorActividad, editorObservaciones,
    editorPrecioSugerido, editorMonedaSugerida, editorReporteId,
    propiedades, asignaciones, userId,
  ]);

  const marcarEnviado = useCallback((reporteId: string) => {
    setReportes(prev => {
      const next = prev.map(r =>
        r.id === reporteId
          ? { ...r, enviado: true, fecha_envio: new Date().toISOString() }
          : r
      );
      if (userId) upsertReportesSupabase(userId, next, asignaciones);
      return next;
    });
  }, [userId, asignaciones]);

  // ── propiedades activas ────────────────────────────────────────────────────
  const propiedadesActivas = useMemo(
    () => propiedades.filter(p => p.estado === "activo" || p.estado === "publicada" || p.estado === null),
    [propiedades]
  );

  // ── propiedad y propietario actuales en editor ─────────────────────────────
  const propiedadEditando = useMemo(
    () => propiedades.find(p => p.id === editorPropiedadId) ?? null,
    [propiedades, editorPropiedadId]
  );

  const propietarioEditando = useMemo(() => {
    const cid = asignaciones[editorPropiedadId];
    return cid ? (contactos.find(c => c.id === cid) ?? null) : null;
  }, [contactos, asignaciones, editorPropiedadId]);

  // ── resumen estadístico del editor ─────────────────────────────────────────
  const resumenActividad = useMemo(() => {
    const counts: Record<TipoActividad, number> = { visita: 0, consulta: 0, oferta: 0, publicacion: 0 };
    editorActividad.forEach(a => { counts[a.tipo] = (counts[a.tipo] ?? 0) + 1; });
    return counts;
  }, [editorActividad]);

  // ── reportes agrupados por propiedad ──────────────────────────────────────
  const reportesPorPropiedad = useMemo(() => {
    const mapa: Record<string, ReportePropietario[]> = {};
    reportes.forEach(r => {
      if (!mapa[r.propiedad_id]) mapa[r.propiedad_id] = [];
      mapa[r.propiedad_id].push(r);
    });
    return mapa;
  }, [reportes]);

  // ── KPI historial ──────────────────────────────────────────────────────────
  const kpiHistorial = useMemo(() => {
    const total = reportes.length;
    const enviados = reportes.filter(r => r.enviado).length;
    const propConReporteMes = new Set(
      reportes.filter(r => r.periodo === periodoActual).map(r => r.propiedad_id)
    );
    const sinReporteMes = propiedadesActivas.filter(p => !propConReporteMes.has(p.id)).length;
    return { total, enviados, sinReporteMes };
  }, [reportes, propiedadesActivas, periodoActual]);

  // ── fecha hoy ─────────────────────────────────────────────────────────────
  const fechaHoy = ahora.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  // ── exportar PDF ───────────────────────────────────────────────────────────
  const exportarPDF = useCallback((reporte: ReportePropietario) => {
    const propiedad = propiedades.find(p => p.id === reporte.propiedad_id);
    const propietario = contactos.find(c => c.id === reporte.propietario_id);
    const win = window.open("", "_blank");
    if (!win) return;

    const rowsActividad = reporte.actividad.map(a => `
      <tr>
        <td><span style="font-size:10px;padding:2px 7px;border-radius:4px;background:#e0f2fe;color:#0369a1;font-weight:700">${TIPO_ACTIVIDAD_LABEL[a.tipo]}</span></td>
        <td>${a.fecha ? fmtFecha(a.fecha) : "—"}</td>
        <td>${a.descripcion || "—"}</td>
        <td>${a.resultado || "—"}</td>
      </tr>`).join("");

    win.document.write(`<!DOCTYPE html><html><head>
      <title>Reporte Propietario — ${periodoLabel(reporte.periodo)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:860px;margin:0 auto}
        .header{border-bottom:3px solid #990000;padding-bottom:18px;margin-bottom:28px}
        .logo{font-family:'Arial Black',Arial,sans-serif;font-size:20px;font-weight:900;color:#990000;letter-spacing:-0.5px}
        .logo span{color:#111}
        h1{font-size:22px;margin:12px 0 4px;font-family:Arial,sans-serif;font-weight:900}
        h2{font-size:12px;margin:24px 0 8px;border-bottom:2px solid #990000;padding-bottom:5px;color:#990000;text-transform:uppercase;letter-spacing:0.07em}
        p{font-size:12px;color:#6b7280;margin:0 0 6px}
        .prop-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px}
        .prop-card{border:1px solid #e5e7eb;border-radius:8px;padding:12px}
        .prop-label{font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:4px;font-weight:700}
        .prop-value{font-size:13px;font-weight:700;color:#111}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        td,th{padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:left}
        th{background:#f3f4f6;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280}
        .obs-box{border:1px solid #e5e7eb;border-radius:8px;padding:14px;font-size:12px;color:#374151;line-height:1.6;margin-bottom:20px;background:#f9fafb}
        .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
        @media print{body{padding:20px}}
      </style>
    </head><body>
      <div class="header">
        <div class="logo">GFI <span>Inmobiliario</span></div>
        <h1>Informe Mensual para Propietario</h1>
        <p>Período: <strong>${periodoLabel(reporte.periodo)}</strong> · Generado el ${fechaHoy}</p>
        ${propietario ? `<p>Para: <strong>${propietario.nombre ?? "Propietario"}</strong>${propietario.email ? ` · ${propietario.email}` : ""}${propietario.telefono ? ` · ${propietario.telefono}` : ""}</p>` : ""}
      </div>

      <h2>Datos de la propiedad</h2>
      <div class="prop-grid">
        <div class="prop-card"><div class="prop-label">Tipo</div><div class="prop-value">${propiedad?.tipo ?? "—"}</div></div>
        <div class="prop-card"><div class="prop-label">Operación</div><div class="prop-value">${propiedad?.operacion ?? "—"}</div></div>
        <div class="prop-card"><div class="prop-label">Barrio</div><div class="prop-value">${propiedad?.zona ?? "—"}</div></div>
        <div class="prop-card"><div class="prop-label">Precio publicado</div><div class="prop-value">${fmtPrecio(propiedad?.precio ?? null, propiedad?.moneda ?? null)}</div></div>
        <div class="prop-card"><div class="prop-label">Estado</div><div class="prop-value">${propiedad?.estado ?? "—"}</div></div>
        ${reporte.precio_sugerido !== null ? `<div class="prop-card" style="border-color:#990000"><div class="prop-label" style="color:#990000">Precio sugerido</div><div class="prop-value" style="color:#990000">${fmtPrecio(reporte.precio_sugerido, reporte.moneda_sugerida)}</div></div>` : ""}
      </div>

      <h2>Actividad del período (${reporte.actividad.length} evento${reporte.actividad.length !== 1 ? "s" : ""})</h2>
      <table>
        <thead><tr><th>Tipo</th><th>Fecha</th><th>Descripción</th><th>Resultado</th></tr></thead>
        <tbody>${rowsActividad || "<tr><td colspan='4' style='text-align:center;color:#9ca3af'>Sin actividad registrada</td></tr>"}</tbody>
      </table>

      ${reporte.observaciones ? `
      <h2>Observaciones del corredor</h2>
      <div class="obs-box">${reporte.observaciones.replace(/\n/g, "<br>")}</div>` : ""}

      <div class="footer">
        Grupo Foro Inmobiliario · Informe generado el ${fechaHoy}
      </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }, [propiedades, contactos, fechaHoy]);

  const exportarEditorPDF = useCallback(() => {
    if (!editorPropiedadId) return;
    const reporteTemp: ReportePropietario = {
      id: editorReporteId ?? "preview",
      propiedad_id: editorPropiedadId,
      propietario_id: asignaciones[editorPropiedadId] ?? "",
      periodo: editorPeriodo,
      actividad: editorActividad,
      observaciones: editorObservaciones,
      precio_sugerido: editorPrecioSugerido !== "" ? parseFloat(editorPrecioSugerido) : null,
      moneda_sugerida: editorMonedaSugerida,
      enviado: false,
      fecha_envio: null,
      created_at: new Date().toISOString(),
    };
    exportarPDF(reporteTemp);
  }, [
    editorPropiedadId, editorReporteId, editorPeriodo, editorActividad,
    editorObservaciones, editorPrecioSugerido, editorMonedaSugerida,
    asignaciones, exportarPDF,
  ]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "0 0 80px",
        fontFamily: "Inter, sans-serif",
        color: "#e0e0e0",
      }}
    >
      <style>{`
        
        .rp-input { background:var(--gfi-border-subtle); border:1px solid #222222; border-radius:7px; color:#e0e0e0; padding:8px 12px; font-size:13px; font-family:Inter,sans-serif; outline:none; width:100%; box-sizing:border-box; }
        .rp-input:focus { border-color:rgba(153,0,0,0.45); }
        .rp-textarea { background:var(--gfi-border-subtle); border:1px solid #222222; border-radius:7px; color:#e0e0e0; padding:10px 12px; font-size:13px; font-family:Inter,sans-serif; outline:none; width:100%; resize:vertical; min-height:90px; box-sizing:border-box; }
        .rp-textarea:focus { border-color:rgba(153,0,0,0.45); }
        .rp-select { background:var(--gfi-bg-secondary)111; border:1px solid #222222; border-radius:7px; color:#e0e0e0; padding:8px 12px; font-size:13px; font-family:Inter,sans-serif; outline:none; cursor:pointer; width:100%; box-sizing:border-box; }
        .rp-select-sm { background:var(--gfi-bg-secondary)111; border:1px solid #222222; border-radius:6px; color:#e0e0e0; padding:6px 10px; font-size:12px; font-family:Inter,sans-serif; outline:none; cursor:pointer; }
        .rp-card { background:var(--gfi-bg-secondary)111; border:1px solid #222222; border-radius:12px; padding:20px; }
        .rp-section-title { font-family:Montserrat,sans-serif; font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--gfi-text-muted); margin-bottom:14px; }
        .rp-btn { border:none; border-radius:8px; font-family:Montserrat,sans-serif; font-weight:700; font-size:12px; cursor:pointer; padding:9px 18px; transition:opacity 0.15s; }
        .rp-btn:hover { opacity:0.85; }
        .rp-btn-red { background:#990000; color:#fff; }
        .rp-btn-ghost { background:var(--gfi-border-subtle); color:#e0e0e0; border:1px solid #222222; }
        .rp-btn-green { background:#15803d; color:#fff; }
        .rp-tab { padding:8px 18px; border-radius:7px; font-family:Montserrat,sans-serif; font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; border:1px solid transparent; transition:background 0.15s,color 0.15s; }
        @keyframes rpFadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .rp-fadein { animation:rpFadeIn 0.25s ease both; }
        @keyframes rpSkeleton { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
        .rp-skeleton { animation:rpSkeleton 1.2s ease-in-out infinite; background:var(--gfi-border-subtle); border-radius:10px; }
        .rp-act-row { background:rgba(255,255,255,0.025); border:1px solid #222222; border-radius:9px; padding:14px; margin-bottom:10px; }
        @media(max-width:640px){
          .rp-grid2 { grid-template-columns:1fr !important; }
          .rp-act-grid { grid-template-columns:1fr 1fr !important; }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--gfi-text-dim)",
            marginBottom: 6,
          }}
        >
          CRM — Reportes
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 28,
            color: "#e0e0e0",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Reportes <span style={{ color: "#990000" }}>para Propietarios</span>
        </h1>
        <p style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 5, marginBottom: 0 }}>
          Generador de informes mensuales de actividad para enviar a los propietarios
        </p>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {(["cartera", "editor", "historial"] as TabPrincipal[]).map(t => (
          <button
            key={t}
            className="rp-tab"
            style={{
              background: tab === t ? "#990000" : "var(--gfi-border-subtle)",
              color:      tab === t ? "#fff"    : "var(--gfi-text-muted)",
              border:     tab === t ? "1px solid #990000" : "1px solid #222222",
            }}
            onClick={() => setTab(t)}
          >
            {t === "cartera" ? "Propiedades en cartera" : t === "editor" ? "Editor de reporte" : "Historial"}
          </button>
        ))}
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[120, 90, 90, 90].map((h, i) => (
            <div key={i} className="rp-skeleton" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <div className="rp-fadein">

          {/* ══ TAB: CARTERA ════════════════════════════════════════════════════ */}
          {tab === "cartera" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {propiedadesActivas.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 24px",
                    background: "#111111",
                    border: "1px solid #222222",
                    borderRadius: 14,
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.25 }}>🏠</div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--gfi-text-muted)",
                      marginBottom: 8,
                    }}
                  >
                    Sin propiedades en cartera
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gfi-text-dim)" }}>
                    Cargá propiedades en tu cartera para generar reportes
                  </div>
                </div>
              ) : (
                <div
                  className="rp-grid2"
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
                >
                  {propiedadesActivas.map(prop => {
                    const propietarioId = asignaciones[prop.id];
                    const propietario = propietarioId ? contactos.find(c => c.id === propietarioId) : null;
                    return (
                      <div key={prop.id} className="rp-card">
                        {/* cabecera card */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
                          <div>
                            <div
                              style={{
                                fontFamily: "var(--font-display)",
                                fontWeight: 700,
                                fontSize: 13,
                                color: "#e0e0e0",
                                marginBottom: 3,
                              }}
                            >
                              {prop.tipo ?? "Propiedad"}{prop.zona ? ` · ${prop.zona}` : ""}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--gfi-text-muted)" }}>
                              {prop.operacion ?? "—"} · {fmtPrecio(prop.precio, prop.moneda)}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "3px 9px",
                              borderRadius: 5,
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              background: prop.estado === "activo" || prop.estado === "publicada"
                                ? "rgba(34,197,94,0.12)"
                                : "var(--gfi-border-subtle)",
                              border: `1px solid ${prop.estado === "activo" || prop.estado === "publicada" ? "rgba(34,197,94,0.3)" : "#222222"}`,
                              color: prop.estado === "activo" || prop.estado === "publicada" ? "#3abab6" : "var(--gfi-text-muted)",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {prop.estado ?? "activo"}
                          </span>
                        </div>

                        {/* descripción */}
                        {prop.descripcion && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--gfi-text-muted)",
                              marginBottom: 12,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {prop.descripcion}
                          </div>
                        )}

                        {/* selector de propietario */}
                        <div style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              fontSize: 9,
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              color: "var(--gfi-text-muted)",
                              marginBottom: 5,
                            }}
                          >
                            Propietario asignado
                          </div>
                          <select
                            className="rp-select"
                            value={propietarioId ?? ""}
                            onChange={e => asignarPropietario(prop.id, e.target.value)}
                          >
                            <option value="">— Sin asignar —</option>
                            {contactos.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre ?? c.email ?? c.id}</option>
                            ))}
                          </select>
                        </div>

                        {propietario && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--gfi-text-muted)",
                              marginBottom: 12,
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            {propietario.email && <span>{propietario.email}</span>}
                            {propietario.telefono && <span>{propietario.telefono}</span>}
                          </div>
                        )}

                        {/* acción */}
                        <button
                          className="rp-btn rp-btn-red"
                          onClick={() => abrirEditorParaPropiedad(prop.id)}
                          style={{ width: "100%", textAlign: "center" }}
                        >
                          Generar reporte
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ TAB: EDITOR ═════════════════════════════════════════════════════ */}
          {tab === "editor" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Fila: propiedad + período */}
              <div
                className="rp-card rp-grid2"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
              >
                <div>
                  <div className="rp-section-title">Propiedad</div>
                  <select
                    className="rp-select"
                    value={editorPropiedadId}
                    onChange={e => setEditorPropiedadId(e.target.value)}
                  >
                    <option value="">— Seleccioná una propiedad —</option>
                    {propiedades.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.tipo ?? "Propiedad"}{p.zona ? ` · ${p.zona}` : ""} — {fmtPrecio(p.precio, p.moneda)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="rp-section-title">Período</div>
                  <select
                    className="rp-select"
                    value={editorPeriodo}
                    onChange={e => setEditorPeriodo(e.target.value)}
                  >
                    {periodos.map(p => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Info propiedad seleccionada */}
              {propiedadEditando && (
                <div
                  style={{
                    background: "rgba(153,0,0,0.06)",
                    border: "1px solid rgba(153,0,0,0.2)",
                    borderRadius: 10,
                    padding: "14px 18px",
                    display: "flex",
                    gap: 24,
                    flexWrap: "wrap",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  <span><strong style={{ color: "#e0e0e0" }}>Propiedad:</strong> {propiedadEditando.tipo ?? "—"}</span>
                  <span><strong style={{ color: "#e0e0e0" }}>Barrio:</strong> {propiedadEditando.zona ?? "—"}</span>
                  <span><strong style={{ color: "#e0e0e0" }}>Precio:</strong> {fmtPrecio(propiedadEditando.precio, propiedadEditando.moneda)}</span>
                  <span><strong style={{ color: "#e0e0e0" }}>Propietario:</strong> {propietarioEditando?.nombre ?? <span style={{ color: "var(--gfi-text-dim)" }}>Sin asignar</span>}</span>
                </div>
              )}

              {/* Actividad */}
              <div className="rp-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div className="rp-section-title" style={{ marginBottom: 0 }}>
                    Actividad del período — {editorActividad.length} evento{editorActividad.length !== 1 ? "s" : ""}
                  </div>
                  <button className="rp-btn rp-btn-ghost" onClick={agregarActividad} style={{ fontSize: 12 }}>
                    + Agregar actividad
                  </button>
                </div>

                {/* Resumen estadístico */}
                {editorActividad.length > 0 && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                    {(Object.entries(resumenActividad) as [TipoActividad, number][])
                      .filter(([, count]) => count > 0)
                      .map(([tipo, count]) => (
                        <div
                          key={tipo}
                          style={{
                            background: `${TIPO_ACTIVIDAD_COLOR[tipo]}14`,
                            border: `1px solid ${TIPO_ACTIVIDAD_COLOR[tipo]}35`,
                            borderRadius: 8,
                            padding: "6px 12px",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: TIPO_ACTIVIDAD_COLOR[tipo] }}>{count}</div>
                          <div style={{ fontSize: 9, color: "var(--gfi-text-muted)", marginTop: 1 }}>{TIPO_ACTIVIDAD_LABEL[tipo]}</div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {editorActividad.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "var(--gfi-text-dim)", fontSize: 13 }}>
                    No hay actividad registrada. Hacé clic en "+ Agregar actividad" para comenzar.
                  </div>
                ) : (
                  editorActividad.map(act => (
                    <div key={act.id} className="rp-act-row">
                      <div
                        className="rp-act-grid"
                        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "flex-start" }}
                      >
                        <div>
                          <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>Tipo</div>
                          <select
                            className="rp-select-sm"
                            value={act.tipo}
                            onChange={e => actualizarActividad(act.id, "tipo", e.target.value as TipoActividad)}
                            style={{ width: "100%" }}
                          >
                            <option value="visita">Visita</option>
                            <option value="consulta">Consulta</option>
                            <option value="oferta">Oferta</option>
                            <option value="publicacion">Publicación</option>
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>Fecha</div>
                          <input
                            type="date"
                            className="rp-input"
                            value={act.fecha}
                            onChange={e => actualizarActividad(act.id, "fecha", e.target.value)}
                            style={{ padding: "6px 10px" }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>Descripción</div>
                          <input
                            type="text"
                            className="rp-input"
                            placeholder="Descripción breve"
                            value={act.descripcion}
                            onChange={e => actualizarActividad(act.id, "descripcion", e.target.value)}
                            style={{ padding: "6px 10px" }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>Resultado</div>
                          <input
                            type="text"
                            className="rp-input"
                            placeholder="Resultado"
                            value={act.resultado}
                            onChange={e => actualizarActividad(act.id, "resultado", e.target.value)}
                            style={{ padding: "6px 10px" }}
                          />
                        </div>
                        <div style={{ paddingTop: 22 }}>
                          <button
                            onClick={() => eliminarActividad(act.id)}
                            style={{
                              background: "rgba(153,0,0,0.12)",
                              border: "1px solid rgba(153,0,0,0.25)",
                              borderRadius: 6,
                              color: "#990000",
                              cursor: "pointer",
                              width: 28,
                              height: 28,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 700,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Observaciones + precio sugerido */}
              <div
                className="rp-grid2"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
              >
                <div className="rp-card">
                  <div className="rp-section-title">Observaciones del corredor</div>
                  <textarea
                    className="rp-textarea"
                    placeholder="Escribí tus observaciones para el propietario..."
                    value={editorObservaciones}
                    onChange={e => setEditorObservaciones(e.target.value)}
                    rows={5}
                  />
                </div>

                <div className="rp-card">
                  <div className="rp-section-title">Precio sugerido</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <select
                      className="rp-select-sm"
                      value={editorMonedaSugerida}
                      onChange={e => setEditorMonedaSugerida(e.target.value)}
                    >
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                    </select>
                    <input
                      type="number"
                      className="rp-input"
                      placeholder="Precio sugerido"
                      value={editorPrecioSugerido}
                      onChange={e => setEditorPrecioSugerido(e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                  {propiedadEditando?.precio && (
                    <button
                      className="rp-btn rp-btn-ghost"
                      onClick={() => {
                        setEditorPrecioSugerido(String(propiedadEditando.precio));
                        setEditorMonedaSugerida(propiedadEditando.moneda ?? "USD");
                      }}
                      style={{ fontSize: 11, width: "100%", textAlign: "center" }}
                    >
                      Igual al precio actual ({fmtPrecio(propiedadEditando.precio, propiedadEditando.moneda)})
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: "var(--gfi-text-dim)", marginTop: 10 }}>
                    Dejá en blanco si no querés incluir un precio sugerido en el reporte.
                  </div>
                </div>
              </div>

              {/* Preview del reporte */}
              {propiedadEditando && (
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--gfi-text-dim)",
                      marginBottom: 12,
                    }}
                  >
                    Preview del reporte
                  </div>
                  <div
                    style={{
                      background: "#fff",
                      color: "var(--gfi-bg-secondary)",
                      borderRadius: 12,
                      padding: "32px 36px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {/* header preview */}
                    <div style={{ borderBottom: "3px solid #990000", paddingBottom: 16, marginBottom: 22 }}>
                      <div style={{ fontFamily: "Arial Black, Arial, sans-serif", fontSize: 18, fontWeight: 900, color: "#990000", marginBottom: 8 }}>
                        GFI <span style={{ color: "var(--gfi-bg-secondary)" }}>Inmobiliario</span>
                      </div>
                      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "var(--gfi-bg-secondary)", margin: "0 0 4px" }}>
                        Informe Mensual — <span style={{ color: "#990000" }}>{periodoLabel(editorPeriodo)}</span>
                      </h2>
                      <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Generado el {fechaHoy}</p>
                      {propietarioEditando && (
                        <p style={{ fontSize: 12, color: "#374151", margin: "4px 0 0", fontWeight: 600 }}>
                          Para: {propietarioEditando.nombre ?? "Propietario"}
                          {propietarioEditando.email ? ` · ${propietarioEditando.email}` : ""}
                        </p>
                      )}
                    </div>

                    {/* datos propiedad */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 22 }}>
                      {[
                        { label: "Tipo", valor: propiedadEditando.tipo ?? "—" },
                        { label: "Operación", valor: propiedadEditando.operacion ?? "—" },
                        { label: "Barrio", valor: propiedadEditando.zona ?? "—" },
                        { label: "Precio publicado", valor: fmtPrecio(propiedadEditando.precio, propiedadEditando.moneda) },
                        { label: "Estado", valor: propiedadEditando.estado ?? "—" },
                        ...(editorPrecioSugerido
                          ? [{ label: "Precio sugerido", valor: fmtPrecio(parseFloat(editorPrecioSugerido), editorMonedaSugerida), highlight: true }]
                          : []),
                      ].map((item, i) => (
                        <div
                          key={i}
                          style={{
                            border: `1px solid ${"highlight" in item && item.highlight ? "#990000" : "#e5e7eb"}`,
                            borderRadius: 7,
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "highlight" in item && item.highlight ? "#990000" : "#9ca3af", fontWeight: 700, marginBottom: 3 }}>{item.label}</div>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "highlight" in item && item.highlight ? "#990000" : "var(--gfi-bg-secondary)" }}>{item.valor}</div>
                        </div>
                      ))}
                    </div>

                    {/* tabla actividad */}
                    <div style={{ fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#990000", borderBottom: "1px solid #e5e7eb", paddingBottom: 7, marginBottom: 12 }}>
                      Actividad del período ({editorActividad.length})
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 20 }}>
                      <thead>
                        <tr style={{ background: "#f9fafb" }}>
                          {["Tipo", "Fecha", "Descripción", "Resultado"].map(h => (
                            <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {editorActividad.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: "16px", textAlign: "center", color: "#9ca3af" }}>Sin actividad registrada</td>
                          </tr>
                        ) : (
                          editorActividad.map(a => (
                            <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                              <td style={{ padding: "7px 10px" }}>
                                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${TIPO_ACTIVIDAD_COLOR[a.tipo]}18`, color: TIPO_ACTIVIDAD_COLOR[a.tipo], fontFamily: "var(--font-display)", fontWeight: 700 }}>{TIPO_ACTIVIDAD_LABEL[a.tipo]}</span>
                              </td>
                              <td style={{ padding: "7px 10px", color: "#6b7280" }}>{a.fecha ? fmtFecha(a.fecha) : "—"}</td>
                              <td style={{ padding: "7px 10px", color: "var(--gfi-bg-secondary)" }}>{a.descripcion || "—"}</td>
                              <td style={{ padding: "7px 10px", color: "#374151" }}>{a.resultado || "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* observaciones */}
                    {editorObservaciones && (
                      <>
                        <div style={{ fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#990000", borderBottom: "1px solid #e5e7eb", paddingBottom: 7, marginBottom: 12 }}>Observaciones del corredor</div>
                        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.65, marginBottom: 20, padding: "12px 14px", background: "#f9fafb", borderRadius: 7, border: "1px solid #e5e7eb", whiteSpace: "pre-wrap" }}>{editorObservaciones}</div>
                      </>
                    )}

                    {/* footer preview */}
                    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
                      Grupo Foro Inmobiliario · Informe generado el {fechaHoy}
                    </div>
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="rp-btn rp-btn-red"
                  onClick={guardarReporte}
                  disabled={!editorPropiedadId}
                  style={{ opacity: editorPropiedadId ? 1 : 0.4 }}
                >
                  {editorReporteId ? "Guardar cambios" : "Guardar reporte"}
                </button>
                <button
                  className="rp-btn rp-btn-ghost"
                  onClick={exportarEditorPDF}
                  disabled={!editorPropiedadId}
                  style={{ opacity: editorPropiedadId ? 1 : 0.4 }}
                >
                  Imprimir / PDF
                </button>
                {editorReporteId && (
                  <button
                    className="rp-btn rp-btn-green"
                    onClick={() => { guardarReporte(); if (editorReporteId) marcarEnviado(editorReporteId); }}
                  >
                    Marcar como enviado
                  </button>
                )}
                <button
                  className="rp-btn rp-btn-ghost"
                  onClick={limpiarEditor}
                  style={{ marginLeft: "auto" }}
                >
                  Nuevo reporte
                </button>
              </div>
            </div>
          )}

          {/* ══ TAB: HISTORIAL ══════════════════════════════════════════════════ */}
          {tab === "historial" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* KPI */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { label: "Total reportes", valor: String(kpiHistorial.total), color: "#990000" },
                  { label: "Enviados", valor: String(kpiHistorial.enviados), color: "#3abab6" },
                  { label: "Sin reporte este mes", valor: String(kpiHistorial.sinReporteMes), color: "#d4960c" },
                ].map(kpi => (
                  <div
                    key={kpi.label}
                    className="rp-card"
                    style={{ flex: "1 1 140px", borderTop: `3px solid ${kpi.color}`, textAlign: "center" }}
                  >
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: kpi.color, lineHeight: 1 }}>{kpi.valor}</div>
                    <div style={{ fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gfi-text-muted)", marginTop: 6 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* lista agrupada */}
              {reportes.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 24px",
                    background: "#111111",
                    border: "1px solid #222222",
                    borderRadius: 14,
                  }}
                >
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--gfi-text-dim)", marginBottom: 8 }}>
                    Sin reportes generados
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.18)" }}>
                    Los reportes que guardes aparecerán acá agrupados por propiedad.
                  </div>
                </div>
              ) : (
                Object.entries(reportesPorPropiedad).map(([propiedadId, reps]) => {
                  const propiedad = propiedades.find(p => p.id === propiedadId);
                  return (
                    <div key={propiedadId} className="rp-card">
                      {/* título propiedad */}
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#e0e0e0",
                          marginBottom: 4,
                        }}
                      >
                        {propiedad
                          ? `${propiedad.tipo ?? "Propiedad"}${propiedad.zona ? ` · ${propiedad.zona}` : ""}`
                          : "Propiedad eliminada"}
                      </div>
                      {propiedad && (
                        <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginBottom: 14 }}>
                          {propiedad.operacion ?? "—"} · {fmtPrecio(propiedad.precio, propiedad.moneda)}
                        </div>
                      )}

                      {/* lista reportes de esta propiedad */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {reps
                          .sort((a, b) => b.periodo.localeCompare(a.periodo))
                          .map(rep => {
                            const enviado = rep.enviado;
                            return (
                              <div
                                key={rep.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  padding: "10px 14px",
                                  background: "var(--gfi-bg-card)",
                                  border: "1px solid #222222",
                                  borderRadius: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 120 }}>
                                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#e0e0e0" }}>
                                    {periodoLabel(rep.periodo)}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 2 }}>
                                    {rep.actividad.length} actividad{rep.actividad.length !== 1 ? "es" : ""} · Creado {fmtFecha(rep.created_at)}
                                  </div>
                                </div>

                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: "3px 10px",
                                    borderRadius: 5,
                                    fontFamily: "var(--font-display)",
                                    fontWeight: 700,
                                    background: enviado ? "rgba(34,197,94,0.12)" : "var(--gfi-border-subtle)",
                                    border: `1px solid ${enviado ? "rgba(34,197,94,0.3)" : "#222222"}`,
                                    color: enviado ? "#3abab6" : "var(--gfi-text-muted)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {enviado ? `Enviado ${rep.fecha_envio ? fmtFecha(rep.fecha_envio) : ""}` : "Pendiente"}
                                </span>

                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    className="rp-btn rp-btn-ghost"
                                    style={{ fontSize: 11, padding: "6px 14px" }}
                                    onClick={() => cargarReporteEnEditor(rep)}
                                  >
                                    Ver / Editar
                                  </button>
                                  <button
                                    className="rp-btn rp-btn-ghost"
                                    style={{ fontSize: 11, padding: "6px 14px" }}
                                    onClick={() => exportarPDF(rep)}
                                  >
                                    Reimprimir PDF
                                  </button>
                                  {!enviado && (
                                    <button
                                      className="rp-btn rp-btn-green"
                                      style={{ fontSize: 11, padding: "6px 14px" }}
                                      onClick={() => marcarEnviado(rep.id)}
                                    >
                                      Marcar enviado
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
