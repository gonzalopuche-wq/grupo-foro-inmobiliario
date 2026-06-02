"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoCampana =
  | "redes_sociales"
  | "email"
  | "whatsapp"
  | "portal_inmobiliario"
  | "flyer_digital"
  | "referidos"
  | "open_house"
  | "otro";

type ObjetivoCampana =
  | "captacion"
  | "ventas"
  | "alquileres"
  | "marca_personal"
  | "otro";

type EstadoCampana = "planificada" | "activa" | "pausada" | "finalizada";

interface Campana {
  id: string;
  nombre: string;
  tipo: TipoCampana;
  objetivo: ObjetivoCampana;
  estado: EstadoCampana;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto: number;
  gasto_real: number;
  leads_objetivo: number;
  leads_obtenidos: number;
  conversiones: number;
  descripcion: string;
  canales: string[];
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CANALES_DISPONIBLES = [
  "instagram",
  "facebook",
  "zonaprop",
  "argenprop",
  "mercadolibre",
  "olx",
  "linkedin",
  "twitter",
  "tiktok",
  "youtube",
  "whatsapp",
  "email",
  "google_ads",
  "flyers_fisicos",
  "radio",
  "portales_locales",
];

const TIPO_LABEL: Record<TipoCampana, string> = {
  redes_sociales: "Redes Sociales",
  email: "Email Marketing",
  whatsapp: "WhatsApp",
  portal_inmobiliario: "Portal Inmobiliario",
  flyer_digital: "Flyer Digital",
  referidos: "Referidos",
  open_house: "Open House",
  otro: "Otro",
};

const OBJETIVO_LABEL: Record<ObjetivoCampana, string> = {
  captacion: "Captación",
  ventas: "Ventas",
  alquileres: "Alquileres",
  marca_personal: "Marca Personal",
  otro: "Otro",
};

const ESTADO_LABEL: Record<EstadoCampana, string> = {
  planificada: "Planificada",
  activa: "Activa",
  pausada: "Pausada",
  finalizada: "Finalizada",
};

const ESTADO_COLOR: Record<EstadoCampana, string> = {
  planificada: "#6b7280",
  activa: "#990000",
  pausada: "#d4960c",
  finalizada: "#3abab6",
};

const TIPO_COLOR: Record<TipoCampana, string> = {
  redes_sociales: "#8b5cf6",
  email: "#3b82f6",
  whatsapp: "#3abab6",
  portal_inmobiliario: "#d4960c",
  flyer_digital: "#ec4899",
  referidos: "#14b8a6",
  open_house: "#d4960c",
  otro: "#6b7280",
};

const OBJETIVO_COLOR: Record<ObjetivoCampana, string> = {
  captacion: "#8b5cf6",
  ventas: "#3abab6",
  alquileres: "#3b82f6",
  marca_personal: "#ec4899",
  otro: "#6b7280",
};

// ─── Ejemplo data ─────────────────────────────────────────────────────────────

const EJEMPLOS: Campana[] = [
  {
    id: "c1",
    nombre: "Temporada de ventas Mayo 2026",
    tipo: "redes_sociales",
    objetivo: "ventas",
    estado: "activa",
    fecha_inicio: "2026-05-01",
    fecha_fin: "2026-05-31",
    presupuesto: 50000,
    gasto_real: 32000,
    leads_objetivo: 30,
    leads_obtenidos: 18,
    conversiones: 3,
    descripcion: "Campaña de captación de compradores para propiedades en venta durante mayo.",
    canales: ["instagram", "facebook", "google_ads"],
    created_at: "2026-04-28T10:00:00.000Z",
  },
  {
    id: "c2",
    nombre: "Captación de propietarios Q2",
    tipo: "email",
    objetivo: "captacion",
    estado: "activa",
    fecha_inicio: "2026-04-01",
    fecha_fin: "2026-06-30",
    presupuesto: 20000,
    gasto_real: 10000,
    leads_objetivo: 20,
    leads_obtenidos: 12,
    conversiones: 2,
    descripcion: "Campaña de email y WhatsApp para captar propietarios que quieran vender o alquilar.",
    canales: ["email", "whatsapp"],
    created_at: "2026-03-25T09:00:00.000Z",
  },
  {
    id: "c3",
    nombre: "Open House Macrocentro",
    tipo: "open_house",
    objetivo: "ventas",
    estado: "finalizada",
    fecha_inicio: "2026-03-15",
    fecha_fin: "2026-04-15",
    presupuesto: 15000,
    gasto_real: 14500,
    leads_objetivo: 25,
    leads_obtenidos: 31,
    conversiones: 5,
    descripcion: "Evento open house en propiedades del macrocentro para interesados en comprar.",
    canales: ["instagram", "zonaprop", "argenprop", "flyers_fisicos"],
    created_at: "2026-03-01T08:00:00.000Z",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function diasRestantes(fechaFin: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);
  return Math.ceil((fin.getTime() - hoy.getTime()) / 86400000);
}

function formatFecha(str: string): string {
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function generarId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {label}
    </span>
  );
}

function ProgressBar({
  value,
  max,
  color,
  height = 6,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      style={{
        height,
        background: "#222222",
        borderRadius: height / 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: height / 2,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<Campana, "id" | "created_at"> = {
  nombre: "",
  tipo: "redes_sociales",
  objetivo: "ventas",
  estado: "planificada",
  fecha_inicio: "",
  fecha_fin: "",
  presupuesto: 0,
  gasto_real: 0,
  leads_objetivo: 0,
  leads_obtenidos: 0,
  conversiones: 0,
  descripcion: "",
  canales: [],
};

export default function CampanasMarketingPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [tab, setTab] = useState<"activas" | "analisis" | "calendario">("activas");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Campana | null>(null);
  const [form, setForm] = useState<Omit<Campana, "id" | "created_at">>(EMPTY_FORM);
  const [honorarioRef, setHonorarioRef] = useState(500000);
  const [filtroEstado, setFiltroEstado] = useState<EstadoCampana | "todas">("todas");
  const [filtroTipo, setFiltroTipo] = useState<TipoCampana | "todos">("todos");
  const [sortCol, setSortCol] = useState<string>("nombre");
  const [sortAsc, setSortAsc] = useState(true);

  // Auth + load from Supabase
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: row } = await supabase
        .from("crm_campanas_marketing")
        .select("campanas")
        .eq("perfil_id", userId)
        .maybeSingle();
      if (row?.campanas && Array.isArray(row.campanas) && (row.campanas as Campana[]).length > 0) {
        setCampanas(row.campanas as Campana[]);
      } else {
        setCampanas(EJEMPLOS);
        supabase.from("crm_campanas_marketing").upsert(
          { perfil_id: userId, campanas: EJEMPLOS, updated_at: new Date().toISOString() },
          { onConflict: "perfil_id" }
        ).then(() => {});
      }
    });
  }, []);

  const guardarSB = useCallback((items: Campana[]) => {
    if (!uid) return;
    supabase.from("crm_campanas_marketing").upsert(
      { perfil_id: uid, campanas: items, updated_at: new Date().toISOString() },
      { onConflict: "perfil_id" }
    ).then(() => {});
  }, [uid]);

  function save(data: Campana[]) {
    setCampanas(data);
    guardarSB(data);
  }

  function openNew() {
    setEditando(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(c: Campana) {
    setEditando(c);
    setForm({
      nombre: c.nombre,
      tipo: c.tipo,
      objetivo: c.objetivo,
      estado: c.estado,
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
      presupuesto: c.presupuesto,
      gasto_real: c.gasto_real,
      leads_objetivo: c.leads_objetivo,
      leads_obtenidos: c.leads_obtenidos,
      conversiones: c.conversiones,
      descripcion: c.descripcion,
      canales: [...c.canales],
    });
    setShowModal(true);
  }

  function handleSubmit() {
    if (!form.nombre.trim()) return;
    if (editando) {
      save(campanas.map((c) => (c.id === editando.id ? { ...editando, ...form } : c)));
    } else {
      const nueva: Campana = { ...form, id: generarId(), created_at: new Date().toISOString() };
      save([...campanas, nueva]);
    }
    setShowModal(false);
  }

  function cambiarEstado(id: string, estado: EstadoCampana) {
    save(campanas.map((c) => (c.id === id ? { ...c, estado } : c)));
  }

  function toggleCanal(canal: string) {
    setForm((f) => ({
      ...f,
      canales: f.canales.includes(canal)
        ? f.canales.filter((x) => x !== canal)
        : [...f.canales, canal],
    }));
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const activas = useMemo(
    () => campanas.filter((c) => c.estado === "activa" || c.estado === "planificada"),
    [campanas]
  );

  const inversionTotal = useMemo(
    () => activas.reduce((s, c) => s + c.gasto_real, 0),
    [activas]
  );

  const leadsTotal = useMemo(
    () => activas.reduce((s, c) => s + c.leads_obtenidos, 0),
    [activas]
  );

  const conversionTotal = useMemo(() => {
    const totalConv = activas.reduce((s, c) => s + c.conversiones, 0);
    const totalLeads = activas.reduce((s, c) => s + c.leads_obtenidos, 0);
    return totalLeads > 0 ? (totalConv / totalLeads) * 100 : 0;
  }, [activas]);

  const roiEstimado = useMemo(() => {
    const totalConv = activas.reduce((s, c) => s + c.conversiones, 0);
    const retorno = totalConv * honorarioRef;
    return inversionTotal > 0 ? ((retorno - inversionTotal) / inversionTotal) * 100 : 0;
  }, [activas, honorarioRef, inversionTotal]);

  // ── Analysis data ─────────────────────────────────────────────────────────

  const campanasFiltradas = useMemo(() => {
    let list = [...campanas];
    if (filtroEstado !== "todas") list = list.filter((c) => c.estado === filtroEstado);
    if (filtroTipo !== "todos") list = list.filter((c) => c.tipo === filtroTipo);
    return list;
  }, [campanas, filtroEstado, filtroTipo]);

  const campanasSorted = useMemo(() => {
    return [...campanasFiltradas].sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (sortCol === "nombre") { va = a.nombre; vb = b.nombre; }
      else if (sortCol === "tipo") { va = a.tipo; vb = b.tipo; }
      else if (sortCol === "leads") { va = a.leads_obtenidos; vb = b.leads_obtenidos; }
      else if (sortCol === "conversiones") { va = a.conversiones; vb = b.conversiones; }
      else if (sortCol === "tasa") {
        va = a.leads_obtenidos > 0 ? a.conversiones / a.leads_obtenidos : 0;
        vb = b.leads_obtenidos > 0 ? b.conversiones / b.leads_obtenidos : 0;
      } else if (sortCol === "cpl") {
        va = a.leads_obtenidos > 0 ? a.gasto_real / a.leads_obtenidos : Infinity;
        vb = b.leads_obtenidos > 0 ? b.gasto_real / b.leads_obtenidos : Infinity;
      } else if (sortCol === "cpc") {
        va = a.conversiones > 0 ? a.gasto_real / a.conversiones : Infinity;
        vb = b.conversiones > 0 ? b.gasto_real / b.conversiones : Infinity;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [campanasFiltradas, sortCol, sortAsc]);

  function handleSort(col: string) {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(true); }
  }

  // Best / worst by cpc
  const cpcMap = useMemo(() => {
    const map = new Map<string, number>();
    campanasSorted.forEach((c) => {
      if (c.conversiones > 0) map.set(c.id, c.gasto_real / c.conversiones);
    });
    return map;
  }, [campanasSorted]);

  const bestId = useMemo(() => {
    let best: string | null = null;
    let bestVal = Infinity;
    cpcMap.forEach((v, k) => { if (v < bestVal) { bestVal = v; best = k; } });
    return best;
  }, [cpcMap]);

  const worstId = useMemo(() => {
    let worst: string | null = null;
    let worstVal = -Infinity;
    cpcMap.forEach((v, k) => { if (v > worstVal) { worstVal = v; worst = k; } });
    return worst;
  }, [cpcMap]);

  // ── Bar chart SVG: by tipo ────────────────────────────────────────────────

  const tipoStats = useMemo(() => {
    const map = new Map<TipoCampana, { leads: number; conversiones: number; count: number }>();
    campanas.forEach((c) => {
      const existing = map.get(c.tipo) ?? { leads: 0, conversiones: 0, count: 0 };
      map.set(c.tipo, {
        leads: existing.leads + c.leads_obtenidos,
        conversiones: existing.conversiones + c.conversiones,
        count: existing.count + 1,
      });
    });
    return Array.from(map.entries()).map(([tipo, d]) => ({
      tipo,
      leadsPromedio: d.count > 0 ? d.leads / d.count : 0,
      conversionesPromedio: d.count > 0 ? d.conversiones / d.count : 0,
    }));
  }, [campanas]);

  // ── Donut SVG: presupuesto por tipo ───────────────────────────────────────

  const presupuestoTipo = useMemo(() => {
    const map = new Map<TipoCampana, number>();
    campanas.forEach((c) => {
      map.set(c.tipo, (map.get(c.tipo) ?? 0) + c.presupuesto);
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries()).map(([tipo, valor]) => ({
      tipo,
      valor,
      pct: total > 0 ? valor / total : 0,
    }));
  }, [campanas]);

  // ── Insights ──────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    // Mejor mes
    const mesMap = new Map<string, { conversiones: number; count: number }>();
    campanas.forEach((c) => {
      if (!c.fecha_inicio) return;
      const mes = c.fecha_inicio.slice(0, 7);
      const ex = mesMap.get(mes) ?? { conversiones: 0, count: 0 };
      mesMap.set(mes, { conversiones: ex.conversiones + c.conversiones, count: ex.count + 1 });
    });
    let mejorMes = "";
    let mejorConv = -1;
    mesMap.forEach((v, k) => {
      if (v.conversiones > mejorConv) { mejorConv = v.conversiones; mejorMes = k; }
    });

    // Canal más efectivo
    const tipoConvRate = new Map<TipoCampana, { conv: number; leads: number }>();
    campanas.forEach((c) => {
      const ex = tipoConvRate.get(c.tipo) ?? { conv: 0, leads: 0 };
      tipoConvRate.set(c.tipo, { conv: ex.conv + c.conversiones, leads: ex.leads + c.leads_obtenidos });
    });
    let mejorTipo: TipoCampana | null = null;
    let mejorTasa = -1;
    tipoConvRate.forEach((v, k) => {
      const tasa = v.leads > 0 ? v.conv / v.leads : 0;
      if (tasa > mejorTasa) { mejorTasa = tasa; mejorTipo = k; }
    });

    // Gasto mensual promedio
    const gastoTotal = campanas.reduce((s, c) => s + c.gasto_real, 0);
    const mesesActivos = mesMap.size || 1;
    const gastoMensual = gastoTotal / mesesActivos;

    return {
      mejorMes: mejorMes ? (() => {
        const [y, m] = mejorMes.split("-");
        const date = new Date(Number(y), Number(m) - 1, 1);
        return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
      })() : "Sin datos",
      mejorTipo: mejorTipo ? TIPO_LABEL[mejorTipo] : "Sin datos",
      mejorTasa,
      gastoMensual,
    };
  }, [campanas]);

  // ── Gantt ─────────────────────────────────────────────────────────────────

  const ganttData = useMemo(() => {
    const START = new Date("2026-01-01");
    const END = new Date("2026-12-31");
    const totalMs = END.getTime() - START.getTime();
    return campanas.map((c) => {
      const inicio = new Date(c.fecha_inicio);
      const fin = new Date(c.fecha_fin);
      const xStart = Math.max(0, (inicio.getTime() - START.getTime()) / totalMs);
      const xEnd = Math.min(1, (fin.getTime() - START.getTime()) / totalMs);
      const gastoX = c.presupuesto > 0 ? xStart + (xEnd - xStart) * (c.gasto_real / c.presupuesto) : xStart;
      return { c, xStart, xEnd, gastoX };
    });
  }, [campanas]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const styleCard: React.CSSProperties = {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 8,
    padding: 20,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e0e0e0",
        fontFamily: "Inter, sans-serif",
        padding: "24px 16px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 26,
              color: "#e0e0e0",
              letterSpacing: "-0.5px",
            }}
          >
            Campañas de Marketing
          </h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>
            Planificación y seguimiento de tus campañas inmobiliarias
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            background: "#990000",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 20px",
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          + Nueva campaña
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: "1px solid #222222",
        }}
      >
        {(
          [
            { key: "activas", label: "Campañas activas" },
            { key: "analisis", label: "Análisis de rendimiento" },
            { key: "calendario", label: "Calendario y planificación" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid #990000" : "2px solid transparent",
              color: tab === t.key ? "#e0e0e0" : "#888",
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: tab === t.key ? 600 : 400,
              padding: "8px 16px",
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Activas ─────────────────────────────────────────────────── */}

      {tab === "activas" && (
        <div>
          {/* KPI config */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 12, color: "#888" }}>Honorario promedio por conversión:</span>
            <input
              type="number"
              value={honorarioRef}
              onChange={(e) => setHonorarioRef(Number(e.target.value))}
              style={{
                background: "#111111",
                border: "1px solid #333",
                borderRadius: 4,
                color: "#e0e0e0",
                padding: "4px 10px",
                fontSize: 13,
                width: 120,
                fontFamily: "Inter, sans-serif",
              }}
            />
            <span style={{ fontSize: 12, color: "#666" }}>ARS</span>
          </div>

          {/* KPI cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <div style={styleCard}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                Inversión activa
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Montserrat, sans-serif", color: "#990000" }}>
                {formatARS(inversionTotal)}
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>en campañas activas/planificadas</div>
            </div>
            <div style={styleCard}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                Leads obtenidos
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Montserrat, sans-serif", color: "#3b82f6" }}>
                {leadsTotal}
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>campañas activas/planificadas</div>
            </div>
            <div style={styleCard}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                Tasa de conversión
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Montserrat, sans-serif", color: "#3abab6" }}>
                {conversionTotal.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>conversiones / leads</div>
            </div>
            <div style={styleCard}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                ROI estimado
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: "Montserrat, sans-serif",
                  color: roiEstimado >= 0 ? "#3abab6" : "#990000",
                }}
              >
                {roiEstimado >= 0 ? "+" : ""}
                {roiEstimado.toFixed(0)}%
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>retorno vs. inversión</div>
            </div>
          </div>

          {/* Campañas list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {activas.length === 0 && (
              <div style={{ ...styleCard, textAlign: "center", color: "#555", padding: 40 }}>
                No hay campañas activas o planificadas
              </div>
            )}
            {activas.map((c) => {
              const dias = diasRestantes(c.fecha_fin);
              return (
                <div key={c.id} style={{ ...styleCard, position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      background: ESTADO_COLOR[c.estado],
                      borderRadius: "8px 0 0 8px",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 16,
                          marginBottom: 6,
                        }}
                      >
                        {c.nombre}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Badge label={TIPO_LABEL[c.tipo]} color={TIPO_COLOR[c.tipo]} />
                        <Badge label={OBJETIVO_LABEL[c.objetivo]} color={OBJETIVO_COLOR[c.objetivo]} />
                        <Badge label={ESTADO_LABEL[c.estado]} color={ESTADO_COLOR[c.estado]} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <button
                        onClick={() => openEdit(c)}
                        style={{
                          background: "#1a1a1a",
                          border: "1px solid #333",
                          borderRadius: 5,
                          color: "#aaa",
                          padding: "5px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Editar
                      </button>
                      {c.estado === "activa" && (
                        <button
                          onClick={() => cambiarEstado(c.id, "pausada")}
                          style={{
                            background: "#1a1a1a",
                            border: "1px solid #d4960c44",
                            borderRadius: 5,
                            color: "#d4960c",
                            padding: "5px 12px",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Pausar
                        </button>
                      )}
                      {c.estado === "pausada" && (
                        <button
                          onClick={() => cambiarEstado(c.id, "activa")}
                          style={{
                            background: "#1a1a1a",
                            border: "1px solid #99000044",
                            borderRadius: 5,
                            color: "#990000",
                            padding: "5px 12px",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Reactivar
                        </button>
                      )}
                      {(c.estado === "activa" || c.estado === "pausada") && (
                        <button
                          onClick={() => cambiarEstado(c.id, "finalizada")}
                          style={{
                            background: "#1a1a1a",
                            border: "1px solid #3abab644",
                            borderRadius: 5,
                            color: "#3abab6",
                            padding: "5px 12px",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Finalizar
                        </button>
                      )}
                      {c.estado === "planificada" && (
                        <button
                          onClick={() => cambiarEstado(c.id, "activa")}
                          style={{
                            background: "#1a1a1a",
                            border: "1px solid #99000044",
                            borderRadius: 5,
                            color: "#990000",
                            padding: "5px 12px",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Leads progress */}
                  <div style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                        fontSize: 12,
                        color: "#888",
                      }}
                    >
                      <span>Leads obtenidos</span>
                      <span style={{ color: "#e0e0e0", fontWeight: 600 }}>
                        {c.leads_obtenidos} / {c.leads_objetivo}
                      </span>
                    </div>
                    <ProgressBar value={c.leads_obtenidos} max={c.leads_objetivo} color="#3b82f6" />
                  </div>

                  {/* Gasto progress */}
                  <div style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                        fontSize: 12,
                        color: "#888",
                      }}
                    >
                      <span>Presupuesto gastado</span>
                      <span style={{ color: "#e0e0e0", fontWeight: 600 }}>
                        {formatARS(c.gasto_real)} / {formatARS(c.presupuesto)}
                      </span>
                    </div>
                    <ProgressBar
                      value={c.gasto_real}
                      max={c.presupuesto}
                      color={c.gasto_real > c.presupuesto ? "#990000" : "#d4960c"}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "#666",
                      marginTop: 8,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <span>
                      {formatFecha(c.fecha_inicio)} → {formatFecha(c.fecha_fin)}
                    </span>
                    <span style={{ color: dias < 0 ? "#990000" : dias <= 7 ? "#d4960c" : "#888" }}>
                      {dias < 0 ? `Venció hace ${Math.abs(dias)} días` : `${dias} días restantes`}
                    </span>
                    <span style={{ color: "#3abab6" }}>
                      {c.conversiones} conversiones
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: Análisis ────────────────────────────────────────────────── */}

      {tab === "analisis" && (
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoCampana | "todas")}
              style={{
                background: "#111111",
                border: "1px solid #333",
                borderRadius: 5,
                color: "#e0e0e0",
                padding: "6px 12px",
                fontSize: 13,
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              <option value="todas">Todos los estados</option>
              <option value="activa">Activa</option>
              <option value="planificada">Planificada</option>
              <option value="pausada">Pausada</option>
              <option value="finalizada">Finalizada</option>
            </select>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as TipoCampana | "todos")}
              style={{
                background: "#111111",
                border: "1px solid #333",
                borderRadius: 5,
                color: "#e0e0e0",
                padding: "6px 12px",
                fontSize: 13,
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              <option value="todos">Todos los tipos</option>
              {Object.entries(TIPO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", marginBottom: 28 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                fontFamily: "Inter, sans-serif",
              }}
            >
              <thead>
                <tr>
                  {[
                    { col: "nombre", label: "Nombre" },
                    { col: "tipo", label: "Tipo" },
                    { col: "leads", label: "Leads" },
                    { col: "conversiones", label: "Conversiones" },
                    { col: "tasa", label: "Tasa" },
                    { col: "cpl", label: "CPL" },
                    { col: "cpc", label: "Costo/Conv." },
                  ].map(({ col, label }) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      style={{
                        background: "#111111",
                        border: "1px solid #222",
                        padding: "10px 12px",
                        textAlign: "left",
                        color: sortCol === col ? "#990000" : "#888",
                        cursor: "pointer",
                        userSelect: "none",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label} {sortCol === col ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campanasSorted.map((c) => {
                  const tasa = c.leads_obtenidos > 0 ? (c.conversiones / c.leads_obtenidos) * 100 : 0;
                  const cpl = c.leads_obtenidos > 0 ? c.gasto_real / c.leads_obtenidos : null;
                  const cpc = c.conversiones > 0 ? c.gasto_real / c.conversiones : null;
                  const isBest = c.id === bestId;
                  const isWorst = c.id === worstId;
                  const rowBg = isBest
                    ? "#0a1f0a"
                    : isWorst
                    ? "#1f0a0a"
                    : "transparent";
                  return (
                    <tr
                      key={c.id}
                      style={{ background: rowBg }}
                    >
                      <td
                        style={{
                          border: "1px solid #1a1a1a",
                          padding: "9px 12px",
                          color: "#e0e0e0",
                          fontWeight: isBest || isWorst ? 600 : 400,
                        }}
                      >
                        {c.nombre}
                        {isBest && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: "#3abab6" }}>
                            ★ mejor
                          </span>
                        )}
                        {isWorst && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: "#990000" }}>
                            ▼ peor
                          </span>
                        )}
                      </td>
                      <td style={{ border: "1px solid #1a1a1a", padding: "9px 12px" }}>
                        <Badge label={TIPO_LABEL[c.tipo]} color={TIPO_COLOR[c.tipo]} />
                      </td>
                      <td style={{ border: "1px solid #1a1a1a", padding: "9px 12px", color: "#3b82f6" }}>
                        {c.leads_obtenidos}
                      </td>
                      <td style={{ border: "1px solid #1a1a1a", padding: "9px 12px", color: "#3abab6" }}>
                        {c.conversiones}
                      </td>
                      <td style={{ border: "1px solid #1a1a1a", padding: "9px 12px", color: "#e0e0e0" }}>
                        {tasa.toFixed(1)}%
                      </td>
                      <td style={{ border: "1px solid #1a1a1a", padding: "9px 12px", color: "#e0e0e0" }}>
                        {cpl !== null ? formatARS(cpl) : "—"}
                      </td>
                      <td
                        style={{
                          border: "1px solid #1a1a1a",
                          padding: "9px 12px",
                          color: isBest ? "#3abab6" : isWorst ? "#990000" : "#e0e0e0",
                          fontWeight: isBest || isWorst ? 700 : 400,
                        }}
                      >
                        {cpc !== null ? formatARS(cpc) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {campanasSorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        border: "1px solid #1a1a1a",
                        padding: "20px 12px",
                        textAlign: "center",
                        color: "#555",
                      }}
                    >
                      Sin campañas para los filtros seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bar chart */}
          <div style={{ ...styleCard, marginBottom: 20 }}>
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 16,
                color: "#e0e0e0",
              }}
            >
              Rendimiento por tipo de campaña
            </div>
            {tipoStats.length > 0 ? (
              <BarChart data={tipoStats} />
            ) : (
              <div style={{ color: "#555", textAlign: "center", padding: 20 }}>Sin datos</div>
            )}
          </div>

          {/* Donut */}
          <div style={{ ...styleCard }}>
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 16,
                color: "#e0e0e0",
              }}
            >
              Distribución del presupuesto por tipo
            </div>
            {presupuestoTipo.length > 0 ? (
              <DonutChart data={presupuestoTipo} />
            ) : (
              <div style={{ color: "#555", textAlign: "center", padding: 20 }}>Sin datos</div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: Calendario ──────────────────────────────────────────────── */}

      {tab === "calendario" && (
        <div>
          {/* Gantt */}
          <div style={{ ...styleCard, marginBottom: 20, overflowX: "auto" }}>
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 16,
                color: "#e0e0e0",
              }}
            >
              Línea de tiempo 2026
            </div>
            <GanttChart data={ganttData} />
          </div>

          {/* Leyenda */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {(Object.entries(ESTADO_LABEL) as [EstadoCampana, string][]).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: ESTADO_COLOR[k],
                  }}
                />
                <span style={{ color: "#888" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <div style={styleCard}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Mejor mes para campañas
              </div>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  color: "#3abab6",
                  textTransform: "capitalize",
                }}
              >
                {insights.mejorMes}
              </div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                según conversiones históricas
              </div>
            </div>
            <div style={styleCard}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Canal más efectivo
              </div>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  color: "#3b82f6",
                }}
              >
                {insights.mejorTipo}
              </div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                {insights.mejorTasa > 0
                  ? `${(insights.mejorTasa * 100).toFixed(1)}% tasa de conversión`
                  : ""}
              </div>
            </div>
            <div style={styleCard}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Gasto mensual promedio
              </div>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  color: "#d4960c",
                }}
              >
                {formatARS(insights.gastoMensual)}
              </div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>en marketing</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            style={{
              background: "#111111",
              border: "1px solid #222222",
              borderRadius: 10,
              padding: 28,
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2
              style={{
                margin: "0 0 20px",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: "#e0e0e0",
              }}
            >
              {editando ? "Editar campaña" : "Nueva campaña"}
            </h2>

            <ModalForm
              form={form}
              setForm={setForm}
              onSubmit={handleSubmit}
              onCancel={() => setShowModal(false)}
              toggleCanal={toggleCanal}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BarChart SVG ────────────────────────────────────────────────────────────

function BarChart({
  data,
}: {
  data: { tipo: TipoCampana; leadsPromedio: number; conversionesPromedio: number }[];
}) {
  const W = 700;
  const H = 280;
  const PADDING = { top: 20, right: 20, bottom: 60, left: 40 };
  const chartW = W - PADDING.left - PADDING.right;
  const chartH = H - PADDING.top - PADDING.bottom;

  const maxVal = Math.max(...data.flatMap((d) => [d.leadsPromedio, d.conversionesPromedio]), 1);

  const barGroupW = chartW / data.length;
  const barW = Math.min(20, barGroupW * 0.35);
  const gap = 4;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, display: "block" }}
    >
      <g transform={`translate(${PADDING.left},${PADDING.top})`}>
        {/* Y axis */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = chartH * (1 - f);
          return (
            <g key={f}>
              <line x1={0} y1={y} x2={chartW} y2={y} stroke="#1a1a1a" strokeWidth={1} />
              <text x={-4} y={y + 4} fill="#555" fontSize={10} textAnchor="end">
                {Math.round(f * maxVal)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const cx = barGroupW * i + barGroupW / 2;
          const hLeads = (d.leadsPromedio / maxVal) * chartH;
          const hConv = (d.conversionesPromedio / maxVal) * chartH;

          return (
            <g key={d.tipo}>
              {/* Leads bar */}
              <rect
                x={cx - barW - gap / 2}
                y={chartH - hLeads}
                width={barW}
                height={hLeads}
                fill="#3b82f6"
                rx={2}
              />
              {/* Conversiones bar */}
              <rect
                x={cx + gap / 2}
                y={chartH - hConv}
                width={barW}
                height={hConv}
                fill="#3abab6"
                rx={2}
              />
              {/* Label */}
              <text
                x={cx}
                y={chartH + 14}
                fill="#888"
                fontSize={10}
                textAnchor="middle"
              >
                {TIPO_LABEL[d.tipo].split(" ")[0]}
              </text>
            </g>
          );
        })}
      </g>

      {/* Legend */}
      <g transform={`translate(${PADDING.left + 10},${H - 14})`}>
        <rect x={0} y={-8} width={10} height={8} fill="#3b82f6" rx={1} />
        <text x={14} y={0} fill="#888" fontSize={11}>Leads promedio</text>
        <rect x={130} y={-8} width={10} height={8} fill="#3abab6" rx={1} />
        <text x={144} y={0} fill="#888" fontSize={11}>Conversiones promedio</text>
      </g>
    </svg>
  );
}

// ─── DonutChart SVG ──────────────────────────────────────────────────────────

function DonutChart({
  data,
}: {
  data: { tipo: TipoCampana; valor: number; pct: number }[];
}) {
  const CX = 160;
  const CY = 140;
  const R = 100;
  const r = 60;

  let cumAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = d.pct * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    return { ...d, startAngle, endAngle: cumAngle, midAngle: startAngle + angle / 2 };
  });

  function polarToCart(angle: number, radius: number) {
    return {
      x: CX + radius * Math.cos(angle),
      y: CY + radius * Math.sin(angle),
    };
  }

  function arcPath(startAngle: number, endAngle: number) {
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const s = polarToCart(startAngle, R);
    const e = polarToCart(endAngle, R);
    const si = polarToCart(startAngle, r);
    const ei = polarToCart(endAngle, r);
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${r} ${r} 0 ${large} 0 ${si.x} ${si.y} Z`;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg viewBox="0 0 320 280" style={{ width: 320, minWidth: 260, display: "block" }}>
        {slices.map((s) => (
          <path
            key={s.tipo}
            d={arcPath(s.startAngle, s.endAngle)}
            fill={TIPO_COLOR[s.tipo]}
            opacity={0.85}
          />
        ))}
        <text x={CX} y={CY - 6} textAnchor="middle" fill="#888" fontSize={11}>
          Presupuesto
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="#888" fontSize={11}>
          total
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 160 }}>
        {slices.map((s) => (
          <div key={s.tipo} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: TIPO_COLOR[s.tipo],
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#888", flex: 1 }}>{TIPO_LABEL[s.tipo]}</span>
            <span style={{ color: "#e0e0e0", fontWeight: 600 }}>
              {(s.pct * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GanttChart SVG ──────────────────────────────────────────────────────────

function GanttChart({
  data,
}: {
  data: {
    c: Campana;
    xStart: number;
    xEnd: number;
    gastoX: number;
  }[];
}) {
  const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const LEFT_W = 170;
  const RIGHT_W = 560;
  const ROW_H = 36;
  const HEADER_H = 28;
  const BAR_H = 16;
  const W = LEFT_W + RIGHT_W;
  const H = HEADER_H + data.length * ROW_H + 10;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", display: "block", minWidth: 500 }}
    >
      {/* Month grid */}
      {MONTHS.map((m, i) => {
        const x = LEFT_W + (i / 12) * RIGHT_W;
        return (
          <g key={m}>
            <line x1={x} y1={0} x2={x} y2={H} stroke="#1a1a1a" strokeWidth={1} />
            <text x={x + RIGHT_W / 24} y={18} fill="#555" fontSize={10} textAnchor="middle">
              {m}
            </text>
          </g>
        );
      })}

      {/* Rows */}
      {data.map((d, i) => {
        const y = HEADER_H + i * ROW_H;
        const barX = LEFT_W + d.xStart * RIGHT_W;
        const barW = Math.max(2, (d.xEnd - d.xStart) * RIGHT_W);
        const gastoLineX = LEFT_W + d.gastoX * RIGHT_W;

        return (
          <g key={d.c.id}>
            {/* Row bg */}
            <rect x={0} y={y} width={W} height={ROW_H} fill={i % 2 === 0 ? "#0d0d0d" : "transparent"} />
            {/* Name */}
            <text x={6} y={y + ROW_H / 2 + 4} fill="#cccccc" fontSize={11} textAnchor="start">
              {d.c.nombre.length > 22 ? d.c.nombre.slice(0, 22) + "…" : d.c.nombre}
            </text>
            {/* Bar */}
            <rect
              x={barX}
              y={y + (ROW_H - BAR_H) / 2}
              width={barW}
              height={BAR_H}
              fill={ESTADO_COLOR[d.c.estado]}
              rx={3}
              opacity={0.8}
            />
            {/* Gasto line */}
            {d.gastoX > d.xStart && d.gastoX <= d.xEnd && (
              <line
                x1={gastoLineX}
                y1={y + (ROW_H - BAR_H) / 2}
                x2={gastoLineX}
                y2={y + (ROW_H + BAR_H) / 2}
                stroke="#ffffff"
                strokeWidth={2}
                opacity={0.6}
              />
            )}
          </g>
        );
      })}

      {/* Bottom border */}
      <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="#1a1a1a" strokeWidth={1} />
    </svg>
  );
}

// ─── ModalForm ───────────────────────────────────────────────────────────────

function ModalForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  toggleCanal,
}: {
  form: Omit<Campana, "id" | "created_at">;
  setForm: React.Dispatch<React.SetStateAction<Omit<Campana, "id" | "created_at">>>;
  onSubmit: () => void;
  onCancel: () => void;
  toggleCanal: (canal: string) => void;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: 5,
    color: "#e0e0e0",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    color: "#888",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: 14,
  };

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 14,
  };

  return (
    <div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Nombre</label>
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          placeholder="Nombre de la campaña"
          style={inputStyle}
        />
      </div>

      <div style={rowStyle}>
        <div>
          <label style={labelStyle}>Tipo</label>
          <select
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoCampana }))}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {Object.entries(TIPO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Objetivo</label>
          <select
            value={form.objetivo}
            onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value as ObjetivoCampana }))}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {Object.entries(OBJETIVO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={rowStyle}>
        <div>
          <label style={labelStyle}>Estado</label>
          <select
            value={form.estado}
            onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as EstadoCampana }))}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {Object.entries(ESTADO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={rowStyle}>
        <div>
          <label style={labelStyle}>Fecha inicio</label>
          <input
            type="date"
            value={form.fecha_inicio}
            onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Fecha fin</label>
          <input
            type="date"
            value={form.fecha_fin}
            onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={rowStyle}>
        <div>
          <label style={labelStyle}>Presupuesto (ARS)</label>
          <input
            type="number"
            value={form.presupuesto}
            onChange={(e) => setForm((f) => ({ ...f, presupuesto: Number(e.target.value) }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Gasto real (ARS)</label>
          <input
            type="number"
            value={form.gasto_real}
            onChange={(e) => setForm((f) => ({ ...f, gasto_real: Number(e.target.value) }))}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={rowStyle}>
        <div>
          <label style={labelStyle}>Leads objetivo</label>
          <input
            type="number"
            value={form.leads_objetivo}
            onChange={(e) => setForm((f) => ({ ...f, leads_objetivo: Number(e.target.value) }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Leads obtenidos</label>
          <input
            type="number"
            value={form.leads_obtenidos}
            onChange={(e) => setForm((f) => ({ ...f, leads_obtenidos: Number(e.target.value) }))}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Conversiones</label>
        <input
          type="number"
          value={form.conversiones}
          onChange={(e) => setForm((f) => ({ ...f, conversiones: Number(e.target.value) }))}
          style={inputStyle}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Descripción</label>
        <textarea
          value={form.descripcion}
          onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Descripción de la campaña..."
        />
      </div>

      {/* Canales */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Canales</label>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {CANALES_DISPONIBLES.map((canal) => {
            const active = form.canales.includes(canal);
            return (
              <button
                key={canal}
                type="button"
                onClick={() => toggleCanal(canal)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: `1px solid ${active ? "#990000" : "#333"}`,
                  background: active ? "#99000022" : "#0a0a0a",
                  color: active ? "#990000" : "#666",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {canal}
              </button>
            );
          })}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "none",
            border: "1px solid #333",
            borderRadius: 5,
            color: "#888",
            padding: "9px 20px",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          style={{
            background: "#990000",
            border: "none",
            borderRadius: 5,
            color: "#fff",
            padding: "9px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
