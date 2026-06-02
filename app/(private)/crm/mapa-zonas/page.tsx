"use client";

import { useState, useMemo } from "react";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Zona {
  id: string;
  nombre: string;
  barrio: string;
  ciudad: string;
  lat: number; // grid row 0-7
  lng: number; // grid col 0-9
  precioM2Venta: number;   // USD/m²
  precioM2Alquiler: number; // ARS/m²
  diasMercado: number;
  cantPropiedades: number;
  demanda: number; // 0-100
  oferta: number;  // 0-100
  tendencia: "sube" | "baja" | "estable";
  variacion12m: number; // % precio m² vs hace 12 meses
}

type Metrica = "precioM2Venta" | "precioM2Alquiler" | "diasMercado" | "demanda" | "oferta" | "variacion12m";
type Vista = "mapa" | "tabla" | "ranking";

// ── Datos demo ───────────────────────────────────────────────────────────────

const ZONAS_DEMO: Zona[] = [
  { id:"z1",  nombre:"Palermo Soho",      barrio:"Palermo",       ciudad:"CABA", lat:2, lng:2, precioM2Venta:3200, precioM2Alquiler:2800, diasMercado:38, cantPropiedades:142, demanda:92, oferta:65, tendencia:"sube",   variacion12m:8.4  },
  { id:"z2",  nombre:"Recoleta Centro",   barrio:"Recoleta",      ciudad:"CABA", lat:2, lng:4, precioM2Venta:3500, precioM2Alquiler:3100, diasMercado:52, cantPropiedades:98,  demanda:78, oferta:55, tendencia:"estable", variacion12m:3.2  },
  { id:"z3",  nombre:"Belgrano R",        barrio:"Belgrano",      ciudad:"CABA", lat:1, lng:3, precioM2Venta:2900, precioM2Alquiler:2500, diasMercado:45, cantPropiedades:187, demanda:85, oferta:72, tendencia:"sube",   variacion12m:6.1  },
  { id:"z4",  nombre:"Puerto Madero",     barrio:"Puerto Madero", ciudad:"CABA", lat:3, lng:5, precioM2Venta:5800, precioM2Alquiler:4200, diasMercado:95, cantPropiedades:44,  demanda:40, oferta:30, tendencia:"baja",   variacion12m:-2.3 },
  { id:"z5",  nombre:"Villa Crespo",      barrio:"Villa Crespo",  ciudad:"CABA", lat:3, lng:2, precioM2Venta:2200, precioM2Alquiler:1900, diasMercado:32, cantPropiedades:215, demanda:88, oferta:80, tendencia:"sube",   variacion12m:11.2 },
  { id:"z6",  nombre:"Caballito Norte",   barrio:"Caballito",     ciudad:"CABA", lat:4, lng:2, precioM2Venta:2000, precioM2Alquiler:1750, diasMercado:28, cantPropiedades:302, demanda:91, oferta:88, tendencia:"estable", variacion12m:4.7  },
  { id:"z7",  nombre:"Flores",            barrio:"Flores",        ciudad:"CABA", lat:5, lng:2, precioM2Venta:1600, precioM2Alquiler:1400, diasMercado:22, cantPropiedades:388, demanda:95, oferta:92, tendencia:"estable", variacion12m:2.1  },
  { id:"z8",  nombre:"Núñez",             barrio:"Núñez",         ciudad:"CABA", lat:0, lng:3, precioM2Venta:2700, precioM2Alquiler:2300, diasMercado:41, cantPropiedades:129, demanda:80, oferta:60, tendencia:"sube",   variacion12m:7.8  },
  { id:"z9",  nombre:"San Telmo",         barrio:"San Telmo",     ciudad:"CABA", lat:4, lng:4, precioM2Venta:2400, precioM2Alquiler:2100, diasMercado:60, cantPropiedades:76,  demanda:65, oferta:50, tendencia:"estable", variacion12m:1.5  },
  { id:"z10", nombre:"Boedo",             barrio:"Boedo",         ciudad:"CABA", lat:5, lng:3, precioM2Venta:1800, precioM2Alquiler:1550, diasMercado:25, cantPropiedades:244, demanda:87, oferta:85, tendencia:"sube",   variacion12m:9.3  },
  { id:"z11", nombre:"Liniers",           barrio:"Liniers",       ciudad:"CABA", lat:6, lng:1, precioM2Venta:1300, precioM2Alquiler:1100, diasMercado:18, cantPropiedades:421, demanda:97, oferta:96, tendencia:"estable", variacion12m:0.8  },
  { id:"z12", nombre:"Barracas",          barrio:"Barracas",      ciudad:"CABA", lat:6, lng:4, precioM2Venta:1700, precioM2Alquiler:1450, diasMercado:35, cantPropiedades:163, demanda:72, oferta:68, tendencia:"sube",   variacion12m:5.6  },
  { id:"z13", nombre:"Almagro",           barrio:"Almagro",       ciudad:"CABA", lat:4, lng:3, precioM2Venta:1950, precioM2Alquiler:1700, diasMercado:27, cantPropiedades:278, demanda:89, oferta:84, tendencia:"estable", variacion12m:3.9  },
  { id:"z14", nombre:"Villa Urquiza",     barrio:"Villa Urquiza", ciudad:"CABA", lat:1, lng:2, precioM2Venta:2100, precioM2Alquiler:1850, diasMercado:30, cantPropiedades:196, demanda:84, oferta:76, tendencia:"sube",   variacion12m:6.7  },
  { id:"z15", nombre:"Montserrat",        barrio:"Montserrat",    ciudad:"CABA", lat:3, lng:4, precioM2Venta:2600, precioM2Alquiler:2200, diasMercado:48, cantPropiedades:112, demanda:70, oferta:58, tendencia:"baja",   variacion12m:-1.2 },
  { id:"z16", nombre:"Palermo Hollywood", barrio:"Palermo",       ciudad:"CABA", lat:2, lng:3, precioM2Venta:3400, precioM2Alquiler:2950, diasMercado:42, cantPropiedades:118, demanda:88, oferta:62, tendencia:"sube",   variacion12m:9.1  },
  { id:"z17", nombre:"Saavedra",          barrio:"Saavedra",      ciudad:"CABA", lat:0, lng:2, precioM2Venta:2300, precioM2Alquiler:2000, diasMercado:36, cantPropiedades:155, demanda:76, oferta:70, tendencia:"estable", variacion12m:4.2  },
  { id:"z18", nombre:"La Boca",           barrio:"La Boca",       ciudad:"CABA", lat:5, lng:5, precioM2Venta:1400, precioM2Alquiler:1200, diasMercado:55, cantPropiedades:88,  demanda:55, oferta:48, tendencia:"baja",   variacion12m:-3.1 },
  { id:"z19", nombre:"Villa del Parque",  barrio:"Villa del Parque", ciudad:"CABA", lat:3, lng:1, precioM2Venta:1850, precioM2Alquiler:1600, diasMercado:29, cantPropiedades:221, demanda:83, oferta:82, tendencia:"estable", variacion12m:3.5 },
  { id:"z20", nombre:"Paternal",          barrio:"Paternal",      ciudad:"CABA", lat:3, lng:0, precioM2Venta:1650, precioM2Alquiler:1420, diasMercado:24, cantPropiedades:189, demanda:86, oferta:90, tendencia:"estable", variacion12m:2.8 },
];

const GRILLA_ROWS = 8;
const GRILLA_COLS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtUSD = (n: number) => `USD ${n.toLocaleString("es-AR")}`;
const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

function intensidad(valor: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (valor - min) / (max - min);
}

function colorHeat(t: number, metrica: Metrica): string {
  // Para días en mercado: más días = peor (rojo) → invertimos
  const inv = metrica === "diasMercado" || metrica === "oferta";
  const v = inv ? 1 - t : t;
  if (v < 0.25) return `rgba(59,130,246,${0.3 + v * 0.8})`;     // azul bajo
  if (v < 0.5)  return `rgba(34,197,94,${0.3 + v * 0.8})`;      // verde medio
  if (v < 0.75) return `rgba(234,179,8,${0.3 + v * 0.8})`;      // amarillo alto
  return `rgba(153,0,0,${0.3 + v * 0.7})`;                       // rojo muy alto
}

const METRICAS: { id: Metrica; label: string; fmt: (n: number) => string }[] = [
  { id: "precioM2Venta",    label: "Precio/m² Venta",    fmt: fmtUSD },
  { id: "precioM2Alquiler", label: "Precio/m² Alquiler", fmt: (n) => fmtARS(n) + "/m²" },
  { id: "demanda",          label: "Demanda",             fmt: (n) => `${n}%` },
  { id: "oferta",           label: "Oferta disponible",   fmt: (n) => `${n}%` },
  { id: "diasMercado",      label: "Días en mercado",     fmt: (n) => `${n}d` },
  { id: "variacion12m",     label: "Variación 12m",       fmt: (n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%` },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function MapaZonasPage() {
  const [metrica, setMetrica] = useState<Metrica>("precioM2Venta");
  const [vista, setVista] = useState<Vista>("mapa");
  const [zonaHover, setZonaHover] = useState<Zona | null>(null);
  const [zonaSeleccionada, setZonaSeleccionada] = useState<Zona | null>(null);
  const [sortCol, setSortCol] = useState<keyof Zona>("precioM2Venta");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filtroTendencia, setFiltroTendencia] = useState<"todas" | "sube" | "baja" | "estable">("todas");

  const metricaInfo = METRICAS.find(m => m.id === metrica)!;

  // Rango de la métrica para normalización
  const { minVal, maxVal } = useMemo<{ minVal: number; maxVal: number }>(() => {
    const vals = ZONAS_DEMO.map(z => z[metrica] as number);
    return { minVal: Math.min(...vals), maxVal: Math.max(...vals) };
  }, [metrica]);

  // Grilla: celda → zona
  const grilla = useMemo<(Zona | null)[][]>(() => {
    const grid: (Zona | null)[][] = Array.from({ length: GRILLA_ROWS }, () =>
      Array(GRILLA_COLS).fill(null)
    );
    ZONAS_DEMO.forEach(z => {
      if (z.lat < GRILLA_ROWS && z.lng < GRILLA_COLS) {
        grid[z.lat][z.lng] = z;
      }
    });
    return grid;
  }, []);

  // Ranking ordenado
  const ranking = useMemo<Zona[]>(() => {
    const filtradas = filtroTendencia === "todas"
      ? [...ZONAS_DEMO]
      : ZONAS_DEMO.filter(z => z.tendencia === filtroTendencia);
    return filtradas.sort((a, b) => {
      const av = a[sortCol] as number | string;
      const bv = b[sortCol] as number | string;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "desc" ? bv - av : av - bv;
      }
      return sortDir === "desc"
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv));
    });
  }, [sortCol, sortDir, filtroTendencia]);

  // KPIs globales
  const kpis = useMemo<{
    promPrecioVenta: number;
    promDias: number;
    zonasMasActivas: number;
    variacionPromedio: number;
  }>(() => {
    const promPrecioVenta = Math.round(ZONAS_DEMO.reduce((s, z) => s + z.precioM2Venta, 0) / ZONAS_DEMO.length);
    const promDias = Math.round(ZONAS_DEMO.reduce((s, z) => s + z.diasMercado, 0) / ZONAS_DEMO.length);
    const zonasMasActivas = ZONAS_DEMO.filter(z => z.demanda >= 85).length;
    const variacionPromedio = parseFloat(
      (ZONAS_DEMO.reduce((s, z) => s + z.variacion12m, 0) / ZONAS_DEMO.length).toFixed(1)
    );
    return { promPrecioVenta, promDias, zonasMasActivas, variacionPromedio };
  }, []);

  const toggleSort = (col: keyof Zona) => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const tendenciaIcon = (t: Zona["tendencia"]) =>
    t === "sube" ? "▲" : t === "baja" ? "▼" : "→";
  const tendenciaColor = (t: Zona["tendencia"]) =>
    t === "sube" ? "#3abab6" : t === "baja" ? "#b80000" : "#94a3b8";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .mz-wrap { max-width: 1000px; display: flex; flex-direction: column; gap: 20px; font-family: 'Inter', sans-serif; }
        .mz-titulo { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .mz-titulo span { color: #990000; }
        .mz-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 3px; }
        /* KPIs */
        .mz-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
        .mz-kpi { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 14px 16px; }
        .mz-kpi-val { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; color: #fff; }
        .mz-kpi-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 4px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        /* Métricas selector */
        .mz-metricas { display: flex; gap: 6px; flex-wrap: wrap; }
        .mz-metrica-btn { padding: 6px 13px; border-radius: 20px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); transition: all 0.15s; }
        /* Tabs */
        .mz-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .mz-tab { padding: 10px 18px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); cursor: pointer; border-bottom: 2px solid transparent; background: none; border-top: none; border-left: none; border-right: none; transition: all 0.15s; }
        .mz-tab.on { color: #fff; border-bottom-color: #990000; }
        /* Mapa grilla */
        .mz-grid-wrap { position: relative; overflow: hidden; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07); background: rgba(8,8,8,0.95); }
        .mz-grid { display: grid; gap: 3px; padding: 12px; }
        .mz-celda { aspect-ratio: 1.4; border-radius: 5px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; position: relative; overflow: hidden; }
        .mz-celda:hover { transform: scale(1.06); z-index: 2; }
        .mz-celda.vacia { background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.05); cursor: default; }
        .mz-celda.vacia:hover { transform: none; }
        .mz-celda-nombre { font-family: 'Montserrat',sans-serif; font-size: 7.5px; font-weight: 700; text-align: center; line-height: 1.3; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); padding: 2px; }
        .mz-celda-val { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
        .mz-celda-tend { position: absolute; top: 3px; right: 4px; font-size: 8px; font-weight: 800; }
        /* Tooltip */
        .mz-tooltip { position: fixed; background: rgba(10,10,10,0.97); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 14px 16px; pointer-events: none; z-index: 100; min-width: 200px; box-shadow: 0 8px 32px rgba(0,0,0,0.6); }
        .mz-tooltip-nombre { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .mz-tooltip-row { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; font-size: 11px; }
        .mz-tooltip-key { color: rgba(255,255,255,0.4); }
        .mz-tooltip-val { color: #fff; font-weight: 600; font-family: 'Montserrat',sans-serif; }
        /* Leyenda */
        .mz-leyenda { display: flex; gap: 4px; align-items: center; justify-content: flex-end; font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; }
        .mz-leyenda-grad { width: 80px; height: 8px; border-radius: 4px; }
        /* Panel detalle */
        .mz-detalle { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 18px 20px; }
        .mz-detalle-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 12px; }
        .mz-detalle-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
        .mz-detalle-stat { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 10px 12px; }
        .mz-detalle-stat-val { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; }
        .mz-detalle-stat-label { font-size: 9px; color: rgba(255,255,255,0.35); margin-top: 3px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        /* Barras de oferta/demanda */
        .mz-barra-row { margin-bottom: 6px; }
        .mz-barra-label { display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.4); margin-bottom: 3px; }
        .mz-barra-bg { height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
        .mz-barra-fill { height: 100%; border-radius: 3px; }
        /* Tabla */
        .mz-tabla-wrap { overflow-x: auto; }
        .mz-tabla { width: 100%; border-collapse: collapse; font-size: 12px; }
        .mz-tabla th { padding: 8px 10px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; white-space: nowrap; user-select: none; }
        .mz-tabla th:hover { color: rgba(255,255,255,0.5); }
        .mz-tabla td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); font-family: 'Inter',sans-serif; color: rgba(255,255,255,0.7); white-space: nowrap; }
        .mz-tabla tr:hover td { background: rgba(255,255,255,0.02); }
        /* Filtros */
        .mz-filtros { display: flex; gap: 6px; align-items: center; }
        .mz-filtro-btn { padding: 5px 12px; border-radius: 20px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4); transition: all 0.15s; }
        .mz-filtro-btn.on { background: rgba(153,0,0,0.15); border-color: rgba(153,0,0,0.3); color: #990000; }
        /* Ranking */
        .mz-rank-item { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.06); border-radius: 7px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; margin-bottom: 6px; transition: border-color 0.15s; cursor: pointer; }
        .mz-rank-item:hover { border-color: rgba(255,255,255,0.14); }
        .mz-rank-num { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: rgba(255,255,255,0.15); width: 30px; flex-shrink: 0; text-align: right; }
        .mz-rank-num.top { color: #990000; }
        .mz-rank-nombre { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; }
        .mz-rank-barrio { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .mz-rank-barra-wrap { flex: 1; }
        .mz-rank-barra-bg { height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; margin-bottom: 3px; }
        .mz-rank-val { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; text-align: right; flex-shrink: 0; min-width: 90px; }
        .mz-rank-tend { font-size: 11px; font-weight: 800; text-align: right; margin-top: 2px; }
        @media (max-width: 700px) {
          .mz-kpis { grid-template-columns: repeat(2,1fr); }
          .mz-detalle-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="mz-wrap">
        {/* Header */}
        <div>
          <div className="mz-titulo">Mapa de <span>Zonas</span></div>
          <div className="mz-sub">Demanda, oferta, precio/m² y velocidad de venta por barrio.</div>
        </div>

        {/* KPIs */}
        <div className="mz-kpis">
          <div className="mz-kpi">
            <div className="mz-kpi-val">{fmtUSD(kpis.promPrecioVenta)}</div>
            <div className="mz-kpi-label">Precio/m² promedio</div>
          </div>
          <div className="mz-kpi">
            <div className="mz-kpi-val">{kpis.promDias}d</div>
            <div className="mz-kpi-label">Días en mercado prom.</div>
          </div>
          <div className="mz-kpi">
            <div className="mz-kpi-val" style={{ color: "#3abab6" }}>{kpis.zonasMasActivas}</div>
            <div className="mz-kpi-label">Zonas muy activas</div>
          </div>
          <div className="mz-kpi">
            <div className="mz-kpi-val" style={{ color: kpis.variacionPromedio >= 0 ? "#3abab6" : "#b80000" }}>
              {kpis.variacionPromedio > 0 ? "+" : ""}{kpis.variacionPromedio}%
            </div>
            <div className="mz-kpi-label">Variación 12m promedio</div>
          </div>
        </div>

        {/* Selector métrica */}
        <div className="mz-metricas">
          {METRICAS.map(m => (
            <button
              key={m.id}
              className="mz-metrica-btn"
              onClick={() => setMetrica(m.id)}
              style={{
                background: metrica === m.id ? "rgba(153,0,0,0.15)" : "rgba(255,255,255,0.04)",
                borderColor: metrica === m.id ? "rgba(153,0,0,0.3)" : "rgba(255,255,255,0.1)",
                color: metrica === m.id ? "#990000" : "rgba(255,255,255,0.4)",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="mz-tabs">
          {(["mapa","tabla","ranking"] as Vista[]).map(v => (
            <button key={v} className={`mz-tab${vista === v ? " on" : ""}`} onClick={() => setVista(v)}>
              {v === "mapa" ? "🗺 Mapa" : v === "tabla" ? "📋 Tabla" : "🏆 Ranking"}
            </button>
          ))}
        </div>

        {/* ═══ MAPA ═══ */}
        {vista === "mapa" && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 560px" }}>
              {/* Leyenda */}
              <div className="mz-leyenda" style={{ marginBottom: 8 }}>
                <span>Bajo</span>
                <div className="mz-leyenda-grad" style={{
                  background: metrica === "diasMercado" || metrica === "oferta"
                    ? "linear-gradient(to right,rgba(153,0,0,0.7),rgba(234,179,8,0.7),rgba(34,197,94,0.7),rgba(59,130,246,0.7))"
                    : "linear-gradient(to right,rgba(59,130,246,0.7),rgba(34,197,94,0.7),rgba(234,179,8,0.7),rgba(153,0,0,0.7))"
                }} />
                <span>Alto</span>
              </div>
              <div className="mz-grid-wrap">
                <div className="mz-grid" style={{ gridTemplateColumns: `repeat(${GRILLA_COLS},1fr)` }}>
                  {grilla.map((fila, ri) =>
                    fila.map((zona, ci) => {
                      if (!zona) {
                        return <div key={`${ri}-${ci}`} className="mz-celda vacia" />;
                      }
                      const val = zona[metrica] as number;
                      const t = intensidad(val, minVal, maxVal);
                      const bg = colorHeat(t, metrica);
                      const isSelected = zonaSeleccionada?.id === zona.id;
                      return (
                        <div
                          key={zona.id}
                          className="mz-celda"
                          style={{
                            background: bg,
                            border: isSelected ? "2px solid #fff" : "1px solid rgba(255,255,255,0.1)",
                          }}
                          onMouseEnter={() => setZonaHover(zona)}
                          onMouseLeave={() => setZonaHover(null)}
                          onClick={() => setZonaSeleccionada(z => z?.id === zona.id ? null : zona)}
                        >
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                            <div className="mz-celda-nombre">{zona.nombre.split(" ").slice(0, 2).join(" ")}</div>
                            <div className="mz-celda-val">{metricaInfo.fmt(val)}</div>
                          </div>
                          <div className="mz-celda-tend" style={{ color: tendenciaColor(zona.tendencia) }}>
                            {tendenciaIcon(zona.tendencia)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif" }}>
                Hacé clic en una zona para ver el detalle. Los datos son de referencia para CABA.
              </div>
            </div>

            {/* Panel lateral: detalle de zona seleccionada */}
            <div style={{ flex: "0 0 260px" }}>
              {zonaSeleccionada ? (
                <div className="mz-detalle">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div className="mz-detalle-titulo">{zonaSeleccionada.nombre}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: -8 }}>{zonaSeleccionada.barrio} · {zonaSeleccionada.ciudad}</div>
                    </div>
                    <button
                      onClick={() => setZonaSeleccionada(null)}
                      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16 }}
                    >×</button>
                  </div>

                  <div className="mz-detalle-grid" style={{ marginBottom: 14 }}>
                    <div className="mz-detalle-stat">
                      <div className="mz-detalle-stat-val">{fmtUSD(zonaSeleccionada.precioM2Venta)}</div>
                      <div className="mz-detalle-stat-label">USD/m² venta</div>
                    </div>
                    <div className="mz-detalle-stat">
                      <div className="mz-detalle-stat-val" style={{ fontSize: 12 }}>{fmtARS(zonaSeleccionada.precioM2Alquiler)}</div>
                      <div className="mz-detalle-stat-label">ARS/m² alquiler</div>
                    </div>
                    <div className="mz-detalle-stat">
                      <div className="mz-detalle-stat-val">{zonaSeleccionada.diasMercado}d</div>
                      <div className="mz-detalle-stat-label">Días en mercado</div>
                    </div>
                    <div className="mz-detalle-stat">
                      <div className="mz-detalle-stat-val">{zonaSeleccionada.cantPropiedades}</div>
                      <div className="mz-detalle-stat-label">Propiedades</div>
                    </div>
                    <div className="mz-detalle-stat">
                      <div
                        className="mz-detalle-stat-val"
                        style={{ color: zonaSeleccionada.variacion12m >= 0 ? "#3abab6" : "#b80000" }}
                      >
                        {zonaSeleccionada.variacion12m > 0 ? "+" : ""}{zonaSeleccionada.variacion12m.toFixed(1)}%
                      </div>
                      <div className="mz-detalle-stat-label">Var. 12 meses</div>
                    </div>
                    <div className="mz-detalle-stat">
                      <div
                        className="mz-detalle-stat-val"
                        style={{ color: tendenciaColor(zonaSeleccionada.tendencia) }}
                      >
                        {tendenciaIcon(zonaSeleccionada.tendencia)} {zonaSeleccionada.tendencia}
                      </div>
                      <div className="mz-detalle-stat-label">Tendencia</div>
                    </div>
                  </div>

                  {/* Barras demanda/oferta */}
                  <div style={{ marginBottom: 10 }}>
                    <div className="mz-barra-row">
                      <div className="mz-barra-label">
                        <span>Demanda</span><span style={{ color: "#3abab6", fontWeight: 700 }}>{zonaSeleccionada.demanda}%</span>
                      </div>
                      <div className="mz-barra-bg">
                        <div className="mz-barra-fill" style={{ width: `${zonaSeleccionada.demanda}%`, background: "#3abab6" }} />
                      </div>
                    </div>
                    <div className="mz-barra-row">
                      <div className="mz-barra-label">
                        <span>Oferta disponible</span><span style={{ color: "#4ab8d8", fontWeight: 700 }}>{zonaSeleccionada.oferta}%</span>
                      </div>
                      <div className="mz-barra-bg">
                        <div className="mz-barra-fill" style={{ width: `${zonaSeleccionada.oferta}%`, background: "#4ab8d8" }} />
                      </div>
                    </div>
                  </div>

                  {/* Indicador presión */}
                  {(() => {
                    const presion = zonaSeleccionada.demanda - zonaSeleccionada.oferta;
                    const color = presion > 20 ? "#990000" : presion > 5 ? "#d4960c" : "#3abab6";
                    const label = presion > 20 ? "Alta presión compradora" : presion > 5 ? "Mercado equilibrado" : "Oferta abundante";
                    return (
                      <div style={{ padding: "8px 12px", background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 6, fontSize: 11, color, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                        {label} ({presion > 0 ? "+" : ""}{presion}pts)
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "40px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🗺️</div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                    Hacé clic en una zona del mapa
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>para ver el detalle completo</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TABLA ═══ */}
        {vista === "tabla" && (
          <div style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
            <div className="mz-tabla-wrap">
              <table className="mz-tabla">
                <thead>
                  <tr>
                    {[
                      { col: "nombre" as keyof Zona, label: "Zona" },
                      { col: "precioM2Venta" as keyof Zona, label: "USD/m² Venta" },
                      { col: "precioM2Alquiler" as keyof Zona, label: "ARS/m² Alq." },
                      { col: "diasMercado" as keyof Zona, label: "Días" },
                      { col: "cantPropiedades" as keyof Zona, label: "Propiedades" },
                      { col: "demanda" as keyof Zona, label: "Demanda" },
                      { col: "oferta" as keyof Zona, label: "Oferta" },
                      { col: "variacion12m" as keyof Zona, label: "Var. 12m" },
                      { col: "tendencia" as keyof Zona, label: "Tendencia" },
                    ].map(({ col, label }) => (
                      <th key={col} onClick={() => toggleSort(col)}>
                        {label} {sortCol === col ? (sortDir === "desc" ? "↓" : "↑") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranking.map(z => (
                    <tr key={z.id}>
                      <td>
                        <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff", fontSize: 12 }}>{z.nombre}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{z.barrio}</div>
                      </td>
                      <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: "#fff" }}>{fmtUSD(z.precioM2Venta)}</td>
                      <td>{fmtARS(z.precioM2Alquiler)}</td>
                      <td>
                        <span style={{
                          padding: "2px 8px", borderRadius: 10, fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
                          background: z.diasMercado < 30 ? "rgba(34,197,94,0.15)" : z.diasMercado < 60 ? "rgba(234,179,8,0.15)" : "rgba(153,0,0,0.15)",
                          color: z.diasMercado < 30 ? "#3abab6" : z.diasMercado < 60 ? "#d4960c" : "#b80000",
                        }}>
                          {z.diasMercado}d
                        </span>
                      </td>
                      <td>{z.cantPropiedades}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${z.demanda}%`, height: "100%", background: "#3abab6", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#3abab6", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{z.demanda}%</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${z.oferta}%`, height: "100%", background: "#4ab8d8", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#4ab8d8", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{z.oferta}%</span>
                        </div>
                      </td>
                      <td style={{
                        fontFamily: "Montserrat,sans-serif", fontWeight: 700,
                        color: z.variacion12m >= 0 ? "#3abab6" : "#b80000",
                      }}>
                        {z.variacion12m > 0 ? "+" : ""}{z.variacion12m.toFixed(1)}%
                      </td>
                      <td style={{ color: tendenciaColor(z.tendencia), fontFamily: "Montserrat,sans-serif", fontWeight: 800 }}>
                        {tendenciaIcon(z.tendencia)} {z.tendencia}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ RANKING ═══ */}
        {vista === "ranking" && (
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Tendencia:</span>
              <div className="mz-filtros">
                {(["todas","sube","estable","baja"] as const).map(f => (
                  <button key={f} className={`mz-filtro-btn${filtroTendencia === f ? " on" : ""}`} onClick={() => setFiltroTendencia(f)}>
                    {f === "todas" ? "Todas" : f === "sube" ? "▲ Sube" : f === "baja" ? "▼ Baja" : "→ Estable"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 8, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif" }}>
              Ordenado por: <strong style={{ color: "rgba(255,255,255,0.5)" }}>{metricaInfo.label}</strong>
              {sortDir === "desc" ? " (mayor → menor)" : " (menor → mayor)"}
            </div>

            {ranking.map((z, i) => {
              const val = z[metrica] as number;
              const maxV = Math.max(...ZONAS_DEMO.map(x => x[metrica] as number));
              const pct = (val / maxV) * 100;
              const barColor = metrica === "diasMercado"
                ? (val < 30 ? "#3abab6" : val < 60 ? "#d4960c" : "#b80000")
                : "#990000";
              return (
                <div key={z.id} className="mz-rank-item" onClick={() => { setZonaSeleccionada(z); setVista("mapa"); }}>
                  <div className={`mz-rank-num${i < 3 ? " top" : ""}`}>#{i + 1}</div>
                  <div style={{ flex: "0 0 160px" }}>
                    <div className="mz-rank-nombre">{z.nombre}</div>
                    <div className="mz-rank-barrio">{z.barrio} · {z.cantPropiedades} props.</div>
                  </div>
                  <div className="mz-rank-barra-wrap">
                    <div className="mz-rank-barra-bg">
                      <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{z.diasMercado}d en mercado</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Demanda {z.demanda}%</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, minWidth: 100 }}>
                    <div className="mz-rank-val">{metricaInfo.fmt(val)}</div>
                    <div className="mz-rank-tend" style={{ color: tendenciaColor(z.tendencia) }}>
                      {tendenciaIcon(z.tendencia)} {z.tendencia}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tooltip flotante (hover en mapa) */}
        {zonaHover && vista === "mapa" && (
          <div
            className="mz-tooltip"
            style={{ top: 120, left: 20 }}
          >
            <div className="mz-tooltip-nombre">{zonaHover.nombre}</div>
            <div className="mz-tooltip-row"><span className="mz-tooltip-key">USD/m²</span><span className="mz-tooltip-val">{fmtUSD(zonaHover.precioM2Venta)}</span></div>
            <div className="mz-tooltip-row"><span className="mz-tooltip-key">Días mercado</span><span className="mz-tooltip-val">{zonaHover.diasMercado}d</span></div>
            <div className="mz-tooltip-row"><span className="mz-tooltip-key">Demanda</span><span className="mz-tooltip-val" style={{ color: "#3abab6" }}>{zonaHover.demanda}%</span></div>
            <div className="mz-tooltip-row"><span className="mz-tooltip-key">Var. 12m</span><span className="mz-tooltip-val" style={{ color: zonaHover.variacion12m >= 0 ? "#3abab6" : "#b80000" }}>{zonaHover.variacion12m > 0 ? "+" : ""}{zonaHover.variacion12m.toFixed(1)}%</span></div>
          </div>
        )}
      </div>
    </>
  );
}
