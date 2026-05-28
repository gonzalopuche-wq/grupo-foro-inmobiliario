"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Inmobiliaria {
  id: string;
  nombre: string;
  zona: string;
  sitio_web: string;
  telefono: string;
  instagram: string;
  notas: string;
  created_at: string;
}

interface PropiedadCompetencia {
  id: string;
  inmobiliaria_id: string;
  descripcion: string;
  tipo_operacion: "venta" | "alquiler";
  tipo_propiedad: string;
  barrio: string;
  m2: number | null;
  precio: number;
  moneda: string;
  precio_m2: number | null;
  estado: "activa" | "vendida" | "retirada";
  fecha_publicacion: string;
  fecha_venta: string | null;
  dias_en_mercado: number | null;
  url: string;
  notas: string;
  created_at: string;
  updated_at: string;
}

type TabId = "mapa" | "propiedades" | "analisis";

type SortCol = "precio" | "precio_m2" | "dias_en_mercado";
type SortDir = "asc" | "desc";

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPOS_PROPIEDAD = ["Departamento", "Casa", "PH", "Local", "Oficina", "Terreno", "Cochera", "Otro"];

// ── Datos de ejemplo ──────────────────────────────────────────────────────────

function generarDatosEjemplo(): { inmobiliarias: Inmobiliaria[]; propiedades: PropiedadCompetencia[] } {
  const hoy = new Date();
  const hace = (dias: number) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - dias);
    return d.toISOString().split("T")[0];
  };

  const inmobiliarias: Inmobiliaria[] = [
    {
      id: "inm-1",
      nombre: "Inmobiliaria del Centro",
      zona: "Palermo / Recoleta",
      sitio_web: "https://inmobiliariadel.com.ar",
      telefono: "011-4444-1111",
      instagram: "@inmobiliariadel",
      notas: "Muy activa en portales. Muchos carteles en la zona.",
      created_at: hace(60),
    },
    {
      id: "inm-2",
      nombre: "Propiedades Norteña",
      zona: "Belgrano / Núñez",
      sitio_web: "https://nortena.com.ar",
      telefono: "011-4444-2222",
      instagram: "@nortena_prop",
      notas: "Especialistas en alquiler temporario. Precios agresivos.",
      created_at: hace(45),
    },
  ];

  const propiedades: PropiedadCompetencia[] = [
    {
      id: "prop-1",
      inmobiliaria_id: "inm-1",
      descripcion: "Depto 3 amb con cochera, piso 8, luminoso",
      tipo_operacion: "venta",
      tipo_propiedad: "Departamento",
      barrio: "Palermo",
      m2: 85,
      precio: 185000,
      moneda: "USD",
      precio_m2: 2176,
      estado: "activa",
      fecha_publicacion: hace(45),
      fecha_venta: null,
      dias_en_mercado: 45,
      url: "https://zonaprop.com.ar/ejemplo1",
      notas: "Bajó de precio dos veces",
      created_at: hace(45),
      updated_at: hace(10),
    },
    {
      id: "prop-2",
      inmobiliaria_id: "inm-1",
      descripcion: "PH 4 amb con jardín y terraza",
      tipo_operacion: "venta",
      tipo_propiedad: "PH",
      barrio: "Palermo",
      m2: 120,
      precio: 290000,
      moneda: "USD",
      precio_m2: 2417,
      estado: "vendida",
      fecha_publicacion: hace(90),
      fecha_venta: hace(15),
      dias_en_mercado: 75,
      url: "https://zonaprop.com.ar/ejemplo2",
      notas: "Se vendió por debajo del precio de lista",
      created_at: hace(90),
      updated_at: hace(15),
    },
    {
      id: "prop-3",
      inmobiliaria_id: "inm-1",
      descripcion: "Local comercial planta baja, 80m²",
      tipo_operacion: "alquiler",
      tipo_propiedad: "Local",
      barrio: "Recoleta",
      m2: 80,
      precio: 450000,
      moneda: "ARS",
      precio_m2: 5625,
      estado: "activa",
      fecha_publicacion: hace(20),
      fecha_venta: null,
      dias_en_mercado: 20,
      url: "",
      notas: "",
      created_at: hace(20),
      updated_at: hace(20),
    },
    {
      id: "prop-4",
      inmobiliaria_id: "inm-1",
      descripcion: "Depto 2 amb sin expensas altas",
      tipo_operacion: "venta",
      tipo_propiedad: "Departamento",
      barrio: "Palermo",
      m2: 55,
      precio: 105000,
      moneda: "USD",
      precio_m2: 1909,
      estado: "retirada",
      fecha_publicacion: hace(110),
      fecha_venta: null,
      dias_en_mercado: 110,
      url: "",
      notas: "Retirada del mercado sin venderse",
      created_at: hace(110),
      updated_at: hace(5),
    },
    {
      id: "prop-5",
      inmobiliaria_id: "inm-2",
      descripcion: "Casa 5 amb con pileta y jardín",
      tipo_operacion: "venta",
      tipo_propiedad: "Casa",
      barrio: "Belgrano",
      m2: 220,
      precio: 480000,
      moneda: "USD",
      precio_m2: 2182,
      estado: "activa",
      fecha_publicacion: hace(30),
      fecha_venta: null,
      dias_en_mercado: 30,
      url: "https://argenprop.com/ejemplo5",
      notas: "Precio negociable",
      created_at: hace(30),
      updated_at: hace(30),
    },
    {
      id: "prop-6",
      inmobiliaria_id: "inm-2",
      descripcion: "Depto 1 amb premium, piso 15",
      tipo_operacion: "alquiler",
      tipo_propiedad: "Departamento",
      barrio: "Núñez",
      m2: 42,
      precio: 320000,
      moneda: "ARS",
      precio_m2: 7619,
      estado: "activa",
      fecha_publicacion: hace(12),
      fecha_venta: null,
      dias_en_mercado: 12,
      url: "https://argenprop.com/ejemplo6",
      notas: "",
      created_at: hace(12),
      updated_at: hace(12),
    },
    {
      id: "prop-7",
      inmobiliaria_id: "inm-2",
      descripcion: "Terreno esquina, 300m², apto edificación",
      tipo_operacion: "venta",
      tipo_propiedad: "Terreno",
      barrio: "Belgrano",
      m2: 300,
      precio: 350000,
      moneda: "USD",
      precio_m2: 1167,
      estado: "vendida",
      fecha_publicacion: hace(25),
      fecha_venta: hace(5),
      dias_en_mercado: 20,
      url: "",
      notas: "Venta rápida, buena ubicación",
      created_at: hace(25),
      updated_at: hace(5),
    },
    {
      id: "prop-8",
      inmobiliaria_id: "inm-2",
      descripcion: "Oficina 60m², piso 3, cochera opcional",
      tipo_operacion: "alquiler",
      tipo_propiedad: "Oficina",
      barrio: "Belgrano",
      m2: 60,
      precio: 280000,
      moneda: "ARS",
      precio_m2: 4667,
      estado: "activa",
      fecha_publicacion: hace(95),
      fecha_venta: null,
      dias_en_mercado: 95,
      url: "https://argenprop.com/ejemplo8",
      notas: "Más de 90 días en mercado, posible sobreprecio",
      created_at: hace(95),
      updated_at: hace(95),
    },
  ];

  return { inmobiliarias, propiedades };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function calcPrecioM2(precio: number, m2: number | null): number | null {
  if (!m2 || m2 <= 0) return null;
  return precio / m2;
}

function estadoBadge(estado: PropiedadCompetencia["estado"]): { label: string; bg: string; color: string } {
  switch (estado) {
    case "activa":
      return { label: "Activa", bg: "rgba(34,197,94,0.15)", color: "#22c55e" };
    case "vendida":
      return { label: "Vendida", bg: "rgba(204,0,0,0.15)", color: "#cc0000" };
    case "retirada":
      return { label: "Retirada", bg: "rgba(249,115,22,0.15)", color: "#f97316" };
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

function fechaHoy(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid #222222",
  borderRadius: 6,
  color: "#e0e0e0",
  padding: "7px 10px",
  fontFamily: "'Inter',sans-serif",
  fontSize: 12,
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 9,
  color: "rgba(255,255,255,0.4)",
  fontFamily: "'Montserrat',sans-serif",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 4,
};

const cardStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #222222",
  borderRadius: 12,
  padding: 20,
};

const btnPrimary: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 8,
  background: "#cc0000",
  border: "none",
  color: "#fff",
  fontSize: 12,
  fontFamily: "'Montserrat',sans-serif",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 8,
  background: "transparent",
  border: "1px solid #222222",
  color: "rgba(255,255,255,0.4)",
  fontSize: 12,
  fontFamily: "'Inter',sans-serif",
  cursor: "pointer",
};

// ── Modal base ────────────────────────────────────────────────────────────────

function Modal({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title: string }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111111", border: "1px solid #222222", borderRadius: 16,
          padding: 24, maxWidth: 680, width: "100%", maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#e0e0e0", letterSpacing: "-0.01em" }}>{title}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Formulario inmobiliaria ───────────────────────────────────────────────────

interface FormInmobiliaria {
  nombre: string;
  zona: string;
  sitio_web: string;
  telefono: string;
  instagram: string;
  notas: string;
}

const emptyFormInmobiliaria: FormInmobiliaria = {
  nombre: "",
  zona: "",
  sitio_web: "",
  telefono: "",
  instagram: "",
  notas: "",
};

// ── Formulario propiedad ──────────────────────────────────────────────────────

interface FormPropiedad {
  inmobiliaria_id: string;
  descripcion: string;
  tipo_operacion: "venta" | "alquiler";
  tipo_propiedad: string;
  barrio: string;
  m2: string;
  precio: string;
  moneda: string;
  estado: "activa" | "vendida" | "retirada";
  fecha_publicacion: string;
  fecha_venta: string;
  dias_en_mercado: string;
  url: string;
  notas: string;
}

function emptyFormPropiedad(inmobiliariaId = ""): FormPropiedad {
  return {
    inmobiliaria_id: inmobiliariaId,
    descripcion: "",
    tipo_operacion: "venta",
    tipo_propiedad: "Departamento",
    barrio: "",
    m2: "",
    precio: "",
    moneda: "USD",
    estado: "activa",
    fecha_publicacion: fechaHoy(),
    fecha_venta: "",
    dias_en_mercado: "0",
    url: "",
    notas: "",
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AnalisisCompetencia() {
  // ── Estado persistido ──
  const [uid, setUid] = useState<string | null>(null);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [propiedades, setPropiedades] = useState<PropiedadCompetencia[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // ── Navegación ──
  const [tab, setTab] = useState<TabId>("mapa");

  // ── Tab 1 ──
  const [selectedInmId, setSelectedInmId] = useState<string | null>(null);
  const [showModalInm, setShowModalInm] = useState(false);
  const [formInm, setFormInm] = useState<FormInmobiliaria>(emptyFormInmobiliaria);

  // ── Tab 2 ──
  const [filtroInm, setFiltroInm] = useState("todos");
  const [filtroOp, setFiltroOp] = useState<"todos" | "venta" | "alquiler">("todos");
  const [filtroBarrio, setFiltroBarrio] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activa" | "vendida" | "retirada">("todos");
  const [sortCol, setSortCol] = useState<SortCol>("precio");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [showModalProp, setShowModalProp] = useState(false);
  const [formProp, setFormProp] = useState<FormPropiedad>(emptyFormPropiedad());

  const [detallePropId, setDetallePropId] = useState<string | null>(null);
  const [showActualizarEstado, setShowActualizarEstado] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<"activa" | "vendida" | "retirada">("vendida");
  const [fechaVentaInput, setFechaVentaInput] = useState(fechaHoy());

  // ── Hidratación desde Supabase ──
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: row } = await supabase
        .from("crm_analisis_competencia")
        .select("competidores")
        .eq("perfil_id", userId)
        .maybeSingle();
      if (row?.competidores) {
        const stored = row.competidores as { inmobiliarias: Inmobiliaria[]; propiedades: PropiedadCompetencia[] };
        setInmobiliarias(stored.inmobiliarias ?? []);
        setPropiedades(stored.propiedades ?? []);
      } else {
        const { inmobiliarias: inm, propiedades: props } = generarDatosEjemplo();
        setInmobiliarias(inm);
        setPropiedades(props);
      }
      setHydrated(true);
    });
  }, []);

  // ── Persistencia ──
  const persist = useCallback(
    async (inm: Inmobiliaria[], props: PropiedadCompetencia[]) => {
      if (!uid) return;
      await supabase
        .from("crm_analisis_competencia")
        .upsert({ perfil_id: uid, competidores: { inmobiliarias: inm, propiedades: props }, updated_at: new Date().toISOString() });
    },
    [uid]
  );

  // ── CRUD Inmobiliaria ──
  function agregarInmobiliaria() {
    if (!formInm.nombre.trim()) return;
    const nueva: Inmobiliaria = {
      id: `inm-${Date.now()}`,
      nombre: formInm.nombre.trim(),
      zona: formInm.zona.trim(),
      sitio_web: formInm.sitio_web.trim(),
      telefono: formInm.telefono.trim(),
      instagram: formInm.instagram.trim(),
      notas: formInm.notas.trim(),
      created_at: nowISO(),
    };
    const next = [...inmobiliarias, nueva];
    setInmobiliarias(next);
    persist(next, propiedades);
    setFormInm(emptyFormInmobiliaria);
    setShowModalInm(false);
  }

  function eliminarInmobiliaria(id: string) {
    const nextInm = inmobiliarias.filter((i) => i.id !== id);
    const nextProps = propiedades.filter((p) => p.inmobiliaria_id !== id);
    setInmobiliarias(nextInm);
    setPropiedades(nextProps);
    persist(nextInm, nextProps);
    if (selectedInmId === id) setSelectedInmId(null);
  }

  // ── CRUD Propiedad ──
  function agregarPropiedad() {
    if (!formProp.descripcion.trim() || !formProp.precio || !formProp.inmobiliaria_id) return;
    const m2 = formProp.m2 ? parseFloat(formProp.m2) : null;
    const precio = parseFloat(formProp.precio);
    const nueva: PropiedadCompetencia = {
      id: `prop-${Date.now()}`,
      inmobiliaria_id: formProp.inmobiliaria_id,
      descripcion: formProp.descripcion.trim(),
      tipo_operacion: formProp.tipo_operacion,
      tipo_propiedad: formProp.tipo_propiedad,
      barrio: formProp.barrio.trim(),
      m2: m2,
      precio: precio,
      moneda: formProp.moneda,
      precio_m2: calcPrecioM2(precio, m2),
      estado: formProp.estado,
      fecha_publicacion: formProp.fecha_publicacion,
      fecha_venta: formProp.fecha_venta || null,
      dias_en_mercado: formProp.dias_en_mercado ? parseInt(formProp.dias_en_mercado) : null,
      url: formProp.url.trim(),
      notas: formProp.notas.trim(),
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    const next = [...propiedades, nueva];
    setPropiedades(next);
    persist(inmobiliarias, next);
    setFormProp(emptyFormPropiedad());
    setShowModalProp(false);
  }

  function actualizarEstadoPropiedad() {
    if (!detallePropId) return;
    const next = propiedades.map((p) => {
      if (p.id !== detallePropId) return p;
      return {
        ...p,
        estado: nuevoEstado,
        fecha_venta: nuevoEstado === "vendida" ? fechaVentaInput : p.fecha_venta,
        updated_at: nowISO(),
      };
    });
    setPropiedades(next);
    persist(inmobiliarias, next);
    setShowActualizarEstado(false);
    setDetallePropId(null);
  }

  // ── Datos derivados ──
  const selectedInm = useMemo(
    () => inmobiliarias.find((i) => i.id === selectedInmId) ?? null,
    [inmobiliarias, selectedInmId]
  );

  const detalleProp = useMemo(
    () => propiedades.find((p) => p.id === detallePropId) ?? null,
    [propiedades, detallePropId]
  );

  const barrios = useMemo(
    () => Array.from(new Set(propiedades.map((p) => p.barrio).filter(Boolean))).sort(),
    [propiedades]
  );

  // Stats por inmobiliaria para Tab 1
  const statsInm = useMemo(() => {
    return inmobiliarias.map((inm) => {
      const props = propiedades.filter((p) => p.inmobiliaria_id === inm.id);
      const activas = props.filter((p) => p.estado === "activa");
      const conM2 = activas.filter((p) => p.precio_m2 !== null);
      const avgPrecioM2 =
        conM2.length > 0
          ? conM2.reduce((s, p) => s + (p.precio_m2 ?? 0), 0) / conM2.length
          : null;
      const conDias = activas.filter((p) => p.dias_en_mercado !== null);
      const avgDias =
        conDias.length > 0
          ? conDias.reduce((s, p) => s + (p.dias_en_mercado ?? 0), 0) / conDias.length
          : null;
      const vendidas = props.filter((p) => p.estado === "vendida").length;
      const rotacion = props.length > 0 ? (vendidas / props.length) * 100 : 0;
      return { inm, activas: activas.length, total: props.length, avgPrecioM2, avgDias, rotacion, vendidas };
    });
  }, [inmobiliarias, propiedades]);

  // Stats para panel de detalle de inmobiliaria
  const statsDetalle = useMemo(() => {
    if (!selectedInmId) return null;
    const props = propiedades.filter((p) => p.inmobiliaria_id === selectedInmId);
    const activas = props.filter((p) => p.estado === "activa");
    const conM2 = activas.filter((p) => p.precio_m2 !== null);
    const avgPrecioM2 =
      conM2.length > 0
        ? conM2.reduce((s, p) => s + (p.precio_m2 ?? 0), 0) / conM2.length
        : null;
    const conDias = activas.filter((p) => p.dias_en_mercado !== null);
    const avgDias =
      conDias.length > 0
        ? conDias.reduce((s, p) => s + (p.dias_en_mercado ?? 0), 0) / conDias.length
        : null;
    const vendidas = props.filter((p) => p.estado === "vendida").length;
    const rotacion = props.length > 0 ? (vendidas / props.length) * 100 : 0;
    return { activas, total: props.length, avgPrecioM2, avgDias, rotacion };
  }, [selectedInmId, propiedades]);

  // Propiedades filtradas y ordenadas para Tab 2
  const propsFiltradas = useMemo(() => {
    let arr = propiedades;
    if (filtroInm !== "todos") arr = arr.filter((p) => p.inmobiliaria_id === filtroInm);
    if (filtroOp !== "todos") arr = arr.filter((p) => p.tipo_operacion === filtroOp);
    if (filtroBarrio) arr = arr.filter((p) => p.barrio.toLowerCase().includes(filtroBarrio.toLowerCase()));
    if (filtroEstado !== "todos") arr = arr.filter((p) => p.estado === filtroEstado);

    arr = [...arr].sort((a, b) => {
      let va = 0;
      let vb = 0;
      if (sortCol === "precio") { va = a.precio; vb = b.precio; }
      else if (sortCol === "precio_m2") { va = a.precio_m2 ?? 0; vb = b.precio_m2 ?? 0; }
      else if (sortCol === "dias_en_mercado") { va = a.dias_en_mercado ?? 0; vb = b.dias_en_mercado ?? 0; }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [propiedades, filtroInm, filtroOp, filtroBarrio, filtroEstado, sortCol, sortDir]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  function sortArrow(col: SortCol) {
    if (sortCol !== col) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  // ── Datos para Tab 3 ──
  const barrioPreciosComp = useMemo(() => {
    const activas = propiedades.filter((p) => p.estado === "activa" && p.precio_m2 !== null && p.barrio);
    const map: Record<string, number[]> = {};
    activas.forEach((p) => {
      if (!map[p.barrio]) map[p.barrio] = [];
      map[p.barrio].push(p.precio_m2 as number);
    });
    return Object.entries(map).map(([barrio, vals]) => ({
      barrio,
      competencia: vals.reduce((s, v) => s + v, 0) / vals.length,
    }));
  }, [propiedades]);

  const inmpreciosM2 = useMemo(() => {
    return inmobiliarias.map((inm) => {
      const activas = propiedades.filter(
        (p) => p.inmobiliaria_id === inm.id && p.estado === "activa" && p.precio_m2 !== null
      );
      const avg =
        activas.length > 0
          ? activas.reduce((s, p) => s + (p.precio_m2 ?? 0), 0) / activas.length
          : null;
      return { nombre: inm.nombre, avg };
    }).filter((x) => x.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  }, [inmobiliarias, propiedades]);

  const inmdias = useMemo(() => {
    return inmobiliarias.map((inm) => {
      const activas = propiedades.filter(
        (p) => p.inmobiliaria_id === inm.id && p.estado === "activa" && p.dias_en_mercado !== null
      );
      const avg =
        activas.length > 0
          ? activas.reduce((s, p) => s + (p.dias_en_mercado ?? 0), 0) / activas.length
          : null;
      return { nombre: inm.nombre, avg };
    }).filter((x) => x.avg !== null);
  }, [inmobiliarias, propiedades]);

  // Insights automáticos
  const insights = useMemo(() => {
    const list: string[] = [];
    const activas = propiedades.filter((p) => p.estado === "activa");

    // Más activa
    const cuentas: Record<string, number> = {};
    activas.forEach((p) => { cuentas[p.inmobiliaria_id] = (cuentas[p.inmobiliaria_id] ?? 0) + 1; });
    const topId = Object.entries(cuentas).sort((a, b) => b[1] - a[1])[0];
    if (topId) {
      const nombre = inmobiliarias.find((i) => i.id === topId[0])?.nombre ?? topId[0];
      list.push(`La competencia más activa en tu zona es ${nombre} (${topId[1]} propiedades activas)`);
    }

    // Mayor precio/m²
    const conM2 = activas.filter((p) => p.precio_m2 !== null);
    if (conM2.length > 0) {
      const top = conM2.reduce((max, p) => ((p.precio_m2 ?? 0) > (max.precio_m2 ?? 0) ? p : max));
      list.push(`El precio/m² más alto de la competencia es ${top.moneda} ${fmt(top.precio_m2 ?? 0)}/m² (en ${top.barrio || "barrio sin nombre"})`);
    }

    // Propiedades con +90 días
    const lentas = activas.filter((p) => (p.dias_en_mercado ?? 0) > 90);
    list.push(`Propiedades de la competencia con más de 90 días en mercado: ${lentas.length} (posible sobreprecio)`);

    // Vendidas en últimos 30 días
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    const vendidasRecientes = propiedades.filter((p) => {
      if (p.estado !== "vendida" || !p.fecha_venta) return false;
      return new Date(p.fecha_venta) >= hace30;
    });
    list.push(`${vendidasRecientes.length} propiedad${vendidasRecientes.length !== 1 ? "es" : ""} vendida${vendidasRecientes.length !== 1 ? "s" : ""} en los últimos 30 días (velocidad del mercado)`);

    return list;
  }, [propiedades, inmobiliarias]);

  if (!hydrated) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif", fontSize: 13 }}>Cargando...</p>
      </div>
    );
  }

  const thStyle: React.CSSProperties = {
    padding: "9px 12px",
    textAlign: "left",
    fontSize: 9,
    color: "rgba(255,255,255,0.35)",
    fontFamily: "'Montserrat',sans-serif",
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    borderBottom: "1px solid #222222",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
    color: "#e0e0e0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    verticalAlign: "middle",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "'Inter',sans-serif" }}>

      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid #222222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 12 }}>← CRM</Link>
        <h1 style={{ margin: 0, fontSize: 20, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em", color: "#e0e0e0" }}>
          Análisis de la Competencia
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #222222", padding: "0 24px", display: "flex", gap: 0 }}>
        {(["mapa", "propiedades", "analisis"] as TabId[]).map((t) => {
          const labels: Record<TabId, string> = { mapa: "Mapa Competitivo", propiedades: "Propiedades", analisis: "Análisis de Mercado" };
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "12px 20px",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid #cc0000" : "2px solid transparent",
                color: active ? "#e0e0e0" : "rgba(255,255,255,0.4)",
                fontSize: 12,
                fontFamily: "'Montserrat',sans-serif",
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.02em",
                marginBottom: -1,
              }}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>

        {/* ═══════════════════════════════════════════════════════════
            TAB 1 — MAPA COMPETITIVO
        ═══════════════════════════════════════════════════════════ */}
        {tab === "mapa" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter',sans-serif" }}>
                {inmobiliarias.length} inmobiliaria{inmobiliarias.length !== 1 ? "s" : ""} registrada{inmobiliarias.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => { setFormInm(emptyFormInmobiliaria); setShowModalInm(true); }}
                style={{ ...btnPrimary, padding: "8px 18px" }}
              >
                + Agregar inmobiliaria
              </button>
            </div>

            {inmobiliarias.length === 0 ? (
              <div style={{ ...cardStyle, padding: 60, textAlign: "center" }}>
                <p style={{ margin: "0 0 8px 0", fontSize: 32, opacity: 0.5 }}>🏢</p>
                <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
                  Aún no tenés competidores registrados. Empezá agregando las inmobiliarias de tu zona.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* Tabla de inmobiliarias */}
                <div style={{ flex: "1 1 500px", ...cardStyle, padding: 0, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        {["Nombre / Zona", "Activas", "$/m² prom.", "Días prom.", "Rotación", ""].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statsInm.map(({ inm, activas: nActivas, avgPrecioM2, avgDias, rotacion }) => {
                        const sel = selectedInmId === inm.id;
                        return (
                          <tr
                            key={inm.id}
                            onClick={() => setSelectedInmId(sel ? null : inm.id)}
                            style={{
                              background: sel ? "rgba(204,0,0,0.07)" : "transparent",
                              cursor: "pointer",
                              transition: "background 0.15s",
                            }}
                          >
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: sel ? "#cc0000" : "#e0e0e0" }}>{inm.nombre}</div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{inm.zona}</div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <span style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 16, color: "#22c55e" }}>{nActivas}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "#e0e0e0" }}>
                              {avgPrecioM2 !== null ? `${fmt(avgPrecioM2)}/m²` : "—"}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              {avgDias !== null ? (
                                <span style={{ color: avgDias > 90 ? "#cc0000" : avgDias > 60 ? "#f97316" : "#22c55e", fontWeight: 700 }}>
                                  {fmt(avgDias)}d
                                </span>
                              ) : "—"}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{rotacion.toFixed(0)}%</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); eliminarInmobiliaria(inm.id); }}
                                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 12, padding: 4 }}
                                title="Eliminar"
                              >✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Panel de detalle */}
                {selectedInm && statsDetalle && (
                  <div style={{ flex: "1 1 300px", ...cardStyle }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div>
                        <p style={{ margin: "0 0 2px 0", fontSize: 15, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#cc0000" }}>{selectedInm.nombre}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{selectedInm.zona}</p>
                      </div>
                      <button onClick={() => setSelectedInmId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>

                    {/* Info básica */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                      {selectedInm.telefono && (
                        <div>
                          <p style={{ ...labelStyle, margin: "0 0 2px 0" }}>Teléfono</p>
                          <p style={{ margin: 0, fontSize: 11, color: "#e0e0e0" }}>{selectedInm.telefono}</p>
                        </div>
                      )}
                      {selectedInm.instagram && (
                        <div>
                          <p style={{ ...labelStyle, margin: "0 0 2px 0" }}>Instagram</p>
                          <p style={{ margin: 0, fontSize: 11, color: "#e0e0e0" }}>{selectedInm.instagram}</p>
                        </div>
                      )}
                      {selectedInm.sitio_web && (
                        <div style={{ gridColumn: "1/3" }}>
                          <p style={{ ...labelStyle, margin: "0 0 2px 0" }}>Sitio web</p>
                          <a href={selectedInm.sitio_web} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3b82f6" }}>{selectedInm.sitio_web}</a>
                        </div>
                      )}
                      {selectedInm.notas && (
                        <div style={{ gridColumn: "1/3" }}>
                          <p style={{ ...labelStyle, margin: "0 0 2px 0" }}>Notas</p>
                          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{selectedInm.notas}</p>
                        </div>
                      )}
                    </div>

                    {/* KPIs */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                      {[
                        { label: "Activas", val: statsDetalle.activas.length, color: "#22c55e" },
                        { label: "$/m² prom.", val: statsDetalle.avgPrecioM2 !== null ? `${fmt(statsDetalle.avgPrecioM2)}/m²` : "—", color: "#e0e0e0" },
                        { label: "Días prom.", val: statsDetalle.avgDias !== null ? `${fmt(statsDetalle.avgDias)}d` : "—", color: statsDetalle.avgDias !== null && statsDetalle.avgDias > 90 ? "#cc0000" : statsDetalle.avgDias !== null && statsDetalle.avgDias > 60 ? "#f97316" : "#22c55e" },
                        { label: "Total prop.", val: statsDetalle.total, color: "rgba(255,255,255,0.6)" },
                        { label: "Rotación", val: `${statsDetalle.rotacion.toFixed(0)}%`, color: "#3b82f6" },
                      ].map((k) => (
                        <div key={k.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
                          <p style={{ ...labelStyle, margin: "0 0 3px 0" }}>{k.label}</p>
                          <p style={{ margin: 0, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, color: k.color }}>{k.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Propiedades activas */}
                    <p style={{ ...labelStyle, marginBottom: 8 }}>Propiedades activas</p>
                    {statsDetalle.activas.length === 0 ? (
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>Sin propiedades activas</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {statsDetalle.activas.map((p) => (
                          <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <p style={{ margin: "0 0 1px 0", fontSize: 11, fontWeight: 600, color: "#e0e0e0" }}>{p.descripcion}</p>
                              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{p.barrio} · {p.tipo_propiedad} · {p.tipo_operacion}</p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p style={{ margin: "0 0 1px 0", fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color: "#e0e0e0" }}>{p.moneda} {fmt(p.precio)}</p>
                              {p.precio_m2 !== null && (
                                <p style={{ margin: 0, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{fmt(p.precio_m2)}/m²</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 2 — PROPIEDADES DE LA COMPETENCIA
        ═══════════════════════════════════════════════════════════ */}
        {tab === "propiedades" && (
          <div>
            {/* Barra superior */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                {propsFiltradas.length} propiedad{propsFiltradas.length !== 1 ? "es" : ""}
              </p>
              <button
                onClick={() => { setFormProp(emptyFormPropiedad(inmobiliarias[0]?.id ?? "")); setShowModalProp(true); }}
                style={btnPrimary}
                disabled={inmobiliarias.length === 0}
              >
                + Agregar propiedad
              </button>
            </div>

            {/* Filtros */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={filtroInm}
                onChange={(e) => setFiltroInm(e.target.value)}
                style={{ ...inputStyle, width: "auto", minWidth: 160 }}
              >
                <option value="todos">Todas las inmobiliarias</option>
                {inmobiliarias.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 4 }}>
                {(["todos", "venta", "alquiler"] as const).map((op) => (
                  <button
                    key={op}
                    onClick={() => setFiltroOp(op)}
                    style={{
                      padding: "5px 12px", borderRadius: 16, fontSize: 10,
                      fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${filtroOp === op ? "rgba(204,0,0,0.5)" : "#222222"}`,
                      background: filtroOp === op ? "rgba(204,0,0,0.12)" : "transparent",
                      color: filtroOp === op ? "#cc0000" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {op === "todos" ? "Todas" : op === "venta" ? "Venta" : "Alquiler"}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Filtrar por barrio..."
                value={filtroBarrio}
                onChange={(e) => setFiltroBarrio(e.target.value)}
                style={{ ...inputStyle, width: 160 }}
              />

              <div style={{ display: "flex", gap: 4 }}>
                {(["todos", "activa", "vendida", "retirada"] as const).map((est) => {
                  const badge = est !== "todos" ? estadoBadge(est) : null;
                  return (
                    <button
                      key={est}
                      onClick={() => setFiltroEstado(est)}
                      style={{
                        padding: "5px 12px", borderRadius: 16, fontSize: 10,
                        fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer",
                        border: `1px solid ${filtroEstado === est ? (badge?.color ?? "rgba(255,255,255,0.3)") + "66" : "#222222"}`,
                        background: filtroEstado === est ? (badge?.bg ?? "rgba(255,255,255,0.05)") : "transparent",
                        color: filtroEstado === est ? (badge?.color ?? "#e0e0e0") : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {est === "todos" ? "Todos" : est.charAt(0).toUpperCase() + est.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tabla */}
            {propiedades.length === 0 && inmobiliarias.length === 0 ? (
              <div style={{ ...cardStyle, padding: 60, textAlign: "center" }}>
                <p style={{ margin: "0 0 8px 0", fontSize: 32, opacity: 0.5 }}>🏠</p>
                <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
                  Aún no tenés competidores registrados. Empezá agregando las inmobiliarias de tu zona.
                </p>
              </div>
            ) : (
              <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                {propsFiltradas.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Sin resultados con los filtros actuales</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                          <th style={thStyle}>Descripción</th>
                          <th style={thStyle}>Inmobiliaria</th>
                          <th style={thStyle}>Barrio</th>
                          <th style={thStyle}>Tipo</th>
                          <th style={{ ...thStyle, textAlign: "center" }}>m²</th>
                          <th
                            style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                            onClick={() => toggleSort("precio")}
                          >
                            Precio{sortArrow("precio")}
                          </th>
                          <th
                            style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                            onClick={() => toggleSort("precio_m2")}
                          >
                            $/m²{sortArrow("precio_m2")}
                          </th>
                          <th style={thStyle}>Estado</th>
                          <th
                            style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                            onClick={() => toggleSort("dias_en_mercado")}
                          >
                            Días{sortArrow("dias_en_mercado")}
                          </th>
                          <th style={thStyle}>Publicada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {propsFiltradas.map((p) => {
                          const badge = estadoBadge(p.estado);
                          const inm = inmobiliarias.find((i) => i.id === p.inmobiliaria_id);
                          return (
                            <tr
                              key={p.id}
                              onClick={() => { setDetallePropId(p.id); setNuevoEstado(p.estado); setFechaVentaInput(fechaHoy()); }}
                              style={{ cursor: "pointer", opacity: p.estado !== "activa" ? 0.65 : 1 }}
                            >
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 600, fontSize: 12 }}>{p.descripcion}</div>
                                {p.url && (
                                  <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: 10, color: "#3b82f6", textDecoration: "none" }}
                                  >
                                    Ver en portal →
                                  </a>
                                )}
                              </td>
                              <td style={{ ...tdStyle, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{inm?.nombre ?? "—"}</td>
                              <td style={{ ...tdStyle, fontSize: 11 }}>{p.barrio || "—"}</td>
                              <td style={{ ...tdStyle, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{p.tipo_propiedad}</td>
                              <td style={{ ...tdStyle, textAlign: "center", fontSize: 11 }}>{p.m2 !== null ? `${p.m2}` : "—"}</td>
                              <td style={{ ...tdStyle, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                                {p.moneda} {fmt(p.precio)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: "center", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 12, color: "#cc0000" }}>
                                {p.precio_m2 !== null ? `${fmt(p.precio_m2)}/m²` : "—"}
                              </td>
                              <td style={{ ...tdStyle, textAlign: "center" }}>
                                <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 20, background: badge.bg, color: badge.color, fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>
                                  {badge.label}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: "center" }}>
                                {p.dias_en_mercado !== null ? (
                                  <span style={{ fontWeight: 700, color: p.dias_en_mercado > 90 ? "#cc0000" : p.dias_en_mercado > 60 ? "#f97316" : "#22c55e" }}>
                                    {p.dias_en_mercado}d
                                  </span>
                                ) : "—"}
                              </td>
                              <td style={{ ...tdStyle, fontSize: 11, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                                {p.fecha_publicacion}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 3 — ANÁLISIS DE MERCADO
        ═══════════════════════════════════════════════════════════ */}
        {tab === "analisis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Comparativa por barrio */}
            <div style={cardStyle}>
              <p style={{ margin: "0 0 16px 0", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Comparativa precio/m² por barrio
              </p>
              {barrioPreciosComp.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Sin datos suficientes</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Barrio</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Competencia $/m²</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Tus propiedades $/m²</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barrioPreciosComp.map(({ barrio, competencia }) => (
                        <tr key={barrio}>
                          <td style={tdStyle}>{barrio}</td>
                          <td style={{ ...tdStyle, textAlign: "center", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "#cc0000" }}>
                            {fmt(competencia)}/m²
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                            N/A
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Gráfico de barras: precio/m² por inmobiliaria */}
            {inmpreciosM2.length > 0 && (
              <div style={cardStyle}>
                <p style={{ margin: "0 0 16px 0", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Precio/m² promedio por inmobiliaria
                </p>
                <PrecioM2Chart data={inmpreciosM2} />
              </div>
            )}

            {/* Gráfico horizontal: días en mercado */}
            {inmdias.length > 0 && (
              <div style={cardStyle}>
                <p style={{ margin: "0 0 16px 0", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Tiempo promedio en mercado (propiedades activas)
                </p>
                <DiasChart data={inmdias} />
              </div>
            )}

            {/* Insights */}
            <div style={cardStyle}>
              <p style={{ margin: "0 0 16px 0", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Insights automáticos
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {insights.map((insight, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, borderLeft: "3px solid #cc0000" }}>
                    <span style={{ color: "#cc0000", fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>▸</span>
                    <p style={{ margin: 0, fontSize: 12, color: "#e0e0e0", lineHeight: 1.6 }}>{insight}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════════
          MODAL — Agregar inmobiliaria
      ═══════════════════════════════════════════════════════════ */}
      {showModalInm && (
        <Modal title="Agregar inmobiliaria" onClose={() => setShowModalInm(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/3" }}>
              <label style={labelStyle}>Nombre *</label>
              <input type="text" value={formInm.nombre} onChange={(e) => setFormInm((f) => ({ ...f, nombre: e.target.value }))} style={inputStyle} placeholder="Ej: Inmobiliaria del Centro" />
            </div>
            <div style={{ gridColumn: "1/3" }}>
              <label style={labelStyle}>Zona / Área de cobertura</label>
              <input type="text" value={formInm.zona} onChange={(e) => setFormInm((f) => ({ ...f, zona: e.target.value }))} style={inputStyle} placeholder="Ej: Palermo / Recoleta" />
            </div>
            <div>
              <label style={labelStyle}>Sitio web</label>
              <input type="url" value={formInm.sitio_web} onChange={(e) => setFormInm((f) => ({ ...f, sitio_web: e.target.value }))} style={inputStyle} placeholder="https://..." />
            </div>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input type="tel" value={formInm.telefono} onChange={(e) => setFormInm((f) => ({ ...f, telefono: e.target.value }))} style={inputStyle} placeholder="011-4444-0000" />
            </div>
            <div>
              <label style={labelStyle}>Instagram</label>
              <input type="text" value={formInm.instagram} onChange={(e) => setFormInm((f) => ({ ...f, instagram: e.target.value }))} style={inputStyle} placeholder="@usuario" />
            </div>
            <div>
              <label style={labelStyle}>Notas</label>
              <input type="text" value={formInm.notas} onChange={(e) => setFormInm((f) => ({ ...f, notas: e.target.value }))} style={inputStyle} placeholder="Observaciones..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={agregarInmobiliaria} style={btnPrimary}>Agregar</button>
            <button onClick={() => setShowModalInm(false)} style={btnSecondary}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — Agregar propiedad
      ═══════════════════════════════════════════════════════════ */}
      {showModalProp && (
        <Modal title="Agregar propiedad de la competencia" onClose={() => setShowModalProp(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/3" }}>
              <label style={labelStyle}>Inmobiliaria *</label>
              <select value={formProp.inmobiliaria_id} onChange={(e) => setFormProp((f) => ({ ...f, inmobiliaria_id: e.target.value }))} style={inputStyle}>
                {inmobiliarias.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1/3" }}>
              <label style={labelStyle}>Descripción *</label>
              <input type="text" value={formProp.descripcion} onChange={(e) => setFormProp((f) => ({ ...f, descripcion: e.target.value }))} style={inputStyle} placeholder="Ej: Depto 3 amb con cochera, piso 8" />
            </div>
            <div>
              <label style={labelStyle}>Tipo de operación</label>
              <select value={formProp.tipo_operacion} onChange={(e) => setFormProp((f) => ({ ...f, tipo_operacion: e.target.value as "venta" | "alquiler" }))} style={inputStyle}>
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tipo de propiedad</label>
              <select value={formProp.tipo_propiedad} onChange={(e) => setFormProp((f) => ({ ...f, tipo_propiedad: e.target.value }))} style={inputStyle}>
                {TIPOS_PROPIEDAD.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Barrio</label>
              <input type="text" value={formProp.barrio} onChange={(e) => setFormProp((f) => ({ ...f, barrio: e.target.value }))} style={inputStyle} placeholder="Ej: Palermo" />
            </div>
            <div>
              <label style={labelStyle}>m² (superficie)</label>
              <input type="number" value={formProp.m2} onChange={(e) => setFormProp((f) => ({ ...f, m2: e.target.value }))} style={inputStyle} placeholder="Ej: 85" />
            </div>
            <div>
              <label style={labelStyle}>Precio *</label>
              <input type="number" value={formProp.precio} onChange={(e) => setFormProp((f) => ({ ...f, precio: e.target.value }))} style={inputStyle} placeholder="Ej: 185000" />
            </div>
            <div>
              <label style={labelStyle}>Moneda</label>
              <select value={formProp.moneda} onChange={(e) => setFormProp((f) => ({ ...f, moneda: e.target.value }))} style={inputStyle}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={formProp.estado} onChange={(e) => setFormProp((f) => ({ ...f, estado: e.target.value as "activa" | "vendida" | "retirada" }))} style={inputStyle}>
                <option value="activa">Activa</option>
                <option value="vendida">Vendida</option>
                <option value="retirada">Retirada</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha de publicación</label>
              <input type="date" value={formProp.fecha_publicacion} onChange={(e) => setFormProp((f) => ({ ...f, fecha_publicacion: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Días en mercado</label>
              <input type="number" value={formProp.dias_en_mercado} onChange={(e) => setFormProp((f) => ({ ...f, dias_en_mercado: e.target.value }))} style={inputStyle} placeholder="0" />
            </div>
            <div style={{ gridColumn: "1/3" }}>
              <label style={labelStyle}>URL del portal</label>
              <input type="url" value={formProp.url} onChange={(e) => setFormProp((f) => ({ ...f, url: e.target.value }))} style={inputStyle} placeholder="https://..." />
            </div>
            <div style={{ gridColumn: "1/3" }}>
              <label style={labelStyle}>Notas</label>
              <input type="text" value={formProp.notas} onChange={(e) => setFormProp((f) => ({ ...f, notas: e.target.value }))} style={inputStyle} placeholder="Observaciones..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={agregarPropiedad} style={btnPrimary}>Agregar</button>
            <button onClick={() => setShowModalProp(false)} style={btnSecondary}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — Detalle propiedad
      ═══════════════════════════════════════════════════════════ */}
      {detallePropId && detalleProp && !showActualizarEstado && (
        <Modal title="Detalle de propiedad" onClose={() => setDetallePropId(null)}>
          <PropiedadDetalle
            prop={detalleProp}
            inmNombre={inmobiliarias.find((i) => i.id === detalleProp.inmobiliaria_id)?.nombre ?? "—"}
            onActualizarEstado={() => setShowActualizarEstado(true)}
          />
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL — Actualizar estado
      ═══════════════════════════════════════════════════════════ */}
      {showActualizarEstado && detallePropId && (
        <Modal title="Actualizar estado" onClose={() => { setShowActualizarEstado(false); setDetallePropId(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Nuevo estado</label>
              <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value as "activa" | "vendida" | "retirada")} style={inputStyle}>
                <option value="activa">Activa</option>
                <option value="vendida">Vendida</option>
                <option value="retirada">Retirada</option>
              </select>
            </div>
            {nuevoEstado === "vendida" && (
              <div>
                <label style={labelStyle}>Fecha de venta</label>
                <input type="date" value={fechaVentaInput} onChange={(e) => setFechaVentaInput(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={actualizarEstadoPropiedad} style={btnPrimary}>Guardar</button>
              <button onClick={() => { setShowActualizarEstado(false); setDetallePropId(null); }} style={btnSecondary}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

// ── Sub-componente: detalle de propiedad ──────────────────────────────────────

function PropiedadDetalle({
  prop,
  inmNombre,
  onActualizarEstado,
}: {
  prop: PropiedadCompetencia;
  inmNombre: string;
  onActualizarEstado: () => void;
}) {
  const badge = estadoBadge(prop.estado);
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" };
  const keyStyle: React.CSSProperties = { fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" };
  const valStyle: React.CSSProperties = { fontSize: 12, color: "#e0e0e0", fontWeight: 500 };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#e0e0e0" }}>{prop.descripcion}</p>
        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: badge.bg, color: badge.color, fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>{badge.label}</span>
      </div>
      <div>
        {[
          { k: "Inmobiliaria", v: inmNombre },
          { k: "Tipo operación", v: prop.tipo_operacion === "venta" ? "Venta" : "Alquiler" },
          { k: "Tipo propiedad", v: prop.tipo_propiedad },
          { k: "Barrio", v: prop.barrio || "—" },
          { k: "Superficie", v: prop.m2 !== null ? `${prop.m2} m²` : "—" },
          { k: "Precio", v: `${prop.moneda} ${prop.precio.toLocaleString("es-AR")}` },
          { k: "Precio/m²", v: prop.precio_m2 !== null ? `${prop.moneda} ${prop.precio_m2.toLocaleString("es-AR", { maximumFractionDigits: 0 })}/m²` : "—" },
          { k: "Días en mercado", v: prop.dias_en_mercado !== null ? `${prop.dias_en_mercado} días` : "—" },
          { k: "Publicada", v: prop.fecha_publicacion },
          { k: "Vendida", v: prop.fecha_venta ?? "—" },
        ].map(({ k, v }) => (
          <div key={k} style={rowStyle}>
            <span style={keyStyle}>{k}</span>
            <span style={valStyle}>{v}</span>
          </div>
        ))}
        {prop.notas && (
          <div style={{ marginTop: 10 }}>
            <p style={{ ...keyStyle, marginBottom: 4 }}>Notas</p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>{prop.notas}</p>
          </div>
        )}
      </div>
      {prop.url && (
        <a href={prop.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 14, fontSize: 12, color: "#3b82f6" }}>
          Ver en portal →
        </a>
      )}
      <div style={{ marginTop: 20 }}>
        <button onClick={onActualizarEstado} style={{ padding: "8px 18px", borderRadius: 8, background: "rgba(204,0,0,0.15)", border: "1px solid rgba(204,0,0,0.4)", color: "#cc0000", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
          Actualizar estado
        </button>
      </div>
    </div>
  );
}

// ── Sub-componente: gráfico de barras precio/m² ───────────────────────────────

function PrecioM2Chart({ data }: { data: { nombre: string; avg: number | null }[] }) {
  const validData = data.filter((d): d is { nombre: string; avg: number } => d.avg !== null);
  if (validData.length === 0) return <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Sin datos</p>;

  const maxVal = Math.max(...validData.map((d) => d.avg));
  const W = 700;
  const H = 260;
  const paddingLeft = 180;
  const paddingRight = 40;
  const paddingTop = 20;
  const paddingBottom = 50;
  const chartW = W - paddingLeft - paddingRight;
  const chartH = H - paddingTop - paddingBottom;
  const barCount = validData.length;
  const barW = Math.min(60, (chartW / barCount) * 0.6);
  const barGap = chartW / barCount;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block", maxWidth: "100%" }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = paddingTop + chartH - frac * chartH;
          const val = frac * maxVal;
          return (
            <g key={frac}>
              <line x1={paddingLeft} y1={y} x2={paddingLeft + chartW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="Inter,sans-serif">
                {fmt(val)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {validData.map((d, idx) => {
          const barH = (d.avg / maxVal) * chartH;
          const x = paddingLeft + idx * barGap + (barGap - barW) / 2;
          const y = paddingTop + chartH - barH;
          return (
            <g key={d.nombre}>
              <rect x={x} y={y} width={barW} height={barH} fill="#cc0000" rx={4} />
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill="#cc0000" fontSize={10} fontFamily="Montserrat,sans-serif" fontWeight={700}>
                {fmt(d.avg)}
              </text>
              <text
                x={x + barW / 2}
                y={paddingTop + chartH + 16}
                textAnchor="middle"
                fill="rgba(255,255,255,0.45)"
                fontSize={9}
                fontFamily="Inter,sans-serif"
              >
                {d.nombre.length > 20 ? d.nombre.slice(0, 18) + "…" : d.nombre}
              </text>
            </g>
          );
        })}
        {/* Axis */}
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartH} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        <line x1={paddingLeft} y1={paddingTop + chartH} x2={paddingLeft + chartW} y2={paddingTop + chartH} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ── Sub-componente: gráfico de barras horizontales días ───────────────────────

function DiasChart({ data }: { data: { nombre: string; avg: number | null }[] }) {
  const validData = data.filter((d): d is { nombre: string; avg: number } => d.avg !== null);
  if (validData.length === 0) return <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Sin datos</p>;

  const maxVal = Math.max(...validData.map((d) => d.avg), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {validData.map((d) => {
        const pct = (d.avg / maxVal) * 100;
        const color = d.avg < 60 ? "#22c55e" : d.avg > 90 ? "#cc0000" : "#f97316";
        return (
          <div key={d.nombre} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", minWidth: 180, flexShrink: 0 }}>{d.nombre}</span>
            <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 5, transition: "width 0.4s ease" }} />
            </div>
            <span style={{ fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color, minWidth: 50, textAlign: "right" }}>
              {d.avg.toFixed(0)}d
            </span>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
        {[{ color: "#22c55e", label: "< 60 días" }, { color: "#f97316", label: "60–90 días" }, { color: "#cc0000", label: "> 90 días" }].map((leg) => (
          <div key={leg.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: leg.color }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>{leg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
