"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ── tipos ─────────────────────────────────────────────────────────────────────
interface NegocioNuevo {
  id: string;
  titulo: string;
  etapa: string | null;
  tipo_operacion: string | null;
  valor_operacion: number | null;
  honorarios_pct: number | null;
  moneda: string | null;
  created_at: string;
}

interface NegocioCerrado {
  id: string;
  titulo: string;
  tipo_operacion: string | null;
  valor_operacion: number | null;
  honorarios_pct: number | null;
  split_pct: number | null;
  moneda: string | null;
  updated_at: string;
}

interface ContactoNuevo {
  id: string;
  nombre: string | null;
  apellido: string | null;
  tipo: string | null;
  origen: string | null;
  created_at: string;
}

interface PipelineItem {
  id: string;
  etapa: string | null;
  valor_operacion: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
}

type TabVista = "reporte" | "preview";

// ── constantes ────────────────────────────────────────────────────────────────
const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ETAPAS_ORDEN = ["prospecto", "contactado", "visita", "oferta", "negociacion", "escritura"];

const ETAPA_LABEL: Record<string, string> = {
  prospecto:   "Prospecto",
  contactado:  "Contactado",
  visita:      "Visita",
  oferta:      "Oferta",
  negociacion: "Negociación",
  escritura:   "Escritura",
};

const ETAPA_COLOR: Record<string, string> = {
  prospecto:   "#6b7280",
  contactado:  "#3b82f6",
  visita:      "#8b5cf6",
  oferta:      "#d4960c",
  negociacion: "#b80000",
  escritura:   "#3abab6",
};

const TIPO_CONTACTO_LABEL: Record<string, string> = {
  cliente:     "Cliente",
  propietario: "Propietario",
  colega:      "Colega",
  otro:        "Otro",
};

const DONUT_COLORS: Record<string, string> = {
  cliente:     "#3b82f6",
  propietario: "#3abab6",
  colega:      "#d4960c",
  otro:        "#6b7280",
};

// ── helpers ───────────────────────────────────────────────────────────────────
function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

function mesAnterior(anio: number, mes: number): { anio: number; mes: number } {
  if (mes === 1) return { anio: anio - 1, mes: 12 };
  return { anio, mes: mes - 1 };
}

function fmtARS(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

function fmtFecha(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function calcVariacion(actual: number, anterior: number): number {
  if (anterior === 0) return actual > 0 ? 100 : 0;
  return ((actual - anterior) / anterior) * 100;
}

function arrowColor(v: number): string {
  if (v > 0) return "#3abab6";
  if (v < 0) return "#b80000";
  return "rgba(255,255,255,0.35)";
}

function arrowSymbol(v: number): string {
  if (v > 0) return "↑";
  if (v < 0) return "↓";
  return "—";
}

// ── componente principal ──────────────────────────────────────────────────────
export default function ReporteMensualPage() {
  const ahora         = new Date();
  const mesActualNum  = ahora.getMonth() + 1;
  const anioActualNum = ahora.getFullYear();

  const [periodoKey,   setPeriodoKey]   = useState<string>(
    `${anioActualNum}-${String(mesActualNum).padStart(2, "0")}`
  );
  const [tab,          setTab]          = useState<TabVista>("reporte");
  const [tipoCambio,   setTipoCambio]   = useState<number>(1300);
  const [tcInput,      setTcInput]      = useState<string>("1300");

  const [negociosNuevos,   setNegociosNuevos]   = useState<NegocioNuevo[]>([]);
  const [negociosCerrados, setNegociosCerrados] = useState<NegocioCerrado[]>([]);
  const [contactosNuevos,  setContactosNuevos]  = useState<ContactoNuevo[]>([]);
  const [pipeline,         setPipeline]         = useState<PipelineItem[]>([]);

  const [negNuevosAnt,   setNegNuevosAnt]   = useState<NegocioNuevo[]>([]);
  const [negCerradosAnt, setNegCerradosAnt] = useState<NegocioCerrado[]>([]);
  const [contNuevosAnt,  setContNuevosAnt]  = useState<ContactoNuevo[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [userId,  setUserId]  = useState<string | null>(null);

  // ── períodos disponibles ───────────────────────────────────────────────────
  const periodos = useMemo(() => {
    const lista: { key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(anioActualNum, mesActualNum - 1 - i, 1);
      const a = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${a}-${String(m).padStart(2, "0")}`;
      lista.push({ key, label: `${MESES_NOMBRES[m - 1]} ${a}` });
    }
    return lista;
  }, [anioActualNum, mesActualNum]);

  const mesLabel = useMemo(() => {
    const found = periodos.find(p => p.key === periodoKey);
    return found ? found.label : periodoKey;
  }, [periodos, periodoKey]);

  // ── parseo del período ─────────────────────────────────────────────────────
  const { anio, mes } = useMemo(() => {
    const parts = periodoKey.split("-");
    return { anio: parseInt(parts[0], 10), mes: parseInt(parts[1], 10) };
  }, [periodoKey]);

  const { anio: anioAnt, mes: mesAnt } = useMemo(
    () => mesAnterior(anio, mes),
    [anio, mes]
  );

  function rango(a: number, m: number): { inicio: string; fin: string } {
    const ultimo = ultimoDiaDelMes(a, m);
    const mesStr = String(m).padStart(2, "0");
    const diaStr = String(ultimo).padStart(2, "0");
    return {
      inicio: `${a}-${mesStr}-01`,
      fin:    `${a}-${mesStr}-${diaStr}T23:59:59`,
    };
  }

  // ── carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    cargarDatos(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, periodoKey]);

  const cargarDatos = async (uid: string) => {
    setLoading(true);
    const r  = rango(anio, mes);
    const rA = rango(anioAnt, mesAnt);

    const [
      resNN, resNC, resCN, resPL,
      resNNA, resNCA, resCNA,
    ] = await Promise.all([
      supabase
        .from("crm_negocios")
        .select("id,titulo,etapa,tipo_operacion,valor_operacion,honorarios_pct,moneda,created_at")
        .eq("perfil_id", uid)
        .gte("created_at", r.inicio)
        .lte("created_at", r.fin),

      supabase
        .from("crm_negocios")
        .select("id,titulo,tipo_operacion,valor_operacion,honorarios_pct,split_pct,moneda,updated_at")
        .eq("perfil_id", uid)
        .eq("etapa", "cerrado")
        .gte("updated_at", r.inicio)
        .lte("updated_at", r.fin),

      supabase
        .from("crm_contactos")
        .select("id,nombre,apellido,tipo,origen,created_at")
        .eq("perfil_id", uid)
        .gte("created_at", r.inicio)
        .lte("created_at", r.fin),

      supabase
        .from("crm_negocios")
        .select("id,etapa,valor_operacion,moneda,honorarios_pct")
        .eq("perfil_id", uid)
        .not("etapa", "in", '("cerrado","perdido")'),

      supabase
        .from("crm_negocios")
        .select("id,titulo,etapa,tipo_operacion,valor_operacion,honorarios_pct,moneda,created_at")
        .eq("perfil_id", uid)
        .gte("created_at", rA.inicio)
        .lte("created_at", rA.fin),

      supabase
        .from("crm_negocios")
        .select("id,titulo,tipo_operacion,valor_operacion,honorarios_pct,split_pct,moneda,updated_at")
        .eq("perfil_id", uid)
        .eq("etapa", "cerrado")
        .gte("updated_at", rA.inicio)
        .lte("updated_at", rA.fin),

      supabase
        .from("crm_contactos")
        .select("id,nombre,apellido,tipo,origen,created_at")
        .eq("perfil_id", uid)
        .gte("created_at", rA.inicio)
        .lte("created_at", rA.fin),
    ]);

    setNegociosNuevos((resNN.data ?? []) as NegocioNuevo[]);
    setNegociosCerrados((resNC.data ?? []) as NegocioCerrado[]);
    setContactosNuevos((resCN.data ?? []) as ContactoNuevo[]);
    setPipeline((resPL.data ?? []) as PipelineItem[]);
    setNegNuevosAnt((resNNA.data ?? []) as NegocioNuevo[]);
    setNegCerradosAnt((resNCA.data ?? []) as NegocioCerrado[]);
    setContNuevosAnt((resCNA.data ?? []) as ContactoNuevo[]);

    setLoading(false);
  };

  // ── cálculos ───────────────────────────────────────────────────────────────
  const tc = tipoCambio;

  function honorariosNegCerradoARS(negocio: NegocioCerrado): number {
    const precio = negocio.valor_operacion ?? 0;
    const pct    = negocio.honorarios_pct ?? 3;
    const split  = negocio.split_pct ?? 0;
    const base   = negocio.moneda === "USD" ? precio * tc : precio;
    return (base * pct / 100) * (1 - split / 100);
  }

  function honorariosNegNuevoARS(negocio: NegocioNuevo): number {
    const precio = negocio.valor_operacion ?? 0;
    const pct    = negocio.honorarios_pct ?? 3;
    const base   = negocio.moneda === "USD" ? precio * tc : precio;
    return base * pct / 100;
  }

  function honorariosPipelineARS(item: PipelineItem): number {
    const precio = item.valor_operacion ?? 0;
    const pct    = item.honorarios_pct ?? 3;
    const base   = item.moneda === "USD" ? precio * tc : precio;
    return base * pct / 100;
  }

  const honorariosMes = useMemo(
    () => negociosCerrados.reduce((a, n) => a + honorariosNegCerradoARS(n), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [negociosCerrados, tc]
  );

  const valorPipeline = useMemo(
    () => pipeline.reduce((a, n) => a + honorariosPipelineARS(n), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pipeline, tc]
  );

  const honorariosMesAnt = useMemo(
    () => negCerradosAnt.reduce((a, n) => a + honorariosNegCerradoARS(n), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [negCerradosAnt, tc]
  );

  // ── pipeline por etapa ─────────────────────────────────────────────────────
  const pipelineEtapas = useMemo(() => {
    const counts: Record<string, number> = {};
    ETAPAS_ORDEN.forEach(e => { counts[e] = 0; });
    pipeline.forEach(p => {
      const e = (p.etapa ?? "prospecto").toLowerCase();
      if (counts[e] !== undefined) counts[e]++;
      else counts["prospecto"]++;
    });
    return counts;
  }, [pipeline]);

  const maxEtapa = useMemo(
    () => Math.max(...Object.values(pipelineEtapas), 1),
    [pipelineEtapas]
  );

  // ── distribución contactos por tipo ────────────────────────────────────────
  const contactosPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    contactosNuevos.forEach(c => {
      const t = c.tipo ?? "otro";
      map[t] = (map[t] ?? 0) + 1;
    });
    return map;
  }, [contactosNuevos]);

  // ── donut SVG ─────────────────────────────────────────────────────────────
  const donutSegments = useMemo(() => {
    const total = Object.values(contactosPorTipo).reduce((a, v) => a + v, 0);
    if (total === 0) return [];
    const cx = 50; const cy = 50; const r = 40;
    let startAngle = -Math.PI / 2;
    return Object.entries(contactosPorTipo).map(([tipo, count]) => {
      const pct      = count / total;
      const angle    = pct * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1       = cx + r * Math.cos(startAngle);
      const y1       = cy + r * Math.sin(startAngle);
      const x2       = cx + r * Math.cos(endAngle);
      const y2       = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const path     = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      startAngle     = endAngle;
      return { tipo, count, pct, path };
    });
  }, [contactosPorTipo]);

  // ── tipo de cambio ─────────────────────────────────────────────────────────
  const handleTcBlur = () => {
    const parsed = parseInt(tcInput.replace(/\D/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) setTipoCambio(parsed);
    else setTcInput(String(tipoCambio));
  };

  // ── label mes anterior ─────────────────────────────────────────────────────
  const labelMesAnt = useMemo(() => {
    const key   = `${anioAnt}-${String(mesAnt).padStart(2, "0")}`;
    const found = periodos.find(p => p.key === key);
    return found ? found.label : `${MESES_NOMBRES[mesAnt - 1]} ${anioAnt}`;
  }, [periodos, anioAnt, mesAnt]);

  // ── comparativas ──────────────────────────────────────────────────────────
  const comparativas: {
    metrica: string;
    actual: number;
    anterior: number;
    fmt: (n: number) => string;
  }[] = [
    { metrica: "Negocios cerrados",  actual: negociosCerrados.length, anterior: negCerradosAnt.length,  fmt: n => String(n) },
    { metrica: "Honorarios generados", actual: honorariosMes,          anterior: honorariosMesAnt,       fmt: fmtARS },
    { metrica: "Contactos nuevos",   actual: contactosNuevos.length,  anterior: contNuevosAnt.length,   fmt: n => String(n) },
    { metrica: "Negocios iniciados", actual: negociosNuevos.length,   anterior: negNuevosAnt.length,    fmt: n => String(n) },
  ];

  // ── fecha hoy ──────────────────────────────────────────────────────────────
  const fechaHoy = new Date().toLocaleDateString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // ── exportar PDF ───────────────────────────────────────────────────────────
  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;

    const rowsCerrados = negociosCerrados.map(n => `
      <tr style="background:#f9fafb">
        <td><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#dcfce7;color:#15803d;font-weight:700">Cerrado</span></td>
        <td>${n.tipo_operacion ?? "—"}</td>
        <td>${n.titulo}</td>
        <td>Cierre</td>
        <td style="text-align:right;font-weight:700;color:#15803d">${fmtARS(honorariosNegCerradoARS(n))}</td>
        <td>${fmtFecha(n.updated_at)}</td>
      </tr>`).join("");

    const rowsNuevos = negociosNuevos.map(n => `
      <tr>
        <td><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#dbeafe;color:#1d4ed8;font-weight:700">Nuevo</span></td>
        <td>${n.tipo_operacion ?? "—"}</td>
        <td>${n.titulo}</td>
        <td>${n.etapa ?? "—"}</td>
        <td style="text-align:right;font-weight:700;color:#1d4ed8">${fmtARS(honorariosNegNuevoARS(n))}</td>
        <td>${fmtFecha(n.created_at)}</td>
      </tr>`).join("");

    const rowsContactos = contactosNuevos.map(c => `
      <tr>
        <td>${[c.nombre, c.apellido].filter(Boolean).join(" ") || "—"}</td>
        <td>${TIPO_CONTACTO_LABEL[c.tipo ?? "otro"] ?? c.tipo ?? "—"}</td>
        <td>${c.origen ?? "—"}</td>
        <td>${fmtFecha(c.created_at)}</td>
      </tr>`).join("");

    const rowsComp = comparativas.map(row => {
      const v = calcVariacion(row.actual, row.anterior);
      const col = v > 0 ? "#15803d" : v < 0 ? "#dc2626" : "#6b7280";
      return `<tr>
        <td>${row.metrica}</td>
        <td style="font-weight:700">${row.fmt(row.actual)}</td>
        <td style="color:#9ca3af">${row.fmt(row.anterior)}</td>
        <td style="font-weight:700;color:${col}">${arrowSymbol(v)} ${Math.abs(v) > 0 ? Math.abs(v).toFixed(1) + "%" : "—"}</td>
      </tr>`;
    }).join("");

    win.document.write(`<!DOCTYPE html><html><head>
      <title>Reporte ${mesLabel}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:900px;margin:0 auto}
        h1{font-size:24px;margin:0 0 4px}
        h2{font-size:14px;margin:28px 0 8px;border-bottom:2px solid #990000;padding-bottom:5px;color:#990000;text-transform:uppercase;letter-spacing:0.06em}
        p{font-size:12px;color:#6b7280;margin:0 0 16px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        td,th{padding:8px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:left}
        th{background:#f3f4f6;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280}
        .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
        .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center}
        .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:6px}
        .kpi-valor{font-size:20px;font-weight:800}
        @media print{body{padding:20px}}
      </style>
    </head><body>
      <h1>Reporte Mensual — ${mesLabel}</h1>
      <p>Generado el ${fechaHoy} · Tipo de cambio USD/ARS: $${tc.toLocaleString("es-AR")}</p>
      <h2>Resumen ejecutivo</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Negocios cerrados</div><div class="kpi-valor" style="color:#990000">${negociosCerrados.length}</div></div>
        <div class="kpi"><div class="kpi-label">Honorarios generados</div><div class="kpi-valor" style="color:#22807c">${fmtARS(honorariosMes)}</div></div>
        <div class="kpi"><div class="kpi-label">Contactos nuevos</div><div class="kpi-valor" style="color:#2563eb">${contactosNuevos.length}</div></div>
        <div class="kpi"><div class="kpi-label">Pipeline activo</div><div class="kpi-valor" style="color:#d97706">${fmtARS(valorPipeline)}</div></div>
      </div>
      <h2>Negocios del mes</h2>
      <table><thead><tr><th>Estado</th><th>Tipo</th><th>Título</th><th>Etapa</th><th style="text-align:right">Hon. est.</th><th>Fecha</th></tr></thead>
      <tbody>${rowsCerrados}${rowsNuevos}${!rowsCerrados && !rowsNuevos ? "<tr><td colspan='6' style='text-align:center;color:#9ca3af'>Sin negocios</td></tr>" : ""}</tbody></table>
      <h2>Contactos nuevos</h2>
      <table><thead><tr><th>Nombre</th><th>Tipo</th><th>Origen</th><th>Fecha</th></tr></thead>
      <tbody>${rowsContactos || "<tr><td colspan='4' style='text-align:center;color:#9ca3af'>Sin contactos</td></tr>"}</tbody></table>
      <h2>Comparativa vs ${labelMesAnt}</h2>
      <table><thead><tr><th>Métrica</th><th>${mesLabel}</th><th>${labelMesAnt}</th><th>Variación</th></tr></thead>
      <tbody>${rowsComp}</tbody></table>
      <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">
        Reporte generado por Grupo Foro Inmobiliario CRM · ${fechaHoy}
      </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "0 0 80px",
        fontFamily: "Inter, sans-serif",
        color: "#fff",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .rm-input { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:7px; color:#fff; padding:8px 12px; font-size:13px; font-family:Inter,sans-serif; outline:none; }
        .rm-input:focus { border-color:rgba(153,0,0,0.45); }
        .rm-select { background:#111; border:1px solid rgba(255,255,255,0.12); border-radius:7px; color:#fff; padding:8px 12px; font-size:13px; font-family:Inter,sans-serif; outline:none; cursor:pointer; }
        .rm-tab { padding:8px 18px; border-radius:7px; font-family:Montserrat,sans-serif; font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; border:1px solid transparent; transition:background 0.15s,color 0.15s; }
        .rm-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:20px; }
        .rm-section-title { font-family:Montserrat,sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:16px; }
        @keyframes rmFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .rm-fadein { animation:rmFadeIn 0.3s ease both; }
        @keyframes rmSkeleton { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .rm-skeleton { animation:rmSkeleton 1.2s ease-in-out infinite; background:rgba(255,255,255,0.07); border-radius:10px; }
        .rm-tbl { width:100%; border-collapse:collapse; font-size:12px; font-family:Inter,sans-serif; }
        .rm-tbl th { padding:8px 12px; text-align:left; font-size:9px; font-family:Montserrat,sans-serif; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.3); border-bottom:1px solid rgba(255,255,255,0.08); }
        .rm-tbl td { padding:9px 12px; border-bottom:1px solid rgba(255,255,255,0.04); vertical-align:middle; }
        @media(max-width:640px){
          .rm-kpi-grid { grid-template-columns:repeat(2,1fr) !important; }
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "Montserrat,sans-serif",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.22)",
              marginBottom: 6,
            }}
          >
            CRM — Reporte Mensual
          </div>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 28,
              color: "#fff",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Reporte <span style={{ color: "#990000" }}>Mensual</span>
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", marginTop: 5, marginBottom: 0 }}>
            Actividad ejecutiva del corredor · Generado el {fechaHoy}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* Selector período */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 9,
                fontFamily: "Montserrat,sans-serif",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Período
            </span>
            <select
              className="rm-select"
              value={periodoKey}
              onChange={e => setPeriodoKey(e.target.value)}
            >
              {periodos.map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Tipo de cambio */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 9,
                fontFamily: "Montserrat,sans-serif",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              USD/ARS
            </span>
            <input
              className="rm-input"
              style={{ width: 90 }}
              type="text"
              inputMode="numeric"
              value={tcInput}
              onChange={e => setTcInput(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={handleTcBlur}
              onKeyDown={e => { if (e.key === "Enter") handleTcBlur(); }}
            />
          </div>

          {/* Exportar PDF */}
          <button
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              background: "#990000",
              color: "#fff",
              border: "none",
              fontFamily: "Montserrat,sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={exportarPDF}
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["reporte", "preview"] as TabVista[]).map(t => (
          <button
            key={t}
            className="rm-tab"
            style={{
              background: tab === t ? "#990000" : "rgba(255,255,255,0.05)",
              color:      tab === t ? "#fff"    : "rgba(255,255,255,0.4)",
              border:     tab === t ? "1px solid #990000" : "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={() => setTab(t)}
          >
            {t === "reporte" ? "Vista Reporte" : "Preview Exportación"}
          </button>
        ))}
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="rm-skeleton" style={{ height: 100 }} />
          <div className="rm-skeleton" style={{ height: 220 }} />
          <div className="rm-skeleton" style={{ height: 180 }} />
          <div className="rm-skeleton" style={{ height: 160 }} />
        </div>
      ) : (
        <div className="rm-fadein">

          {/* ══ TAB: VISTA REPORTE ══════════════════════════════════════════ */}
          {tab === "reporte" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Título del período */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 4,
                    height: 32,
                    background: "#990000",
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <h2
                    style={{
                      fontFamily: "Montserrat,sans-serif",
                      fontWeight: 800,
                      fontSize: 20,
                      color: "#fff",
                      margin: 0,
                    }}
                  >
                    {mesLabel}
                  </h2>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", margin: 0 }}>
                    TC USD/ARS: ${tc.toLocaleString("es-AR")}
                  </p>
                </div>
              </div>

              {/* ─ Sección 1: KPI Cards ────────────────────────────────────── */}
              <div
                className="rm-kpi-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}
              >
                {[
                  {
                    label: "Negocios cerrados",
                    valor: String(negociosCerrados.length),
                    sub:   `en ${mesLabel}`,
                    color: "#990000",
                  },
                  {
                    label: "Honorarios generados",
                    valor: fmtARS(honorariosMes),
                    sub:   "netos del mes",
                    color: "#3abab6",
                  },
                  {
                    label: "Contactos nuevos",
                    valor: String(contactosNuevos.length),
                    sub:   "incorporados",
                    color: "#3b82f6",
                  },
                  {
                    label: "Pipeline activo",
                    valor: fmtARS(valorPipeline),
                    sub:   "hon. estimados totales",
                    color: "#d4960c",
                  },
                ].map(card => (
                  <div
                    key={card.label}
                    className="rm-card"
                    style={{ borderTop: `3px solid ${card.color}` }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontFamily: "Montserrat,sans-serif",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.3)",
                        marginBottom: 10,
                      }}
                    >
                      {card.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 22,
                        fontWeight: 800,
                        color: card.color,
                        lineHeight: 1,
                        marginBottom: 6,
                        wordBreak: "break-all",
                      }}
                    >
                      {card.valor}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                      {card.sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* ─ Sección 2: Negocios del mes ─────────────────────────────── */}
              <div className="rm-card">
                <div className="rm-section-title">
                  Negocios del mes —{" "}
                  <span style={{ color: "#3abab6" }}>{negociosCerrados.length} cerrados</span>
                  {" · "}
                  <span style={{ color: "#3b82f6" }}>{negociosNuevos.length} iniciados</span>
                </div>

                {negociosCerrados.length === 0 && negociosNuevos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                    Sin negocios registrados en este período
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="rm-tbl">
                      <thead>
                        <tr>
                          <th>Estado</th>
                          <th>Tipo</th>
                          <th>Título</th>
                          <th>Etapa</th>
                          <th style={{ textAlign: "right" }}>Hon. est.</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {negociosCerrados.map(n => (
                          <tr key={n.id}>
                            <td>
                              <span
                                style={{
                                  fontSize: 10,
                                  background: "rgba(34,197,94,0.12)",
                                  border: "1px solid rgba(34,197,94,0.3)",
                                  borderRadius: 4,
                                  padding: "2px 7px",
                                  color: "#3abab6",
                                  fontFamily: "Montserrat,sans-serif",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Cerrado
                              </span>
                            </td>
                            <td style={{ color: "rgba(255,255,255,0.5)" }}>{n.tipo_operacion ?? "—"}</td>
                            <td style={{ color: "#fff", fontWeight: 500 }}>{n.titulo}</td>
                            <td style={{ color: "rgba(255,255,255,0.4)" }}>Cierre</td>
                            <td
                              style={{
                                textAlign: "right",
                                fontFamily: "Montserrat,sans-serif",
                                fontWeight: 700,
                                color: "#3abab6",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtARS(honorariosNegCerradoARS(n))}
                            </td>
                            <td style={{ color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                              {fmtFecha(n.updated_at)}
                            </td>
                          </tr>
                        ))}
                        {negociosNuevos.map(n => (
                          <tr key={n.id} style={{ background: "rgba(59,130,246,0.03)" }}>
                            <td>
                              <span
                                style={{
                                  fontSize: 10,
                                  background: "rgba(59,130,246,0.1)",
                                  border: "1px solid rgba(59,130,246,0.25)",
                                  borderRadius: 4,
                                  padding: "2px 7px",
                                  color: "#3b82f6",
                                  fontFamily: "Montserrat,sans-serif",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Nuevo
                              </span>
                            </td>
                            <td style={{ color: "rgba(255,255,255,0.5)" }}>{n.tipo_operacion ?? "—"}</td>
                            <td style={{ color: "#fff", fontWeight: 500 }}>{n.titulo}</td>
                            <td style={{ color: "rgba(255,255,255,0.4)" }}>{n.etapa ?? "—"}</td>
                            <td
                              style={{
                                textAlign: "right",
                                fontFamily: "Montserrat,sans-serif",
                                fontWeight: 700,
                                color: "#3b82f6",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtARS(honorariosNegNuevoARS(n))}
                            </td>
                            <td style={{ color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                              {fmtFecha(n.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ─ Sección 3: Contactos nuevos ─────────────────────────────── */}
              <div className="rm-card">
                <div className="rm-section-title">
                  Contactos nuevos — {contactosNuevos.length} incorporados
                </div>

                <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {/* Tabla */}
                  <div style={{ flex: 1, minWidth: 260, overflowX: "auto" }}>
                    {contactosNuevos.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "28px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                        Sin contactos nuevos en este período
                      </div>
                    ) : (
                      <table className="rm-tbl">
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>Origen</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contactosNuevos.map(c => (
                            <tr key={c.id}>
                              <td style={{ color: "#fff", fontWeight: 500 }}>
                                {[c.nombre, c.apellido].filter(Boolean).join(" ") || "—"}
                              </td>
                              <td>
                                {c.tipo ? (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      padding: "2px 7px",
                                      borderRadius: 4,
                                      background: `${DONUT_COLORS[c.tipo] ?? "#6b7280"}18`,
                                      border: `1px solid ${DONUT_COLORS[c.tipo] ?? "#6b7280"}40`,
                                      color: DONUT_COLORS[c.tipo] ?? "#9ca3af",
                                      fontFamily: "Montserrat,sans-serif",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {TIPO_CONTACTO_LABEL[c.tipo] ?? c.tipo}
                                  </span>
                                ) : (
                                  <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>
                                )}
                              </td>
                              <td style={{ color: "rgba(255,255,255,0.4)" }}>{c.origen ?? "—"}</td>
                              <td style={{ color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                                {fmtFecha(c.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Donut SVG */}
                  {donutSegments.length > 0 && (
                    <div style={{ flexShrink: 0, width: 140 }}>
                      <svg width={100} height={100} viewBox="0 0 100 100" style={{ display: "block", margin: "0 auto" }}>
                        {donutSegments.map(seg => (
                          <path
                            key={seg.tipo}
                            d={seg.path}
                            fill={DONUT_COLORS[seg.tipo] ?? "#6b7280"}
                            stroke="#0a0a0a"
                            strokeWidth={2}
                          />
                        ))}
                        <circle cx={50} cy={50} r={24} fill="#0a0a0a" />
                        <text
                          x={50}
                          y={47}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.45)"
                          fontSize={8}
                          fontFamily="Montserrat,sans-serif"
                          fontWeight={700}
                        >
                          TOTAL
                        </text>
                        <text
                          x={50}
                          y={58}
                          textAnchor="middle"
                          fill="#fff"
                          fontSize={10}
                          fontFamily="Montserrat,sans-serif"
                          fontWeight={800}
                        >
                          {contactosNuevos.length}
                        </text>
                      </svg>

                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                        {donutSegments.map(seg => (
                          <div key={seg.tipo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                background: DONUT_COLORS[seg.tipo] ?? "#6b7280",
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                              {TIPO_CONTACTO_LABEL[seg.tipo] ?? seg.tipo}{" "}
                              <span style={{ color: "rgba(255,255,255,0.25)" }}>({seg.count})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ─ Sección 4: Pipeline por etapa ───────────────────────────── */}
              <div className="rm-card">
                <div className="rm-section-title">
                  Estado del pipeline — {pipeline.length} negocio{pipeline.length !== 1 ? "s" : ""} activo{pipeline.length !== 1 ? "s" : ""}
                </div>

                {/* Funnel SVG horizontal */}
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
                  <svg
                    width="100%"
                    height={80}
                    viewBox="0 0 600 80"
                    preserveAspectRatio="none"
                    style={{ display: "block", minWidth: 400 }}
                  >
                    <line x1={0} y1={62} x2={600} y2={62} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                    {ETAPAS_ORDEN.map((etapa, i) => {
                      const count = pipelineEtapas[etapa] ?? 0;
                      const slotW = 600 / ETAPAS_ORDEN.length;
                      const barH  = maxEtapa > 0 ? Math.max(count > 0 ? 6 : 0, (count / maxEtapa) * 52) : 0;
                      const x     = i * slotW + 4;
                      const w     = slotW - 8;
                      const y     = 60 - barH;
                      const color = ETAPA_COLOR[etapa] ?? "#6b7280";
                      return (
                        <g key={etapa}>
                          {count > 0 && (
                            <rect x={x} y={y} width={w} height={barH} fill={color} fillOpacity={0.75} rx={4} />
                          )}
                          {count > 0 && (
                            <text
                              x={x + w / 2}
                              y={y - 4}
                              textAnchor="middle"
                              fill={color}
                              fontSize={9}
                              fontFamily="Montserrat,sans-serif"
                              fontWeight={700}
                            >
                              {count}
                            </text>
                          )}
                          <text
                            x={x + w / 2}
                            y={74}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.3)"
                            fontSize={8}
                            fontFamily="Montserrat,sans-serif"
                          >
                            {ETAPA_LABEL[etapa]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Badges por etapa */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ETAPAS_ORDEN.map(etapa => {
                    const count = pipelineEtapas[etapa] ?? 0;
                    const color = ETAPA_COLOR[etapa] ?? "#6b7280";
                    return (
                      <div
                        key={etapa}
                        style={{
                          background: `${color}12`,
                          border: `1px solid ${color}30`,
                          borderRadius: 8,
                          padding: "8px 14px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "Montserrat,sans-serif",
                            fontSize: 18,
                            fontWeight: 800,
                            color: count > 0 ? color : "rgba(255,255,255,0.15)",
                          }}
                        >
                          {count}
                        </div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                          {ETAPA_LABEL[etapa]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ─ Sección 5: Comparativa vs mes anterior ──────────────────── */}
              <div className="rm-card">
                <div className="rm-section-title">
                  Comparativa — {mesLabel} vs {labelMesAnt}
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="rm-tbl">
                    <thead>
                      <tr>
                        <th>Métrica</th>
                        <th style={{ textAlign: "right" }}>{mesLabel}</th>
                        <th style={{ textAlign: "right" }}>{labelMesAnt}</th>
                        <th style={{ textAlign: "right" }}>Variación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativas.map(row => {
                        const variacion = calcVariacion(row.actual, row.anterior);
                        const color     = arrowColor(variacion);
                        const arrow     = arrowSymbol(variacion);
                        return (
                          <tr key={row.metrica}>
                            <td
                              style={{
                                fontFamily: "Montserrat,sans-serif",
                                fontWeight: 600,
                                color: "#fff",
                              }}
                            >
                              {row.metrica}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontFamily: "Montserrat,sans-serif",
                                fontWeight: 700,
                                color: "#fff",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.fmt(row.actual)}
                            </td>
                            <td style={{ textAlign: "right", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                              {row.fmt(row.anterior)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontFamily: "Montserrat,sans-serif",
                                fontWeight: 700,
                                color,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {arrow}{" "}
                              {Math.abs(variacion) > 0 ? `${Math.abs(variacion).toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ══ TAB: PREVIEW EXPORTACIÓN ════════════════════════════════════ */}
          {tab === "preview" && (
            <div
              style={{
                background: "#fff",
                color: "#000",
                borderRadius: 12,
                padding: "40px 48px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {/* Cabecera preview */}
              <div style={{ borderBottom: "3px solid #990000", paddingBottom: 18, marginBottom: 28 }}>
                <h1
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 26,
                    color: "#000",
                    margin: 0,
                  }}
                >
                  Reporte Mensual —{" "}
                  <span style={{ color: "#990000" }}>{mesLabel}</span>
                </h1>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "6px 0 0" }}>
                  Generado el {fechaHoy} · TC USD/ARS: ${tc.toLocaleString("es-AR")}
                </p>
              </div>

              {/* KPI preview */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 14,
                  marginBottom: 32,
                }}
              >
                {[
                  { label: "Negocios cerrados",   valor: String(negociosCerrados.length), color: "#990000" },
                  { label: "Honorarios generados", valor: fmtARS(honorariosMes),          color: "#22807c" },
                  { label: "Contactos nuevos",     valor: String(contactosNuevos.length), color: "#2563eb" },
                  { label: "Pipeline activo",      valor: fmtARS(valorPipeline),          color: "#d97706" },
                ].map(card => (
                  <div
                    key={card.label}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: "14px 16px",
                      borderTop: `3px solid ${card.color}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontFamily: "Montserrat,sans-serif",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#9ca3af",
                        marginBottom: 6,
                      }}
                    >
                      {card.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "Montserrat,sans-serif",
                        fontSize: 18,
                        fontWeight: 800,
                        color: card.color,
                        wordBreak: "break-all",
                      }}
                    >
                      {card.valor}
                    </div>
                  </div>
                ))}
              </div>

              {/* Negocios preview */}
              <h2
                style={{
                  fontFamily: "Montserrat,sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  color: "#111",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  borderBottom: "1px solid #e5e7eb",
                  paddingBottom: 8,
                  marginBottom: 12,
                  marginTop: 0,
                }}
              >
                Negocios del mes
              </h2>
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 28 }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Estado", "Tipo", "Título", "Etapa", "Hon. est.", "Fecha"].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          fontSize: 10,
                          fontFamily: "Montserrat,sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#6b7280",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {negociosCerrados.map(n => (
                    <tr key={n.id} style={{ borderBottom: "1px solid #f3f4f6", background: "#f9fafb" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#dcfce7", color: "#15803d", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                          Cerrado
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#6b7280" }}>{n.tipo_operacion ?? "—"}</td>
                      <td style={{ padding: "8px 10px", color: "#111", fontWeight: 600 }}>{n.titulo}</td>
                      <td style={{ padding: "8px 10px", color: "#6b7280" }}>Cierre</td>
                      <td style={{ padding: "8px 10px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#15803d" }}>
                        {fmtARS(honorariosNegCerradoARS(n))}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#9ca3af" }}>{fmtFecha(n.updated_at)}</td>
                    </tr>
                  ))}
                  {negociosNuevos.map(n => (
                    <tr key={n.id} style={{ borderBottom: "1px solid #f3f4f6", background: "#eff6ff" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#dbeafe", color: "#1d4ed8", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                          Nuevo
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#6b7280" }}>{n.tipo_operacion ?? "—"}</td>
                      <td style={{ padding: "8px 10px", color: "#111", fontWeight: 600 }}>{n.titulo}</td>
                      <td style={{ padding: "8px 10px", color: "#6b7280" }}>{n.etapa ?? "—"}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#1d4ed8" }}>
                        {fmtARS(honorariosNegNuevoARS(n))}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#9ca3af" }}>{fmtFecha(n.created_at)}</td>
                    </tr>
                  ))}
                  {negociosCerrados.length === 0 && negociosNuevos.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#9ca3af" }}>
                        Sin negocios en este período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Contactos preview */}
              <h2
                style={{
                  fontFamily: "Montserrat,sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  color: "#111",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  borderBottom: "1px solid #e5e7eb",
                  paddingBottom: 8,
                  marginBottom: 12,
                  marginTop: 0,
                }}
              >
                Contactos nuevos
              </h2>
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 28 }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Nombre", "Tipo", "Origen", "Fecha"].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          fontSize: 10,
                          fontFamily: "Montserrat,sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#6b7280",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contactosNuevos.map(c => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 10px", color: "#111", fontWeight: 500 }}>
                        {[c.nombre, c.apellido].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#6b7280" }}>
                        {TIPO_CONTACTO_LABEL[c.tipo ?? "otro"] ?? c.tipo ?? "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#6b7280" }}>{c.origen ?? "—"}</td>
                      <td style={{ padding: "8px 10px", color: "#9ca3af" }}>{fmtFecha(c.created_at)}</td>
                    </tr>
                  ))}
                  {contactosNuevos.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "#9ca3af" }}>
                        Sin contactos en este período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Comparativa preview */}
              <h2
                style={{
                  fontFamily: "Montserrat,sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  color: "#111",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  borderBottom: "1px solid #e5e7eb",
                  paddingBottom: 8,
                  marginBottom: 12,
                  marginTop: 0,
                }}
              >
                Comparativa {mesLabel} vs {labelMesAnt}
              </h2>
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 28 }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Métrica", mesLabel, labelMesAnt, "Variación"].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          fontSize: 10,
                          fontFamily: "Montserrat,sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#6b7280",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparativas.map(row => {
                    const variacion = calcVariacion(row.actual, row.anterior);
                    const isPos     = variacion > 0;
                    const isNeg     = variacion < 0;
                    const col       = isPos ? "#15803d" : isNeg ? "#dc2626" : "#6b7280";
                    const arr       = arrowSymbol(variacion);
                    return (
                      <tr key={row.metrica} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 10px", color: "#111", fontWeight: 600 }}>{row.metrica}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#111" }}>
                          {row.fmt(row.actual)}
                        </td>
                        <td style={{ padding: "8px 10px", color: "#9ca3af" }}>{row.fmt(row.anterior)}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: col }}>
                          {arr}{" "}
                          {Math.abs(variacion) > 0 ? `${Math.abs(variacion).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer preview */}
              <div
                style={{
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: 14,
                  fontSize: 11,
                  color: "#9ca3af",
                  textAlign: "center",
                }}
              >
                Reporte generado por Grupo Foro Inmobiliario CRM · {fechaHoy}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
